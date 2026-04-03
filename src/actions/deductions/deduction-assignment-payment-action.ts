"use server";

import {
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  PayrollStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deductionPaymentSchema } from "@/lib/validations/deductions";
import {
  canRecordDeductionPayments,
  employeeDeductionAssignmentInclude,
  loadAssignmentRecord,
  resolveInstallmentStatusAfterPayment,
  revalidateDeductionLayouts,
  roundMoney,
  serializeDeductionAssignment,
  toNumber,
} from "./deductions-shared";
import type {
  DeductionAssignmentRow,
  DeductionPaymentPayload,
} from "./types";

export async function recordEmployeeDeductionPayment(
  input: DeductionPaymentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canRecordDeductionPayments(session.role)) {
      return {
        success: false,
        error: "You are not allowed to record deduction payments.",
      };
    }

    const parsed = deductionPaymentSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return {
        success: false,
        error: message || "Invalid deduction payment data",
      };
    }

    const existing = await loadAssignmentRecord(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
      return {
        success: false,
        error: "Only approved deductions can record manual payments.",
      };
    }
    if (existing.status === EmployeeDeductionAssignmentStatus.CANCELLED) {
      return {
        success: false,
        error: "Cancelled deductions cannot accept payments.",
      };
    }
    if (existing.status === EmployeeDeductionAssignmentStatus.COMPLETED) {
      return {
        success: false,
        error: "Completed deductions cannot accept additional payments.",
      };
    }

    const paymentAmount = parsed.data.amount;
    if (paymentAmount == null || paymentAmount <= 0) {
      return {
        success: false,
        error: "Payment amount is required.",
      };
    }

    const isInstallment =
      existing.deductionType.frequency === DeductionFrequency.INSTALLMENT;
    const isOneTime =
      existing.deductionType.frequency === DeductionFrequency.ONE_TIME;
    const currentBalance = isInstallment
      ? toNumber(existing.remainingBalance ?? existing.installmentTotal)
      : null;

    if (isInstallment) {
      if (currentBalance == null || currentBalance <= 0) {
        return {
          success: false,
          error: "This deduction does not have a remaining balance.",
        };
      }
      if (paymentAmount > currentBalance) {
        return {
          success: false,
          error: "Payment amount cannot exceed the remaining balance.",
        };
      }
    }

    const pendingPayrollLine = await db.payrollDeduction.findFirst({
      where: {
        assignmentId: existing.id,
        isVoided: false,
        payrollEmployee: {
          payroll: {
            status: { in: [PayrollStatus.DRAFT, PayrollStatus.REVIEWED] },
          },
        },
      },
      select: {
        payrollEmployee: {
          select: {
            payroll: {
              select: {
                payrollPeriodStart: true,
                payrollPeriodEnd: true,
              },
            },
          },
        },
      },
    });

    if (pendingPayrollLine) {
      const pendingPayroll = pendingPayrollLine.payrollEmployee.payroll;
      return {
        success: false,
        error: `This deduction is already included in an unreleased payroll for ${pendingPayroll.payrollPeriodStart.toLocaleDateString()} to ${pendingPayroll.payrollPeriodEnd.toLocaleDateString()}. Release or void that payroll before recording another payment.`,
      };
    }

    const nextRemainingBalance = isInstallment
      ? roundMoney(Math.max(0, (currentBalance ?? 0) - paymentAmount))
      : null;
    const nextStatus = isInstallment
      ? resolveInstallmentStatusAfterPayment(
          existing.status,
          nextRemainingBalance ?? 0,
        )
      : isOneTime
        ? EmployeeDeductionAssignmentStatus.COMPLETED
        : existing.status;

    const updated = await db.$transaction(async (tx) => {
      await tx.employeeDeductionPayment.create({
        data: {
          assignmentId: existing.id,
          amount: paymentAmount,
          paymentDate: parsed.data.paymentDate!,
          remarks: parsed.data.remarks ?? null,
          createdByUserId: session.userId ?? null,
        },
      });

      return tx.employeeDeductionAssignment.update({
        where: { id: existing.id },
        data: {
          remainingBalance: nextRemainingBalance,
          status: nextStatus,
          updatedByUserId: session.userId ?? null,
        },
        include: employeeDeductionAssignmentInclude,
      });
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    console.error("Error recording deduction payment:", error);
    return { success: false, error: "Failed to record deduction payment." };
  }
}
