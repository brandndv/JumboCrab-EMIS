"use server";

import { PUNCH_TYPE, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  createPunchAndMaybeRecompute,
  recomputeAttendanceForDay,
} from "@/lib/attendance";
import { endOfZonedDay, startOfZonedDay } from "@/lib/timezone";
import {
  getAttendanceFreezeError,
  getAttendanceFreezeStateForMoment,
  serializeAttendance,
  serializePunch,
  toDayKey,
} from "./attendance-shared";

export async function listAttendancePunches(input: { start: string }) {
  try {
    const start = typeof input.start === "string" ? input.start : "";
    if (!start) {
      return { success: false, error: "start (yyyy-mm-dd) is required" };
    }
    const parsed = new Date(`${start}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { success: false, error: "Invalid start date" };
    }
    const dayStart = startOfZonedDay(parsed);
    const dayEnd = endOfZonedDay(parsed);

    const punches = await db.punch.findMany({
      where: { punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });

    return { success: true, data: punches.map((p) => serializePunch(p)) };
  } catch (error) {
    console.error("Failed to fetch punches", error);
    return { success: false, error: "Failed to load punches" };
  }
}

export async function updatePunch(input: {
  id: string;
  punchType?: string;
  punchTime?: string;
}) {
  try {
    const id = typeof input.id === "string" ? input.id : "";
    const punchType =
      typeof input.punchType === "string" ? input.punchType : "";
    const punchTimeRaw =
      typeof input.punchTime === "string" ? input.punchTime : "";

    if (!id) {
      return { success: false, error: "id is required" };
    }

    const existing = await db.punch.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        punchTime: true,
      },
    });
    if (!existing) {
      return { success: false, error: "Punch not found" };
    }

    const originalDayState = await getAttendanceFreezeStateForMoment(
      existing.employeeId,
      existing.punchTime,
    );
    const originalDayError = getAttendanceFreezeError(
      originalDayState,
      "Attendance is locked for this day. Unlock before editing punch.",
    );
    if (originalDayError) {
      return {
        success: false,
        error: originalDayError,
      };
    }

    const data: Prisma.PunchUncheckedUpdateInput = {};
    if (punchType) {
      if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
        return { success: false, error: "Invalid punchType" };
      }
      data.punchType = punchType as PUNCH_TYPE;
    }
    if (punchTimeRaw) {
      const parsed = new Date(punchTimeRaw);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid punchTime" };
      }
      if (toDayKey(parsed) !== toDayKey(existing.punchTime)) {
        const targetDayState = await getAttendanceFreezeStateForMoment(
          existing.employeeId,
          parsed,
        );
        const targetDayError = getAttendanceFreezeError(
          targetDayState,
          "Target attendance day is locked. Unlock before moving this punch.",
        );
        if (targetDayError) {
          return {
            success: false,
            error: targetDayError,
          };
        }
      }
      data.punchTime = parsed;
    }

    if (Object.keys(data).length === 0) {
      return { success: false, error: "No fields to update" };
    }

    const updated = await db.punch.update({
      where: { id },
      data,
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });

    if (updated.employeeId && updated.punchTime) {
      await recomputeAttendanceForDay(updated.employeeId, updated.punchTime);
    }

    return { success: true, data: serializePunch(updated) };
  } catch (error) {
    console.error("Failed to update punch", error);
    return { success: false, error: "Failed to update punch" };
  }
}

export async function deletePunch(input: { id: string }) {
  try {
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
    }

    const existing = await db.punch.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        punchTime: true,
      },
    });
    if (!existing) {
      return { success: false, error: "Punch not found" };
    }

    const dayState = await getAttendanceFreezeStateForMoment(
      existing.employeeId,
      existing.punchTime,
    );
    const dayError = getAttendanceFreezeError(
      dayState,
      "Attendance is locked for this day. Unlock before deleting punch.",
    );
    if (dayError) {
      return {
        success: false,
        error: dayError,
      };
    }

    await db.punch.delete({ where: { id } });
    await recomputeAttendanceForDay(existing.employeeId, existing.punchTime);

    return {
      success: true,
      data: {
        id: existing.id,
        employeeId: existing.employeeId,
      },
    };
  } catch (error) {
    console.error("Failed to delete punch", error);
    return { success: false, error: "Failed to delete punch" };
  }
}

export async function recordAttendancePunch(input: {
  employeeId: string;
  punchType: string;
  punchTime?: string;
  source?: string | null;
  recompute?: boolean;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    const punchType =
      typeof input.punchType === "string" ? input.punchType : "";
    const punchTimeRaw = input.punchTime;
    const source = typeof input.source === "string" ? input.source : null;
    const recompute = Boolean(input.recompute);

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return { success: false, error: "punchType is invalid" };
    }

    const punchTime = punchTimeRaw ? new Date(punchTimeRaw) : new Date();
    if (Number.isNaN(punchTime.getTime())) {
      return { success: false, error: "punchTime is invalid" };
    }

    const dayState = await getAttendanceFreezeStateForMoment(
      employeeId,
      punchTime,
    );
    const dayError = getAttendanceFreezeError(
      dayState,
      "Attendance is locked for this day. Unlock before recording punch.",
    );
    if (dayError) {
      return {
        success: false,
        error: dayError,
      };
    }

    const { punch, attendance } = await createPunchAndMaybeRecompute({
      employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime,
      source,
      recompute,
    });

    return {
      success: true,
      data: {
        punch: serializePunch(punch),
        attendance: attendance ? serializeAttendance(attendance) : null,
      },
    };
  } catch (error) {
    console.error("Failed to record punch", error);
    return { success: false, error: "Failed to record punch" };
  }
}
