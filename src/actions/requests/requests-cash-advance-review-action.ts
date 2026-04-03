"use server";

import {
  CashAdvanceRequestStatus,
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashAdvanceReviewSchema } from "@/lib/validations/requests";
import {
  CASH_ADVANCE_DEDUCTION_CODE,
  canReviewRequests,
  employeeRequestSelect,
  reviewedBySelect,
  revalidateRequestLayouts,
  serializeCashAdvanceRequest,
} from "./requests-shared";
import type { CashAdvanceRequestRow, RequestReviewPayload } from "./types";

export async function reviewCashAdvanceRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review cash advance requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.cashAdvanceRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            isArchived: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Cash advance request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== CashAdvanceRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending review requests can be reviewed.",
      };
    }

    const now = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.cashAdvanceRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: CashAdvanceRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt: now,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
          deductionAssignment: {
            select: {
              id: true,
              status: true,
              effectiveFrom: true,
              remainingBalance: true,
            },
          },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeCashAdvanceRequest(reviewed) };
    }

    const deductionType = await db.deductionType.findFirst({
      where: {
        code: CASH_ADVANCE_DEDUCTION_CODE,
        isActive: true,
        amountMode: DeductionAmountMode.FIXED,
        frequency: DeductionFrequency.INSTALLMENT,
      },
      select: {
        id: true,
      },
    });

    if (!deductionType) {
      return {
        success: false,
        error:
          "An active installment deduction type with code CASH_ADVANCE is required before approving this request.",
      };
    }

    const duplicateAssignmentMessage =
      "A cash advance deduction already exists for this employee on the selected start date. Adjust the request start date or settle the existing record first.";

    try {
      const reviewed = await db.$transaction(async (tx) => {
        const fresh = await tx.cashAdvanceRequest.findUnique({
          where: { id: parsed.data.id },
          include: {
            employee: { select: employeeRequestSelect },
            reviewedBy: { select: reviewedBySelect },
            deductionAssignment: {
              select: {
                id: true,
                status: true,
                effectiveFrom: true,
                remainingBalance: true,
              },
            },
          },
        });

        if (!fresh) {
          throw new Error("Cash advance request not found.");
        }
        if (fresh.status !== CashAdvanceRequestStatus.PENDING_MANAGER) {
          throw new Error("This cash advance request has already been reviewed.");
        }

        const assignment = await tx.employeeDeductionAssignment.create({
          data: {
            employeeId: fresh.employeeId,
            deductionTypeId: deductionType.id,
            effectiveFrom: fresh.preferredStartDate,
            installmentTotal: fresh.amount,
            installmentPerPayroll: fresh.repaymentPerPayroll,
            remainingBalance: fresh.amount,
            workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
            status: EmployeeDeductionAssignmentStatus.ACTIVE,
            reason: fresh.reason
              ? `Cash advance request: ${fresh.reason}`
              : "Cash advance request approved by manager",
            assignedByUserId: session.userId ?? null,
            updatedByUserId: session.userId ?? null,
            submittedAt: now,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            reviewRemarks:
              "Created automatically from approved cash advance request.",
          },
          select: {
            id: true,
          },
        });

        return tx.cashAdvanceRequest.update({
          where: { id: parsed.data.id },
          data: {
            status: CashAdvanceRequestStatus.APPROVED,
            managerRemarks: parsed.data.managerRemarks ?? null,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            deductionAssignmentId: assignment.id,
          },
          include: {
            employee: { select: employeeRequestSelect },
            reviewedBy: { select: reviewedBySelect },
            deductionAssignment: {
              select: {
                id: true,
                status: true,
                effectiveFrom: true,
                remainingBalance: true,
              },
            },
          },
        });
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeCashAdvanceRequest(reviewed) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { success: false, error: duplicateAssignmentMessage };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error reviewing cash advance request:", error);
    return { success: false, error: "Failed to review cash advance request." };
  }
}
