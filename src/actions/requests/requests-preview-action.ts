"use server";

import {
  dayOffRequestSchema,
  scheduleChangeRequestSchema,
  scheduleSwapRequestSchema,
} from "@/lib/validations/requests";
import { getSession } from "@/lib/auth";
import { startOfZonedDay } from "@/lib/timezone";
import {
  buildDayOffPreview,
  buildScheduleChangePreview,
  buildScheduleSwapPreview,
  canCreateEmployeeRequests,
  getEmployeeForSession,
} from "./requests-shared";
import type {
  DayOffPreview,
  ScheduleChangePreview,
  ScheduleSwapPreview,
} from "./types";

export async function getDayOffPreview(input: {
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: DayOffPreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview day off requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = dayOffRequestSchema.safeParse({
      workDate: input.workDate,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid day off preview data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const previewResult = await buildDayOffPreview(employee.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }

    return { success: true, data: previewResult.preview };
  } catch (error) {
    console.error("Error loading day off preview:", error);
    return { success: false, error: "Failed to load day off preview." };
  }
}

export async function getScheduleSwapPreview(input: {
  coworkerEmployeeId: string;
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapPreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleSwapRequestSchema.safeParse({
      coworkerEmployeeId: input.coworkerEmployeeId,
      workDate: input.workDate,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid swap preview data.",
      };
    }

    const requester = await getEmployeeForSession(session.userId);
    if (!requester || requester.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
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

    return { success: true, data: previewResult.preview };
  } catch (error) {
    console.error("Error loading schedule swap preview:", error);
    return { success: false, error: "Failed to load schedule swap preview." };
  }
}

export async function getScheduleChangePreview(input: {
  requestedShiftId: string | number;
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: ScheduleChangePreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview schedule changes.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleChangeRequestSchema.safeParse({
      ...input,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid schedule change preview data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const previewResult = await buildScheduleChangePreview(
      employee.employeeId,
      parsed.data.requestedShiftId!,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }

    return {
      success: true,
      data: previewResult.preview,
    };
  } catch (error) {
    console.error("Error loading schedule change preview:", error);
    return { success: false, error: "Failed to load schedule change preview." };
  }
}
