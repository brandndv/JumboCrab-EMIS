"use server";

import { db } from "@/lib/db";
import { recomputeAttendanceForDay } from "@/lib/attendance";
import { endOfZonedDay, startOfZonedDay, TZ } from "@/lib/timezone";
import { serializeAttendance } from "./attendance-shared";

export async function recomputeAttendance(input: {
  employeeId: string;
  workDate?: string;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    const workDateRaw = input.workDate;

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const workDate = workDateRaw ? new Date(workDateRaw) : new Date();
    if (Number.isNaN(workDate.getTime())) {
      return { success: false, error: "workDate is invalid" };
    }
    const dayStart = startOfZonedDay(workDate);
    const frozen = await db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: dayStart,
        },
      },
      select: {
        isLocked: true,
        payrollPeriodId: true,
      },
    });
    if (frozen?.payrollPeriodId) {
      return {
        success: false,
        error:
          "Attendance is already linked to payroll for this day. Use payroll adjustments.",
      };
    }
    if (frozen?.isLocked) {
      return {
        success: false,
        error: "Attendance is locked for this day. Unlock before recomputing.",
      };
    }

    const result = await recomputeAttendanceForDay(employeeId, workDate);

    return {
      success: true,
      data: serializeAttendance(result.attendance),
    };
  } catch (error) {
    console.error("Failed to recompute attendance", error);
    return { success: false, error: "Failed to recompute attendance" };
  }
}

export async function recomputeAttendanceForDate(input?: { date?: string }) {
  try {
    const dateRaw = typeof input?.date === "string" ? input.date : null;
    const targetDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const dayStart = startOfZonedDay(targetDate);
    const dayEnd = endOfZonedDay(targetDate);
    const employees = await db.employee.findMany({
      where: { isArchived: false },
      select: { employeeId: true },
    });
    const frozenRows = await db.attendance.findMany({
      where: {
        workDate: { gte: dayStart, lt: dayEnd },
        OR: [{ isLocked: true }, { payrollPeriodId: { not: null } }],
      },
      select: { employeeId: true },
    });
    const frozenSet = new Set(frozenRows.map((row) => row.employeeId));
    const targets = employees.filter(
      (employee) => !frozenSet.has(employee.employeeId),
    );

    await Promise.all(
      targets.map((employee) =>
        recomputeAttendanceForDay(employee.employeeId, dayStart),
      ),
    );

    return {
      success: true,
      data: {
        processedCount: targets.length,
        skippedLockedCount: employees.length - targets.length,
        date: dayStart.toISOString(),
        tz: TZ,
      },
    };
  } catch (error) {
    console.error("Failed to recompute attendance for date", error);
    return { success: false, error: "Failed to recompute attendance" };
  }
}
