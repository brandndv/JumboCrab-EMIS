"use server";

import {
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  PayrollEmployeeStatus,
  PayrollReviewDecision,
  PayrollStatus,
  type Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { roundCurrency, toNumber } from "@/lib/payroll/helpers";
import { getPayrollRunDetails } from "./payroll-runs-action";
import {
  canReviewAsGeneralManager,
  canReviewAsManager,
  revalidatePayrollPages,
} from "./payroll-shared";
import type { PayrollRunDetail, ReviewPayrollInput } from "@/types/payroll";

export async function reviewPayrollRun(input: ReviewPayrollInput): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!input?.payrollId) {
      return { success: false, error: "Payroll ID is required" };
    }
    if (!input.level || !input.decision) {
      return {
        success: false,
        error: "Review level and decision are required",
      };
    }

    if (input.level === "MANAGER" && !canReviewAsManager(session.role)) {
      return { success: false, error: "Unauthorized manager review action" };
    }
    if (
      input.level === "GENERAL_MANAGER" &&
      !canReviewAsGeneralManager(session.role)
    ) {
      return {
        success: false,
        error: "Unauthorized general manager review action",
      };
    }

    const remarks = input.remarks?.trim() || null;
    if (input.decision === "REJECTED" && !remarks) {
      return { success: false, error: "Remarks are required when rejecting" };
    }

    await db.$transaction(async (tx) => {
      const run = await tx.payroll.findUnique({
        where: { payrollId: input.payrollId },
        select: {
          payrollId: true,
          status: true,
          managerDecision: true,
          gmDecision: true,
        },
      });

      if (!run) {
        throw new Error("Payroll run not found");
      }
      if (
        run.status === PayrollStatus.RELEASED ||
        run.status === PayrollStatus.FINALIZED ||
        run.status === PayrollStatus.VOIDED
      ) {
        throw new Error("Released/finalized payroll cannot be reviewed");
      }

      const now = new Date();
      if (input.level === "MANAGER") {
        const decision =
          input.decision === "APPROVED"
            ? PayrollReviewDecision.APPROVED
            : PayrollReviewDecision.REJECTED;
        const updateData: Prisma.PayrollUncheckedUpdateInput = {
          managerDecision: decision,
          managerReviewedAt: now,
          managerReviewedByUserId: session.userId ?? null,
          managerReviewRemarks: remarks,
          status:
            input.decision === "REJECTED"
              ? PayrollStatus.DRAFT
              : PayrollStatus.REVIEWED,
        };
        if (input.decision === "REJECTED") {
          updateData.gmDecision = PayrollReviewDecision.PENDING;
          updateData.gmReviewedAt = null;
          updateData.gmReviewedByUserId = null;
          updateData.gmReviewRemarks = null;
          updateData.releasedAt = null;
          updateData.releasedByUserId = null;
        }

        await tx.payroll.update({
          where: { payrollId: run.payrollId },
          data: updateData,
        });
      } else {
        if (run.managerDecision !== PayrollReviewDecision.APPROVED) {
          throw new Error(
            "General Manager review requires Manager approval first",
          );
        }

        const decision =
          input.decision === "APPROVED"
            ? PayrollReviewDecision.APPROVED
            : PayrollReviewDecision.REJECTED;
        const updateData: Prisma.PayrollUncheckedUpdateInput = {
          gmDecision: decision,
          gmReviewedAt: now,
          gmReviewedByUserId: session.userId ?? null,
          gmReviewRemarks: remarks,
          status:
            input.decision === "REJECTED"
              ? PayrollStatus.DRAFT
              : PayrollStatus.REVIEWED,
          releasedAt: null,
          releasedByUserId: null,
        };

        await tx.payroll.update({
          where: { payrollId: run.payrollId },
          data: updateData,
        });
      }

      await tx.payrollEmployee.updateMany({
        where: { payrollId: input.payrollId },
        data: {
          status:
            input.decision === "REJECTED"
              ? PayrollEmployeeStatus.DRAFT
              : PayrollEmployeeStatus.REVIEWED,
          updatedByUserId: session.userId ?? null,
        },
      });
    });

    revalidatePayrollPages();
    return await getPayrollRunDetails(input.payrollId);
  } catch (error) {
    console.error("Error reviewing payroll run:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to review payroll run",
    };
  }
}

