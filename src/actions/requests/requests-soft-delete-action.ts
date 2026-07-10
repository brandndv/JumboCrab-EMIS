"use server";

import {
  DayOffRequestStatus,
  GovernmentLoanAssistanceRequestStatus,
  LeaveRequestStatus,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewRequests, revalidateRequestLayouts } from "./requests-shared";
import type { RequestSoftDeletePayload } from "./types";

type SoftDeleteKind =
  | "LEAVE"
  | "DAY_OFF"
  | "SCHEDULE_CHANGE"
  | "SCHEDULE_SWAP"
  | "GOVERNMENT_LOAN"
  | "CASH_ADVANCE";

const parseKind = (value: unknown): SoftDeleteKind | null => {
  if (
    value === "LEAVE" ||
    value === "DAY_OFF" ||
    value === "SCHEDULE_CHANGE" ||
    value === "SCHEDULE_SWAP" ||
    value === "GOVERNMENT_LOAN" ||
    value === "CASH_ADVANCE"
  ) {
    return value;
  }
  return null;
};

export async function softDeleteRequest(
  input: RequestSoftDeletePayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to delete requests.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const requestType = parseKind(input.requestType);
    if (!id || !requestType) {
      return { success: false, error: "Request is required." };
    }

    if (requestType === "CASH_ADVANCE") {
      return {
        success: false,
        error: "Cash advance requests cannot be deleted because they may be linked to payroll deductions.",
      };
    }

    if (requestType === "LEAVE") {
      const row = await db.leaveRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!row) return { success: false, error: "Leave request not found." };
      if (
        row.status !== LeaveRequestStatus.PENDING_MANAGER &&
        row.status !== LeaveRequestStatus.REJECTED
      ) {
        return {
          success: false,
          error: "Only pending or rejected leave requests can be deleted.",
        };
      }
      await db.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          managerRemarks: input.reason ?? "Soft deleted by manager.",
          reviewedByUserId: session.userId ?? null,
          reviewedAt: new Date(),
        },
      });
    }

    if (requestType === "DAY_OFF") {
      const row = await db.dayOffRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!row) return { success: false, error: "Day off request not found." };
      if (
        row.status !== DayOffRequestStatus.PENDING_MANAGER &&
        row.status !== DayOffRequestStatus.REJECTED
      ) {
        return {
          success: false,
          error: "Only pending or rejected day off requests can be deleted.",
        };
      }
      await db.dayOffRequest.update({
        where: { id },
        data: {
          status: DayOffRequestStatus.CANCELLED,
          managerRemarks: input.reason ?? "Soft deleted by manager.",
          reviewedByUserId: session.userId ?? null,
          reviewedAt: new Date(),
        },
      });
    }

    if (requestType === "SCHEDULE_CHANGE") {
      const row = await db.scheduleChangeRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!row) {
        return { success: false, error: "Schedule change request not found." };
      }
      if (
        row.status !== ScheduleChangeRequestStatus.PENDING_MANAGER &&
        row.status !== ScheduleChangeRequestStatus.REJECTED
      ) {
        return {
          success: false,
          error: "Only pending or rejected schedule change requests can be deleted.",
        };
      }
      await db.scheduleChangeRequest.update({
        where: { id },
        data: {
          status: ScheduleChangeRequestStatus.CANCELLED,
          managerRemarks: input.reason ?? "Soft deleted by manager.",
          reviewedByUserId: session.userId ?? null,
          reviewedAt: new Date(),
        },
      });
    }

    if (requestType === "SCHEDULE_SWAP") {
      const row = await db.scheduleSwapRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!row) {
        return { success: false, error: "Schedule swap request not found." };
      }
      if (
        row.status === ScheduleSwapRequestStatus.APPROVED ||
        row.status === ScheduleSwapRequestStatus.CANCELLED
      ) {
        return {
          success: false,
          error: "Approved or already cancelled schedule swap requests cannot be deleted.",
        };
      }
      await db.scheduleSwapRequest.update({
        where: { id },
        data: {
          status: ScheduleSwapRequestStatus.CANCELLED,
          managerRemarks: input.reason ?? "Soft deleted by manager.",
          reviewedByUserId: session.userId ?? null,
          reviewedAt: new Date(),
        },
      });
    }

    if (requestType === "GOVERNMENT_LOAN") {
      const row = await db.governmentLoanAssistanceRequest.findUnique({
        where: { id },
        select: { status: true, deductionAssignmentId: true },
      });
      if (!row) {
        return {
          success: false,
          error: "Government loan assistance request not found.",
        };
      }
      if (
        row.deductionAssignmentId ||
        row.status === GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL ||
        row.status === GovernmentLoanAssistanceRequestStatus.CANCELLED
      ) {
        return {
          success: false,
          error: "Recorded government loan requests cannot be deleted.",
        };
      }
      await db.governmentLoanAssistanceRequest.update({
        where: { id },
        data: {
          status: GovernmentLoanAssistanceRequestStatus.CANCELLED,
          managerRemarks: input.reason ?? "Soft deleted by manager.",
          reviewedByUserId: session.userId ?? null,
          reviewedAt: new Date(),
          finalizedAt: new Date(),
        },
      });
    }

    revalidateRequestLayouts();
    return { success: true };
  } catch (error) {
    console.error("Error soft deleting request:", error);
    return { success: false, error: "Failed to delete request." };
  }
}
