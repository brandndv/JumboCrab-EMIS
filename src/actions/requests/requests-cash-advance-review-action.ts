"use server";

import {
  CashAdvanceDeductionMode,
  CashAdvanceRequestStatus,
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { cashAdvanceReviewSchema } from "@/lib/validations/requests";
import {
  CASH_ADVANCE_DEDUCTION_CODE,
  CASH_ADVANCE_ONE_TIME_DEDUCTION_CODE,
  canReviewRequests,
  employeeRequestSelect,
  reviewedBySelect,
  revalidateRequestLayouts,
  serializeCashAdvanceRequest,
} from "./requests-shared";
import { notifyEmployeeOfRequestDecision } from "./requests-notifications";
import type { CashAdvanceRequestRow, RequestReviewPayload } from "./types";

const resolveDefaultNextPayrollDate = async () => {
  const today = startOfZonedDay(new Date());
  const activeOrLatest = await db.payroll.findFirst({
    where: {
      payrollPeriodEnd: { gte: today },
    },
    orderBy: { payrollPeriodEnd: "asc" },
    select: { payrollPeriodEnd: true },
  });

  if (activeOrLatest) {
    return startOfZonedDay(
      new Date(activeOrLatest.payrollPeriodEnd.getTime() + 24 * 60 * 60 * 1000),
    );
  }

  return today;
};

const getCurrentCashAdvanceDeductionMode = (): CashAdvanceDeductionMode =>
  CashAdvanceDeductionMode.FULL_NEXT_PAYROLL;

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
      await notifyEmployeeOfRequestDecision({
        eventType: "CASH_ADVANCE_REQUEST_REJECTED",
        title: "Cash advance request rejected",
        message: "Your cash advance request was rejected.",
        actorUserId: session.userId ?? null,
        employeeId: reviewed.employee.employeeId,
        entityType: "CashAdvanceRequest",
        entityId: reviewed.id,
        linkHref: "/employee/requests",
      });
      return { success: true, data: serializeCashAdvanceRequest(reviewed) };
    }

    const approvedAmount = Number(parsed.data.approvedAmount);
    // Current policy: employee cash advance requests are one-time deductions only.
    // Installment support below stays in place for future re-enable.
    const approvedDeductionMode = getCurrentCashAdvanceDeductionMode();
    const isInstallment =
      approvedDeductionMode === CashAdvanceDeductionMode.INSTALLMENTS;
    const approvedRepaymentPerPayroll =
      isInstallment ? Number(parsed.data.approvedRepaymentPerPayroll) : approvedAmount;
    const approvedEffectiveFrom =
      parsed.data.approvedEffectiveFrom ?? (await resolveDefaultNextPayrollDate());
    const deductionTypeCode = isInstallment
      ? CASH_ADVANCE_DEDUCTION_CODE
      : CASH_ADVANCE_ONE_TIME_DEDUCTION_CODE;
    const deductionTypeName = isInstallment
      ? "Cash Advance - Installment"
      : "Cash Advance - One Time";
    const deductionFrequency = isInstallment
      ? DeductionFrequency.INSTALLMENT
      : DeductionFrequency.ONE_TIME;

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

        const deductionType = await tx.deductionType.upsert({
          where: { code: deductionTypeCode },
          create: {
            code: deductionTypeCode,
            name: deductionTypeName,
            description: isInstallment
              ? "Cash advance repayment split across payroll periods."
              : "Cash advance repayment deducted once on the selected payroll.",
            amountMode: DeductionAmountMode.FIXED,
            frequency: deductionFrequency,
            isActive: true,
            createdByUserId: session.userId ?? null,
            updatedByUserId: session.userId ?? null,
          },
          update: {
            name: deductionTypeName,
            amountMode: DeductionAmountMode.FIXED,
            frequency: deductionFrequency,
            isActive: true,
            updatedByUserId: session.userId ?? null,
          },
          select: { id: true },
        });

        const assignment = await tx.employeeDeductionAssignment.create({
          data: {
            employeeId: fresh.employeeId,
            deductionTypeId: deductionType.id,
            effectiveFrom: approvedEffectiveFrom,
            amountOverride: isInstallment ? null : approvedAmount,
            installmentTotal: isInstallment ? approvedAmount : null,
            installmentPerPayroll: isInstallment ? approvedRepaymentPerPayroll : null,
            remainingBalance: isInstallment ? approvedAmount : null,
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
            approvedAmount,
            approvedDeductionMode,
            approvedRepaymentPerPayroll,
            approvedEffectiveFrom,
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
      await notifyEmployeeOfRequestDecision({
        eventType: "CASH_ADVANCE_REQUEST_APPROVED",
        title: "Cash advance request approved",
        message: "Your cash advance request was approved.",
        actorUserId: session.userId ?? null,
        employeeId: reviewed.employee.employeeId,
        entityType: "CashAdvanceRequest",
        entityId: reviewed.id,
        linkHref: "/employee/requests",
      });
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
