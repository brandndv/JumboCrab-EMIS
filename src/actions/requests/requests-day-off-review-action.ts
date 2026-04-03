"use server";

import { ATTENDANCE_STATUS, DayOffRequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { cashAdvanceReviewSchema } from "@/lib/validations/requests";
import {
  buildDayOffPreview,
  canReviewRequests,
  employeeRequestSelect,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  scheduleSwapEmployeeSelect,
  serializeDayOffRequest,
  toEmployeeName,
} from "./requests-shared";
import type { DayOffRequestRow, RequestReviewPayload } from "./types";

export async function reviewDayOffRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: DayOffRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review day off requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.dayOffRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: { select: scheduleSwapEmployeeSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Day off request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== DayOffRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending day off requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.dayOffRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: DayOffRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeDayOffRequest(reviewed) };
    }

    const workDate = startOfZonedDay(existing.workDate);
    const previewResult = await buildDayOffPreview(existing.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error: "The employee is already not scheduled to work on that date.",
      };
    }
    if (previewResult.currentSnapshot.shiftId !== existing.currentShiftIdSnapshot) {
      return {
        success: false,
        error:
          "The employee's schedule changed after the request was submitted. Ask them to submit a new day off request.",
      };
    }

    const blockingIssue = await getScheduleSwapBlockingIssue(
      existing.employeeId,
      workDate,
      toEmployeeName(existing.employee),
    );
    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }

    const reviewed = await db.$transaction(async (tx) => {
      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        update: {
          shiftId: null,
          source: "APPROVED_REQUEST",
          note: `Day off approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.employeeId,
          workDate,
          shiftId: null,
          source: "APPROVED_REQUEST",
          note: `Day off approved from request ${existing.id}`,
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        select: { id: true },
      });

      if (existingAttendance) {
        await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: ATTENDANCE_STATUS.REST,
            isPaidLeave: false,
            leaveRequestId: null,
            expectedShiftId: null,
            scheduledStartMinutes: null,
            scheduledEndMinutes: null,
            paidHoursPerDay: null,
          },
        });
      }

      return tx.dayOffRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: DayOffRequestStatus.APPROVED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeDayOffRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing day off request:", error);
    return { success: false, error: "Failed to review day off request." };
  }
}
