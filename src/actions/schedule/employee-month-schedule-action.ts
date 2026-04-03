"use server";

import { ATTENDANCE_STATUS } from "@prisma/client";
import { db } from "@/lib/db";
import { getExpectedShiftForDate } from "@/lib/attendance";
import { serializeShift } from "@/lib/serializers/schedule";
import {
  endOfZonedDay,
  startOfZonedDay,
  TZ,
  zonedNow,
} from "@/lib/timezone";
import { toTzDateKey } from "./schedule-shared";

export async function getEmployeeMonthSchedule(input: {
  employeeId: string;
  anchorDate?: string | null;
}) {
  try {
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId.trim() : "";
    const anchorDateRaw =
      typeof input?.anchorDate === "string" ? input.anchorDate : "";

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true },
    });
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const anchorDate = anchorDateRaw ? new Date(anchorDateRaw) : zonedNow();
    if (Number.isNaN(anchorDate.getTime())) {
      return { success: false, error: "Invalid anchorDate" };
    }

    const anchorInTz = new Date(
      anchorDate.toLocaleString("en-US", { timeZone: TZ }),
    );
    const year = anchorInTz.getFullYear();
    const monthIndex = anchorInTz.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const monthDates = Array.from({ length: daysInMonth }, (_, index) =>
      new Date(Date.UTC(year, monthIndex, index + 1, 12, 0, 0)),
    );
    const monthStart = startOfZonedDay(monthDates[0]);
    const monthEnd = endOfZonedDay(monthDates[monthDates.length - 1]);

    const leaveAttendances = await db.attendance.findMany({
      where: {
        employeeId,
        workDate: {
          gte: monthStart,
          lt: monthEnd,
        },
        status: ATTENDANCE_STATUS.LEAVE,
      },
      select: {
        workDate: true,
        isPaidLeave: true,
        leaveRequestId: true,
        leaveRequest: {
          select: {
            leaveType: true,
          },
        },
      },
    });

    const leaveByDate = new Map(
      leaveAttendances.map((row) => [
        toTzDateKey(row.workDate),
        {
          requestId: row.leaveRequestId,
          leaveType: row.leaveRequest?.leaveType ?? "PERSONAL",
          isPaidLeave: row.isPaidLeave,
        },
      ]),
    );

    const days = await Promise.all(
      monthDates.map(async (date) => {
        const expected = await getExpectedShiftForDate(employeeId, date);
        return {
          date: toTzDateKey(date),
          shift: expected.shift ? serializeShift(expected.shift) : null,
          source: expected.source,
          leave: leaveByDate.get(toTzDateKey(date)) ?? null,
          scheduledStartMinutes: expected.scheduledStartMinutes,
          scheduledEndMinutes: expected.scheduledEndMinutes,
        };
      }),
    );

    return {
      success: true,
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      days,
    };
  } catch (error) {
    console.error("Failed to fetch employee month schedule", error);
    return { success: false, error: "Failed to load employee schedule" };
  }
}
