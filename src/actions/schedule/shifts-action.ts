"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { serializeShift } from "@/lib/serializers/schedule";

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const computeBreakAndPaid = (
  startMinutes: number,
  endMinutes: number,
  spansMidnight: boolean,
  breakStartMinutes: number | null,
  breakEndMinutes: number | null
) => {
  let totalMinutes =
    spansMidnight && endMinutes <= startMinutes
      ? endMinutes + 24 * 60 - startMinutes
      : endMinutes - startMinutes;
  if (totalMinutes < 0) totalMinutes = 0;

  let breakMinutes = 0;
  if (breakStartMinutes != null && breakEndMinutes != null) {
    let endVal = breakEndMinutes;
    if (spansMidnight && breakEndMinutes <= breakStartMinutes) {
      endVal += 24 * 60;
    }
    breakMinutes = Math.max(0, Math.min(totalMinutes, endVal - breakStartMinutes));
  }

  const paidHours =
    totalMinutes > 0 ? Number(((totalMinutes - breakMinutes) / 60).toFixed(2)) : 0;

  return { breakMinutes, paidHours, totalMinutes };
};

const shiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinutes: true,
  endMinutes: true,
  spansMidnight: true,
  breakStartMinutes: true,
  breakEndMinutes: true,
  breakMinutesUnpaid: true,
  paidHoursPerDay: true,
  notes: true,
};

export async function listShifts() {
  try {
    const shifts = await db.shift.findMany({
      orderBy: { name: "asc" },
      select: shiftSelect,
    });
    return { success: true, data: shifts.map((s) => serializeShift(s)) };
  } catch (error) {
    console.error("Failed to list shifts", error);
    return { success: false, error: "Failed to load shifts" };
  }
}

export async function createShift(input: {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  spansMidnight?: boolean;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  notes?: string | null;
}) {
  try {
    const code = typeof input.code === "string" ? input.code.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const startMinutes = parseTimeToMinutes(input.startTime);
    const endMinutes = parseTimeToMinutes(input.endTime);
    const spansMidnight = Boolean(input.spansMidnight);
    const breakStartMinutes = parseTimeToMinutes(input.breakStartTime);
    const breakEndMinutes = parseTimeToMinutes(input.breakEndTime);
    const notes =
      typeof input.notes === "string" ? input.notes.trim() : null;

    if (!code || !name) {
      return { success: false, error: "code and name are required" };
    }
    if (startMinutes == null || endMinutes == null) {
      return { success: false, error: "startTime and endTime must be HH:mm" };
    }
    if (!spansMidnight && endMinutes <= startMinutes) {
      return {
        success: false,
        error: "endTime must be after startTime unless spansMidnight is true",
      };
    }

    const derived = computeBreakAndPaid(
      startMinutes,
      endMinutes,
      spansMidnight,
      breakStartMinutes,
      breakEndMinutes
    );

    const shift = await db.shift.create({
      data: {
        code,
        name,
        startMinutes,
        endMinutes,
        spansMidnight,
        breakStartMinutes,
        breakEndMinutes,
        breakMinutesUnpaid: derived.breakMinutes,
        paidHoursPerDay: new Prisma.Decimal(derived.paidHours.toFixed(2)),
        notes,
      },
      select: shiftSelect,
    });

    return { success: true, data: serializeShift(shift) };
  } catch (error) {
    console.error("Failed to create shift", error);
    return { success: false, error: "Failed to create shift" };
  }
}

export async function updateShift(input: {
  id: number;
  code?: string;
  name?: string;
  startTime?: string | null;
  endTime?: string | null;
  spansMidnight?: boolean;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  notes?: string | null;
}) {
  try {
    const id = typeof input.id === "number" ? input.id : null;
    if (!id) {
      return { success: false, error: "id is required" };
    }

    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Shift not found" };
    }

    const code =
      typeof input.code === "string" && input.code.trim()
        ? input.code.trim()
        : existing.code;
    const name =
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : existing.name;
    const startMinutes =
      input.startTime != null ? parseTimeToMinutes(input.startTime) : existing.startMinutes;
    const endMinutes =
      input.endTime != null ? parseTimeToMinutes(input.endTime) : existing.endMinutes;
    const spansMidnight =
      typeof input.spansMidnight === "boolean"
        ? input.spansMidnight
        : existing.spansMidnight;
    const breakStartMinutes =
      input.breakStartTime != null
        ? parseTimeToMinutes(input.breakStartTime)
        : existing.breakStartMinutes;
    const breakEndMinutes =
      input.breakEndTime != null
        ? parseTimeToMinutes(input.breakEndTime)
        : existing.breakEndMinutes;
    const notes =
      typeof input.notes === "string" ? input.notes.trim() : existing.notes ?? null;

    if (!code || !name) {
      return { success: false, error: "code and name are required" };
    }
    if (startMinutes == null || endMinutes == null) {
      return { success: false, error: "startTime and endTime must be HH:mm" };
    }
    if (!spansMidnight && endMinutes <= startMinutes) {
      return {
        success: false,
        error: "endTime must be after startTime unless spansMidnight is true",
      };
    }

    const derived = computeBreakAndPaid(
      startMinutes,
      endMinutes,
      spansMidnight,
      breakStartMinutes,
      breakEndMinutes
    );

    const shift = await db.shift.update({
      where: { id },
      data: {
        code,
        name,
        startMinutes,
        endMinutes,
        spansMidnight,
        breakStartMinutes,
        breakEndMinutes,
        breakMinutesUnpaid: derived.breakMinutes,
        paidHoursPerDay: new Prisma.Decimal(derived.paidHours.toFixed(2)),
        notes,
      },
      select: shiftSelect,
    });

    return { success: true, data: serializeShift(shift) };
  } catch (error) {
    console.error("Failed to update shift", error);
    return { success: false, error: "Failed to update shift" };
  }
}

export async function deleteShift(id: number) {
  try {
    if (!id || Number.isNaN(Number(id))) {
      return { success: false, error: "id is required" };
    }
    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Shift not found" };
    }
    await db.shift.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete shift", error);
    return { success: false, error: "Failed to delete shift" };
  }
}
