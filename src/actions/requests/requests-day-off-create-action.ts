"use server";

import {
  DayOffRequestStatus,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { dayOffRequestSchema } from "@/lib/validations/requests";
import {
  buildDayOffPreview,
  canCreateEmployeeRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeDayOffRequest,
} from "./requests-shared";
import type { DayOffRequestPayload, DayOffRequestRow } from "./types";

export async function createDayOffRequest(
  input: DayOffRequestPayload,
): Promise<{
  success: boolean;
  data?: DayOffRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create day off requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = dayOffRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid day off request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const today = startOfZonedDay(new Date());
    if (workDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Day off requests can only be submitted for today or future dates.",
      };
    }

    const previewResult = await buildDayOffPreview(employee.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error: "You are already not scheduled to work on that date.",
      };
    }

    const [blockingIssue, duplicate, changeConflict, swapConflict] =
      await Promise.all([
        getScheduleSwapBlockingIssue(
          employee.employeeId,
          workDate,
          previewResult.preview.employee.employeeName,
        ),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            workDate,
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
        db.scheduleChangeRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            workDate,
            status: {
              in: [
                ScheduleChangeRequestStatus.PENDING_MANAGER,
                ScheduleChangeRequestStatus.APPROVED,
              ],
            },
          },
          select: { id: true },
        }),
        db.scheduleSwapRequest.findFirst({
          where: {
            workDate,
            status: {
              in: [
                ScheduleSwapRequestStatus.PENDING_COWORKER,
                ScheduleSwapRequestStatus.PENDING_MANAGER,
                ScheduleSwapRequestStatus.APPROVED,
              ],
            },
            OR: [
              { requesterEmployeeId: employee.employeeId },
              { coworkerEmployeeId: employee.employeeId },
            ],
          },
          select: { id: true },
        }),
      ]);

    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error: "There is already an active day off request for that date.",
      };
    }
    if (changeConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule change request for that date.",
      };
    }
    if (swapConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request involving you on that date.",
      };
    }

    const created = await db.dayOffRequest.create({
      data: {
        employeeId: employee.employeeId,
        workDate,
        currentShiftIdSnapshot: previewResult.currentSnapshot.shiftId,
        currentShiftCodeSnapshot: previewResult.currentSnapshot.shiftCode,
        currentShiftNameSnapshot: previewResult.currentSnapshot.shiftName,
        currentStartMinutesSnapshot: previewResult.currentSnapshot.startMinutes,
        currentEndMinutesSnapshot: previewResult.currentSnapshot.endMinutes,
        currentSpansMidnightSnapshot:
          previewResult.currentSnapshot.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: DayOffRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeDayOffRequest(created) };
  } catch (error) {
    console.error("Error creating day off request:", error);
    return { success: false, error: "Failed to create day off request." };
  }
}
