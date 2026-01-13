"use server";

import { db } from "@/lib/db";
import { getDailySchedule } from "@/lib/schedule";
import { endOfZonedDay, startOfZonedDay, zonedNow } from "@/lib/timezone";
import { serializePattern, serializeShift } from "@/lib/serializers/schedule";

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

export async function getScheduleSnapshot(dateParam?: string) {
  try {
    const date = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const [schedule, patterns, shifts] = await Promise.all([
      getDailySchedule(date),
      db.weeklyPattern.findMany({
        orderBy: { name: "asc" },
        include: {
          sunShift: { select: shiftSelect },
          monShift: { select: shiftSelect },
          tueShift: { select: shiftSelect },
          wedShift: { select: shiftSelect },
          thuShift: { select: shiftSelect },
          friShift: { select: shiftSelect },
          satShift: { select: shiftSelect },
        },
      }),
      db.shift.findMany({ orderBy: { name: "asc" }, select: shiftSelect }),
    ]);

    const normalizedSchedule = schedule.map((entry) => ({
      employee: entry.employee,
      shift: entry.shift ? serializeShift(entry.shift) : null,
      source: entry.source,
      scheduledStartMinutes: entry.scheduledStartMinutes,
      scheduledEndMinutes: entry.scheduledEndMinutes,
    }));

    return {
      success: true,
      date: date.toISOString(),
      schedule: normalizedSchedule,
      patterns: patterns.map((p) => serializePattern(p)),
      shifts: shifts.map((s) => serializeShift(s)),
    };
  } catch (error) {
    console.error("Failed to fetch schedule", error);
    return { success: false, error: "Failed to load schedule" };
  }
}

export async function listScheduleOverrides(input?: {
  start?: string;
  end?: string;
}) {
  try {
    const startInput = input?.start ? new Date(input.start) : zonedNow();
    const endInput = input?.end ? new Date(input.end) : null;

    if (Number.isNaN(startInput.getTime())) {
      return { success: false, error: "Invalid start date" };
    }
    if (endInput && Number.isNaN(endInput.getTime())) {
      return { success: false, error: "Invalid end date" };
    }

    const start = startOfZonedDay(startInput);
    const end =
      endInput != null
        ? endOfZonedDay(endInput)
        : endOfZonedDay(new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000));

    const overrides = await db.employeeShiftOverride.findMany({
      where: {
        workDate: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { workDate: "asc" },
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
        shift: { select: shiftSelect },
      },
    });

    const data = overrides.map((o) => ({
      id: o.id,
      workDate: o.workDate.toISOString(),
      source: o.source,
      note: o.note ?? null,
      employee: o.employee,
      shift: o.shift ? serializeShift(o.shift) : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to list overrides", error);
    return { success: false, error: "Failed to load overrides" };
  }
}

export async function upsertScheduleOverride(input: {
  employeeId: string;
  workDate: string;
  shiftId?: number | null;
  source?: string | null;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    const workDateRaw = input.workDate;
    const shiftId = typeof input.shiftId === "number" ? input.shiftId : null;
    const source =
      typeof input.source === "string" && input.source.trim()
        ? input.source.trim()
        : "MANUAL";

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const workDateInput = workDateRaw ? new Date(workDateRaw) : new Date();
    if (Number.isNaN(workDateInput.getTime())) {
      return { success: false, error: "workDate is invalid" };
    }
    const workDate = startOfZonedDay(workDateInput);

    const [employee, shift] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: { employeeId: true },
      }),
      shiftId
        ? db.shift.findUnique({ where: { id: shiftId }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }
    if (shiftId && !shift) {
      return { success: false, error: "Shift not found" };
    }

    const existing = await db.employeeShiftOverride.findFirst({
      where: { employeeId, workDate },
      select: { id: true },
    });

    const data = {
      employeeId,
      workDate,
      shiftId: shiftId ?? null,
      source,
    };

    const override = existing
      ? await db.employeeShiftOverride.update({ where: { id: existing.id }, data })
      : await db.employeeShiftOverride.create({ data });

    return {
      success: true,
      data: {
        id: override.id,
        employeeId: override.employeeId,
        workDate: override.workDate.toISOString(),
        shiftId: override.shiftId,
        source: override.source,
      },
    };
  } catch (error) {
    console.error("Failed to save override", error);
    return { success: false, error: "Failed to save override" };
  }
}

export async function deleteScheduleOverride(id: string) {
  try {
    const overrideId = typeof id === "string" ? id.trim() : "";
    if (!overrideId) {
      return { success: false, error: "id is required" };
    }
    const existing = await db.employeeShiftOverride.findUnique({
      where: { id: overrideId },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Override not found" };
    }
    await db.employeeShiftOverride.delete({ where: { id: overrideId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete override", error);
    return { success: false, error: "Failed to delete override" };
  }
}

export async function assignPatternToEmployee(input: {
  employeeId: string;
  patternId: string;
  effectiveDate?: string;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    const patternId =
      typeof input.patternId === "string" && input.patternId.trim()
        ? input.patternId.trim()
        : "";
    const effectiveDateRaw = input.effectiveDate;

    if (!employeeId || !patternId) {
      return { success: false, error: "employeeId and patternId are required" };
    }

    const effectiveDate = effectiveDateRaw ? new Date(effectiveDateRaw) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
      return { success: false, error: "effectiveDate is invalid" };
    }
    effectiveDate.setHours(0, 0, 0, 0);

    const [employee, pattern] = await Promise.all([
      db.employee.findUnique({ where: { employeeId }, select: { employeeId: true } }),
      db.weeklyPattern.findUnique({ where: { id: patternId }, select: { id: true } }),
    ]);

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }
    if (!pattern) {
      return { success: false, error: "Pattern not found" };
    }

    const dayStart = new Date(effectiveDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    await db.employeePatternAssignment.deleteMany({
      where: {
        employeeId,
        effectiveDate: { gte: dayStart, lt: dayEnd },
      },
    });

    const assignment = await db.employeePatternAssignment.create({
      data: {
        employeeId,
        patternId,
        effectiveDate: dayStart,
      },
    });

    return {
      success: true,
      data: {
        id: assignment.id,
        employeeId: assignment.employeeId,
        effectiveDate: assignment.effectiveDate.toISOString(),
        patternId: assignment.patternId,
      },
    };
  } catch (error) {
    console.error("Failed to assign pattern", error);
    return { success: false, error: "Failed to assign pattern" };
  }
}
