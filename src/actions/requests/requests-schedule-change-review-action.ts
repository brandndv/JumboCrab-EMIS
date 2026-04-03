"use server";

import { ScheduleChangeRequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import { cashAdvanceReviewSchema } from "@/lib/validations/requests";
import {
  buildScheduleChangePreview,
  canReviewRequests,
  employeeRequestSelect,
  getScheduleSwapBlockingIssue,
  revalidateRequestLayouts,
  reviewedBySelect,
  scheduleSwapEmployeeSelect,
  serializeScheduleChangeRequest,
  toEmployeeName,
} from "./requests-shared";
import type {
  RequestReviewPayload,
  ScheduleChangeRequestRow,
} from "./types";

export async function reviewScheduleChangeRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review schedule change requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.scheduleChangeRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: { select: scheduleSwapEmployeeSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Schedule change request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== ScheduleChangeRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending schedule change requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.scheduleChangeRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleChangeRequestStatus.REJECTED,
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
      return { success: true, data: serializeScheduleChangeRequest(reviewed) };
    }

    const workDate = startOfZonedDay(existing.workDate);
    const previewResult = await buildScheduleChangePreview(
      existing.employeeId,
      existing.requestedShiftId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "The employee is already assigned to that shift on the requested date.",
      };
    }
    if (previewResult.currentSnapshot.shiftId !== existing.currentShiftIdSnapshot) {
      return {
        success: false,
        error:
          "The employee's schedule changed after the request was submitted. Ask them to submit a new schedule change request.",
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
          shiftId: existing.requestedShiftId,
          source: "APPROVED_REQUEST",
          note: `Schedule change approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.employeeId,
          workDate,
          shiftId: existing.requestedShiftId,
          source: "APPROVED_REQUEST",
          note: `Schedule change approved from request ${existing.id}`,
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
            expectedShiftId: existing.requestedShiftId,
            scheduledStartMinutes: existing.requestedStartMinutesSnapshot,
            scheduledEndMinutes: existing.requestedEndMinutesSnapshot,
          },
        });
      }

      return tx.scheduleChangeRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleChangeRequestStatus.APPROVED,
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
    return { success: true, data: serializeScheduleChangeRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing schedule change request:", error);
    return {
      success: false,
      error: "Failed to review schedule change request.",
    };
  }
}
