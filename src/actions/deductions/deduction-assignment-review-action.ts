"use server";

import { EmployeeDeductionWorkflowStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canReviewDeductionAssignments,
  employeeDeductionAssignmentInclude,
  loadAssignmentRecord,
  revalidateDeductionLayouts,
  serializeDeductionAssignment,
} from "./deductions-shared";
import type { DeductionAssignmentRow } from "./types";

export async function reviewEmployeeDeductionAssignment(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  reviewRemarks?: string | null;
}): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewDeductionAssignments(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review deduction drafts.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const reviewRemarks =
      typeof input.reviewRemarks === "string" && input.reviewRemarks.trim()
        ? input.reviewRemarks.trim()
        : null;

    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }
    if (input.decision === "REJECTED" && !reviewRemarks) {
      return {
        success: false,
        error: "Review remarks are required when rejecting a draft.",
      };
    }

    const existing = await loadAssignmentRecord(id);
    if (!existing) {
      return { success: false, error: "Deduction draft not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.DRAFT) {
      return { success: false, error: "Only deduction drafts can be reviewed." };
    }

    const reviewed = await db.employeeDeductionAssignment.update({
      where: { id },
      data: {
        workflowStatus:
          input.decision === "APPROVED"
            ? EmployeeDeductionWorkflowStatus.APPROVED
            : EmployeeDeductionWorkflowStatus.REJECTED,
        reviewedByUserId: session.userId ?? null,
        reviewedAt: new Date(),
        reviewRemarks,
        updatedByUserId: session.userId ?? null,
      },
      include: employeeDeductionAssignmentInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(reviewed) };
  } catch (error) {
    console.error("Error reviewing deduction assignment:", error);
    return { success: false, error: "Failed to review deduction draft." };
  }
}
