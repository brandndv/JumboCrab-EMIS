"use server";

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deductionAssignmentSchema } from "@/lib/validations/deductions";
import {
  canCreateApprovedDeductionAssignments,
  duplicateAssignmentMessage,
  employeeDeductionAssignmentInclude,
  findDuplicateAssignment,
  loadAssignmentRecord,
  resolveAssignmentValues,
  revalidateDeductionLayouts,
  serializeDeductionAssignment,
} from "./deductions-shared";
import type {
  DeductionAssignmentPayload,
  DeductionAssignmentRow,
} from "./types";

export async function updateEmployeeDeductionAssignment(
  input: DeductionAssignmentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const parsed = deductionAssignmentSchema.safeParse(input);
    if (!parsed.success || !parsed.data.id) {
      const message = parsed.error?.issues[0]?.message;
      return {
        success: false,
        error: message || "A valid deduction assignment ID is required",
      };
    }

    const existing = await loadAssignmentRecord(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }

    const isManagerEdit = canCreateApprovedDeductionAssignments(session.role);
    if (isManagerEdit) {
      if (existing.workflowStatus !== "APPROVED") {
        return {
          success: false,
          error: "Only approved deduction assignments can be edited here.",
        };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to update deduction assignments.",
      };
    }

    const [employee, deductionType] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId: parsed.data.employeeId },
        select: { employeeId: true, isArchived: true },
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
      existing: {
        installmentTotal: existing.installmentTotal,
        installmentPerPayroll: existing.installmentPerPayroll,
        remainingBalance: existing.remainingBalance,
      },
    });
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const duplicate = await findDuplicateAssignment({
      employeeId: parsed.data.employeeId,
      deductionTypeId: parsed.data.deductionTypeId,
      effectiveFrom: parsed.data.effectiveFrom!,
      excludeId: existing.id,
    });
    if (duplicate) {
      return { success: false, error: duplicateAssignmentMessage };
    }

    const updated = await db.employeeDeductionAssignment.update({
      where: { id: existing.id },
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
        workflowStatus: existing.workflowStatus,
        status: parsed.data.status ?? existing.status,
        reason: parsed.data.reason ?? null,
        updatedByUserId: session.userId ?? null,
        submittedAt: existing.submittedAt,
      },
      include: employeeDeductionAssignmentInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: duplicateAssignmentMessage };
    }
    console.error("Error updating deduction assignment:", error);
    return { success: false, error: "Failed to update deduction assignment." };
  }
}
