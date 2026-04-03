"use server";

import { ATTENDANCE_STATUS, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recomputeAttendanceForDay } from "@/lib/attendance";
import { TZ } from "@/lib/timezone";
import { DAY_MS, getRangeBounds, parseDateInput } from "./attendance-shared";

export async function setAttendanceLockState(input: {
  start: string;
  end?: string | null;
  lock: boolean;
  employeeId?: string | null;
}) {
  try {
    const startRaw = typeof input.start === "string" ? input.start : "";
    if (!startRaw) {
      return { success: false, error: "start date is required" };
    }

    const startDate = parseDateInput(startRaw);
    if (!startDate) {
      return { success: false, error: "Invalid start date" };
    }

    const endRaw =
      typeof input.end === "string" && input.end.trim() ? input.end : startRaw;
    const endDate = parseDateInput(endRaw);
    if (!endDate) {
      return { success: false, error: "Invalid end date" };
    }
    if (endDate.getTime() < startDate.getTime()) {
      return { success: false, error: "end date must be on/after start date" };
    }

    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const lock = Boolean(input.lock);

    if (employeeId) {
      const employee = await db.employee.findUnique({
        where: { employeeId },
        select: { employeeId: true },
      });
      if (!employee) {
        return { success: false, error: "Employee not found" };
      }
    }

    const { rangeStart, rangeEnd } = getRangeBounds(startDate, endDate);

    if (lock && employeeId) {
      for (
        let cursor = new Date(rangeStart);
        cursor.getTime() < rangeEnd.getTime();
        cursor = new Date(cursor.getTime() + DAY_MS)
      ) {
        const existingForDay = await db.attendance.findUnique({
          where: {
            employeeId_workDate: {
              employeeId,
              workDate: cursor,
            },
          },
          select: { id: true },
        });
        if (!existingForDay) {
          await recomputeAttendanceForDay(employeeId, cursor);
        }
      }
    }

    const whereBase: Prisma.AttendanceWhereInput = {
      workDate: { gte: rangeStart, lt: rangeEnd },
    };
    if (employeeId) {
      whereBase.employeeId = employeeId;
    }

    let updatedCount = 0;
    let blockedPayrollLinkedRows = 0;
    if (lock) {
      const incompleteUpdate = await db.attendance.updateMany({
        where: {
          ...whereBase,
          actualInAt: { not: null },
          actualOutAt: null,
        },
        data: {
          isLocked: true,
          status: ATTENDANCE_STATUS.INCOMPLETE,
        },
      });
      const completeOrAbsentUpdate = await db.attendance.updateMany({
        where: {
          ...whereBase,
          OR: [{ actualInAt: null }, { actualOutAt: { not: null } }],
        },
        data: { isLocked: true },
      });
      updatedCount = incompleteUpdate.count + completeOrAbsentUpdate.count;
    } else {
      blockedPayrollLinkedRows = await db.attendance.count({
        where: {
          ...whereBase,
          payrollPeriodId: { not: null },
        },
      });
      const unlockResult = await db.attendance.updateMany({
        where: {
          ...whereBase,
          payrollPeriodId: null,
        },
        data: { isLocked: false },
      });
      updatedCount = unlockResult.count;
    }

    const totalRows = await db.attendance.count({ where: whereBase });
    const lockedRows = await db.attendance.count({
      where: {
        ...whereBase,
        isLocked: true,
      },
    });

    return {
      success: true,
      data: {
        lock,
        employeeId,
        start: rangeStart.toISOString(),
        endExclusive: rangeEnd.toISOString(),
        updatedCount,
        blockedPayrollLinkedRows,
        totalRows,
        lockedRows,
      },
    };
  } catch (error) {
    console.error("Failed to set attendance lock state", error);
    return { success: false, error: "Failed to update lock state" };
  }
}

export async function autoLockAttendance(input?: { date?: string }) {
  try {
    const dateRaw = typeof input?.date === "string" ? input.date : null;
    const targetDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const { rangeStart: dayStart, rangeEnd: dayEnd } = getRangeBounds(targetDate);

    const candidates = await db.attendance.findMany({
      where: {
        workDate: { gte: dayStart, lt: dayEnd },
        isLocked: false,
      },
    });

    let lockedCount = 0;
    for (const attendance of candidates) {
      let status = attendance.status;
      if (attendance.actualInAt && !attendance.actualOutAt) {
        status = ATTENDANCE_STATUS.INCOMPLETE;
      }

      await db.attendance.update({
        where: { id: attendance.id },
        data: { isLocked: true, status },
      });
      lockedCount += 1;
    }

    return {
      success: true,
      data: { lockedCount, date: dayStart.toISOString(), tz: TZ },
    };
  } catch (error) {
    console.error("Failed to auto-lock attendance", error);
    return { success: false, error: "Failed to auto-lock attendance" };
  }
}
