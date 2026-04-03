"use server";

import {
  DayOffRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { scheduleSwapRequestSchema } from "@/lib/validations/requests";
import {
  buildScheduleSwapPreview,
  canCreateEmployeeRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeScheduleSwapRequest,
} from "./requests-shared";
import type {
  ScheduleSwapRequestPayload,
  ScheduleSwapRequestRow,
} from "./types";

export async function createScheduleSwapRequest(
  input: ScheduleSwapRequestPayload,
): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create schedule swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleSwapRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid schedule swap data.",
      };
    }

    const requester = await getEmployeeForSession(session.userId);
    if (!requester || requester.isArchived) {
      return { success: false, error: "Employee record not found." };
    }
    if (requester.employeeId === parsed.data.coworkerEmployeeId) {
      return {
        success: false,
        error: "You cannot request a schedule swap with yourself.",
      };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const today = startOfZonedDay(new Date());
    if (workDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Schedule swaps can only be requested for today or future dates.",
      };
    }

    const previewResult = await buildScheduleSwapPreview(
      requester.employeeId,
      parsed.data.coworkerEmployeeId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "Both employees already have the same schedule on that date, so there is nothing to swap.",
      };
    }

    const [requesterIssue, coworkerIssue, duplicate, requesterDayOff, coworkerDayOff] =
      await Promise.all([
        getScheduleSwapBlockingIssue(
          previewResult.requesterEmployee.employeeId,
          workDate,
          previewResult.preview.requester.employeeName,
        ),
        getScheduleSwapBlockingIssue(
          previewResult.coworkerEmployee.employeeId,
          workDate,
          previewResult.preview.coworker.employeeName,
        ),
        db.scheduleSwapRequest.findFirst({
          where: {
            workDate,
            status: {
              in: [
                ScheduleSwapRequestStatus.PENDING_COWORKER,
                ScheduleSwapRequestStatus.PENDING_MANAGER,
              ],
            },
            OR: [
              {
                requesterEmployeeId: previewResult.requesterEmployee.employeeId,
                coworkerEmployeeId: previewResult.coworkerEmployee.employeeId,
              },
              {
                requesterEmployeeId: previewResult.coworkerEmployee.employeeId,
                coworkerEmployeeId: previewResult.requesterEmployee.employeeId,
              },
            ],
          },
          select: { id: true },
        }),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: previewResult.requesterEmployee.employeeId,
            workDate,
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: previewResult.coworkerEmployee.employeeId,
            workDate,
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
      ]);

    if (requesterIssue) {
      return { success: false, error: requesterIssue };
    }
    if (coworkerIssue) {
      return { success: false, error: coworkerIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request between these employees on that date.",
      };
    }
    if (requesterDayOff) {
      return {
        success: false,
        error: "You already have an active day off request on that date.",
      };
    }
    if (coworkerDayOff) {
      return {
        success: false,
        error:
          "The selected coworker already has an active day off request on that date.",
      };
    }

    const created = await db.scheduleSwapRequest.create({
      data: {
        requesterEmployeeId: previewResult.requesterEmployee.employeeId,
        coworkerEmployeeId: previewResult.coworkerEmployee.employeeId,
        workDate,
        requesterShiftIdSnapshot: previewResult.requesterSnapshot.shiftId,
        requesterShiftCodeSnapshot: previewResult.requesterSnapshot.shiftCode,
        requesterShiftNameSnapshot: previewResult.requesterSnapshot.shiftName,
        requesterStartMinutesSnapshot: previewResult.requesterSnapshot.startMinutes,
        requesterEndMinutesSnapshot: previewResult.requesterSnapshot.endMinutes,
        requesterSpansMidnightSnapshot:
          previewResult.requesterSnapshot.spansMidnight,
        coworkerShiftIdSnapshot: previewResult.coworkerSnapshot.shiftId,
        coworkerShiftCodeSnapshot: previewResult.coworkerSnapshot.shiftCode,
        coworkerShiftNameSnapshot: previewResult.coworkerSnapshot.shiftName,
        coworkerStartMinutesSnapshot: previewResult.coworkerSnapshot.startMinutes,
        coworkerEndMinutesSnapshot: previewResult.coworkerSnapshot.endMinutes,
        coworkerSpansMidnightSnapshot:
          previewResult.coworkerSnapshot.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: ScheduleSwapRequestStatus.PENDING_COWORKER,
      },
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return {
      success: true,
      data: serializeScheduleSwapRequest(created, requester.employeeId),
    };
  } catch (error) {
    console.error("Error creating schedule swap request:", error);
    return { success: false, error: "Failed to create schedule swap request." };
  }
}