export async function releasePayrollRun(payrollId: string): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canReviewAsGeneralManager(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollId) return { success: false, error: "Payroll ID is required" };

    await db.$transaction(async (tx) => {
      const run = await tx.payroll.findUnique({
        where: { payrollId },
        select: {
          payrollId: true,
          status: true,
          managerDecision: true,
          gmDecision: true,
        },
      });
      if (!run) throw new Error("Payroll run not found");
      if (run.status === PayrollStatus.RELEASED) {
        throw new Error("Payroll run is already released");
      }
      if (run.managerDecision !== PayrollReviewDecision.APPROVED) {
        throw new Error("Manager approval is required before release");
      }
      if (run.gmDecision !== PayrollReviewDecision.APPROVED) {
        throw new Error("General Manager approval is required before release");
      }

      await tx.payroll.update({
        where: { payrollId },
        data: {
          status: PayrollStatus.RELEASED,
          releasedAt: new Date(),
          releasedByUserId: session.userId ?? null,
        },
      });

      await tx.payrollEmployee.updateMany({
        where: { payrollId },
        data: {
          status: PayrollEmployeeStatus.RELEASED,
          updatedByUserId: session.userId ?? null,
        },
      });

      const deductionAssignments = await tx.payrollDeduction.findMany({
        where: {
          payrollEmployee: { payrollId },
          assignmentId: { not: null },
          isVoided: false,
        },
        select: {
          assignmentId: true,
          amount: true,
          assignment: {
            select: {
              id: true,
              workflowStatus: true,
              status: true,
              remainingBalance: true,
              installmentTotal: true,
              deductionType: {
                select: {
                  frequency: true,
                },
              },
            },
          },
        },
      });

      const settlementByAssignment = new Map<
        string,
        {
          totalAmount: number;
          workflowStatus: EmployeeDeductionWorkflowStatus;
          status: EmployeeDeductionAssignmentStatus;
          remainingBalance: Prisma.Decimal | null;
          installmentTotal: Prisma.Decimal | null;
          frequency: DeductionFrequency;
        }
      >();

      for (const row of deductionAssignments) {
        const assignmentId = row.assignmentId;
        const assignment = row.assignment;
        if (!assignmentId || !assignment) continue;

        const existingSettlement = settlementByAssignment.get(assignmentId);
        const totalAmount = roundCurrency(
          (existingSettlement?.totalAmount ?? 0) + toNumber(row.amount, 0),
        );

        settlementByAssignment.set(assignmentId, {
          totalAmount,
          workflowStatus: assignment.workflowStatus,
          status: assignment.status,
          remainingBalance: assignment.remainingBalance,
          installmentTotal: assignment.installmentTotal,
          frequency: assignment.deductionType.frequency,
        });
      }

      for (const [assignmentId, settlement] of settlementByAssignment) {
        if (
          settlement.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED
        ) {
          continue;
        }

        if (settlement.frequency === DeductionFrequency.ONE_TIME) {
          await tx.employeeDeductionAssignment.update({
            where: { id: assignmentId },
            data: {
              status: EmployeeDeductionAssignmentStatus.COMPLETED,
              updatedByUserId: session.userId ?? null,
            },
          });
          continue;
        }

        if (settlement.frequency !== DeductionFrequency.INSTALLMENT) {
          continue;
        }

        const balanceSeed = toNumber(
          settlement.remainingBalance ?? settlement.installmentTotal,
          0,
        );
        const nextRemainingBalance = roundCurrency(
          Math.max(0, balanceSeed - settlement.totalAmount),
        );

        const nextStatus =
          nextRemainingBalance <= 0
            ? EmployeeDeductionAssignmentStatus.COMPLETED
            : settlement.status === EmployeeDeductionAssignmentStatus.PAUSED
              ? EmployeeDeductionAssignmentStatus.PAUSED
              : settlement.status ===
                  EmployeeDeductionAssignmentStatus.CANCELLED
                ? EmployeeDeductionAssignmentStatus.CANCELLED
                : EmployeeDeductionAssignmentStatus.ACTIVE;

        await tx.employeeDeductionAssignment.update({
          where: { id: assignmentId },
          data: {
            remainingBalance: nextRemainingBalance,
            status: nextStatus,
            updatedByUserId: session.userId ?? null,
          },
        });
      }
    });

    revalidatePayrollPages();
    return await getPayrollRunDetails(payrollId);
  } catch (error) {
    console.error("Error releasing payroll run:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to release payroll run",
    };
  }
}
