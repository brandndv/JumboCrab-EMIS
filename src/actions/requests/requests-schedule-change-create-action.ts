"use server";

import {
  DayOffRequestStatus,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { scheduleChangeRequestSchema } from "@/lib/validations/requests";
import {
  buildScheduleChangePreview,
  canCreateEmployeeRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeScheduleChangeRequest,
} from "./requests-shared";
import type {
  ScheduleChangeRequestPayload,
  ScheduleChangeRequestRow,
} from "./types";

export async function createScheduleChangeRequest(
  input: ScheduleChangeRequestPayload,
): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create schedule change requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleChangeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid schedule change data.",
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
        error: "Schedule changes can only be requested for today or future dates.",
      };
    }

    const previewResult = await buildScheduleChangePreview(
      employee.employeeId,
      parsed.data.requestedShiftId!,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "Your requested shift is already assigned on that date, so there is nothing to change.",
      };
    }

    const [blockingIssue, duplicate, dayOffConflict, swapConflict] =
      await Promise.all([
        getScheduleSwapBlockingIssue(
          employee.employeeId,
          workDate,
          previewResult.preview.employee.employeeName,
        ),
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
        error:
          "There is already an active schedule change request for that date.",
      };
    }
    if (dayOffConflict) {
      return {
        success: false,
        error: "There is already an active day off request for that date.",
      };
    }
    if (swapConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request involving you on that date.",
      };
    }

    const created = await db.scheduleChangeRequest.create({
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
        requestedShiftId: previewResult.requestedShift.id,
        requestedShiftCodeSnapshot: previewResult.requestedShift.code,
        requestedShiftNameSnapshot: previewResult.requestedShift.name,
        requestedStartMinutesSnapshot: previewResult.requestedShift.startMinutes,
        requestedEndMinutesSnapshot: previewResult.requestedShift.endMinutes,
        requestedSpansMidnightSnapshot:
          previewResult.requestedShift.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: ScheduleChangeRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeScheduleChangeRequest(created) };
  } catch (error) {
    console.error("Error creating schedule change request:", error);
    return {
      success: false,
      error: "Failed to create schedule change request.",
    };
  }
}
