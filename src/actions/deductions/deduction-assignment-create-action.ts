"use server";

import {
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deductionAssignmentSchema } from "@/lib/validations/deductions";
import {
  canCreateApprovedDeductionAssignments,
  duplicateAssignmentMessage,
  employeeDeductionAssignmentInclude,
  findDuplicateAssignment,
  resolveAssignmentValues,
  revalidateDeductionLayouts,
  serializeDeductionAssignment,
} from "./deductions-shared";
import type {
  DeductionAssignmentPayload,
  DeductionAssignmentRow,
} from "./types";

export async function createEmployeeDeductionAssignment(
  input: DeductionAssignmentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (
      !session?.isLoggedIn ||
      !canCreateApprovedDeductionAssignments(session.role)
    ) {
      return {
        success: false,
        error: "You are not allowed to create deduction assignments.",
      };
    }

    const parsed = deductionAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return {
        success: false,
        error: message || "Invalid deduction assignment data",
      };
    }

    const [employee, deductionType] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId: parsed.data.employeeId },
        select: {
          employeeId: true,
          isArchived: true,
        },
      }),
      db.deductionType.findUnique({
        where: { id: parsed.data.deductionTypeId },
        select: {
          id: true,
          isActive: true,
          amountMode: true,
          frequency: true,
          defaultAmount: true,
          defaultPercent: true,
        },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found." };
    }
    if (!deductionType || !deductionType.isActive) {
      return {
        success: false,
        error: "Deduction type not found or inactive.",
      };
    }

    const normalized = resolveAssignmentValues(parsed.data, {
      amountMode: deductionType.amountMode,
      frequency: deductionType.frequency,
      defaultAmount: deductionType.defaultAmount,
      defaultPercent: deductionType.defaultPercent,
    });
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const duplicate = await findDuplicateAssignment({
      employeeId: parsed.data.employeeId,
      deductionTypeId: parsed.data.deductionTypeId,
      effectiveFrom: parsed.data.effectiveFrom!,
    });
    if (duplicate) {
      return { success: false, error: duplicateAssignmentMessage };
    }

    const now = new Date();
    const created = await db.employeeDeductionAssignment.create({
      data: {
        employeeId: parsed.data.employeeId,
        deductionTypeId: parsed.data.deductionTypeId,
        effectiveFrom: parsed.data.effectiveFrom!,
        effectiveTo: parsed.data.effectiveTo ?? null,
        amountOverride: normalized.amountOverride ?? null,
        percentOverride: normalized.percentOverride ?? null,
        installmentTotal: normalized.installmentTotal ?? null,
        installmentPerPayroll: normalized.installmentPerPayroll ?? null,
        remainingBalance: normalized.remainingBalance ?? null,
        workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
        status: parsed.data.status ?? EmployeeDeductionAssignmentStatus.ACTIVE,
        reason: parsed.data.reason ?? null,
        assignedByUserId: session.userId ?? null,
        updatedByUserId: session.userId ?? null,
        submittedAt: now,
        reviewedByUserId: session.userId ?? null,
        reviewedAt: now,
        reviewRemarks: null,
      },
      include: employeeDeductionAssignmentInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(created) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: duplicateAssignmentMessage };
    }
    console.error("Error creating deduction assignment:", error);
    return { success: false, error: "Failed to create deduction assignment." };
  }
}
