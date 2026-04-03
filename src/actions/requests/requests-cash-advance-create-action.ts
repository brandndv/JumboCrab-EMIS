"use server";

import { CashAdvanceRequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashAdvanceRequestSchema } from "@/lib/validations/requests";
import {
  canCreateEmployeeRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  revalidateRequestLayouts,
  reviewedBySelect,
  roundMoney,
  serializeCashAdvanceRequest,
} from "./requests-shared";
import type { CashAdvanceRequestPayload, CashAdvanceRequestRow } from "./types";

//! LOGIC - CREATE CASH ADVANCE REQUEST
export async function createCashAdvanceRequest(
  input: CashAdvanceRequestPayload,
): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create cash advance requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = cashAdvanceRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const created = await db.cashAdvanceRequest.create({
      data: {
        employeeId: employee.employeeId,
        amount: roundMoney(parsed.data.amount!),
        repaymentPerPayroll: roundMoney(parsed.data.repaymentPerPayroll!),
        preferredStartDate: parsed.data.preferredStartDate!,
        reason: parsed.data.reason ?? null,
        status: CashAdvanceRequestStatus.PENDING_MANAGER,
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
    return { success: true, data: serializeCashAdvanceRequest(created) };
  } catch (error) {
    console.error("Error creating cash advance request:", error);
    return { success: false, error: "Failed to create cash advance request." };
  }
}
