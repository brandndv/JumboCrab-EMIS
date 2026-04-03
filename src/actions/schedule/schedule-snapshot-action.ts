"use server";

import { db } from "@/lib/db";
import { getDailySchedule } from "@/lib/schedule";
import { serializePattern, serializeShift } from "@/lib/serializers/schedule";
import { shiftSelect } from "./schedule-shared";

export async function getScheduleSnapshot(dateParam?: string) {
  try {
    const date = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const [schedule, patterns, shifts] = await Promise.all([
      getDailySchedule(date),
      db.weeklyPattern.findMany({
        where: {
          isActive: true,
          code: {
            not: {
              startsWith: "OVR-",
            },
          },
        },
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
      patterns: patterns.map((pattern) => serializePattern(pattern)),
      shifts: shifts.map((shift) => serializeShift(shift)),
    };
  } catch (error) {
    console.error("Failed to fetch schedule", error);
    return { success: false, error: "Failed to load schedule" };
  }
}
