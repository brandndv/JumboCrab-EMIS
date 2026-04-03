"use server";

import {
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateApprovedDeductionAssignments,
  employeeDeductionAssignmentInclude,
  loadAssignmentRecord,
  revalidateDeductionLayouts,
  serializeDeductionAssignment,
} from "./deductions-shared";
import type { DeductionAssignmentRow } from "./types";

export async function setEmployeeDeductionAssignmentStatus(input: {
  id: string;
  status: EmployeeDeductionAssignmentStatus;
}): Promise<{
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
        error: "You are not allowed to update deduction assignment status.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }

    const existing = await loadAssignmentRecord(id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
      return {
        success: false,
        error: "Only approved assignments can change payroll status.",
      };
    }

    const updated = await db.employeeDeductionAssignment.update({
      where: { id },
      data: {
        status: input.status,
        updatedByUserId: session.userId ?? null,
      },
      include: employeeDeductionAssignmentInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    console.error("Error updating deduction assignment status:", error);
    return {
      success: false,
      error: "Failed to update deduction assignment status.",
    };
  }
}
