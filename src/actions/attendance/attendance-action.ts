"use server";

import { ATTENDANCE_STATUS, PUNCH_TYPE, type Attendance, type Punch } from "@prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  createPunchAndMaybeRecompute,
  getExpectedShiftForDate,
  recomputeAttendanceForDay,
} from "@/lib/attendance";
import { endOfZonedDay, startOfZonedDay, TZ, zonedNow } from "@/lib/timezone";

type EmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

type AttendanceRecord = Attendance & {
  employee?: EmployeeSummary | null;
  expectedShift?: { name: string | null } | null;
};

type PunchRecord = Punch & {
  employee?: EmployeeSummary | null;
};

type AttendanceOverrides = {
  actualInAt?: Date | string | null;
  actualOutAt?: Date | string | null;
  expectedShiftId?: number | null;
  expectedShiftName?: string | null;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  breakCount?: number;
  breakMinutes?: number;
  punchesCount?: number;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  workedMinutes?: number | null;
};

const hasOverride = (
  overrides: AttendanceOverrides | undefined,
  key: keyof AttendanceOverrides
) => Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, key));

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

const toStringOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return null;
};

const serializePunch = (punch: PunchRecord) => {
  return {
    id: punch.id,
    employeeId: punch.employeeId,
    attendanceId: punch.attendanceId ?? null,
    punchTime: punch.punchTime.toISOString(),
    punchType: punch.punchType,
    source: punch.source ?? null,
    deviceId: punch.deviceId ?? null,
    createdAt: punch.createdAt.toISOString(),
    updatedAt: punch.updatedAt.toISOString(),
    employee: punch.employee ?? null,
  };
};

const serializePunchNullable = (punch: PunchRecord | null) =>
  punch ? serializePunch(punch) : null;

const serializeAttendance = (
  record: AttendanceRecord,
  overrides?: AttendanceOverrides
) => {
  const actualInAt = hasOverride(overrides, "actualInAt")
    ? overrides?.actualInAt ?? null
    : record.actualInAt ?? null;
  const actualOutAt = hasOverride(overrides, "actualOutAt")
    ? overrides?.actualOutAt ?? null
    : record.actualOutAt ?? null;
  const expectedShiftId = hasOverride(overrides, "expectedShiftId")
    ? overrides?.expectedShiftId ?? null
    : record.expectedShiftId ?? null;
  const expectedShiftName = hasOverride(overrides, "expectedShiftName")
    ? overrides?.expectedShiftName ?? null
    : record.expectedShift?.name ?? null;
  const scheduledStartMinutes = hasOverride(overrides, "scheduledStartMinutes")
    ? overrides?.scheduledStartMinutes ?? null
    : record.scheduledStartMinutes ?? null;
  const scheduledEndMinutes = hasOverride(overrides, "scheduledEndMinutes")
    ? overrides?.scheduledEndMinutes ?? null
    : record.scheduledEndMinutes ?? null;
  const breakCount = hasOverride(overrides, "breakCount")
    ? overrides?.breakCount ?? 0
    : record.breakCount ?? 0;
  const breakMinutes = hasOverride(overrides, "breakMinutes")
    ? overrides?.breakMinutes ?? 0
    : record.breakMinutes ?? 0;
  const punchesCount = hasOverride(overrides, "punchesCount")
    ? overrides?.punchesCount ?? 0
    : 0;
  const lateMinutes = hasOverride(overrides, "lateMinutes")
    ? overrides?.lateMinutes ?? null
    : record.lateMinutes ?? null;
  const undertimeMinutes = hasOverride(overrides, "undertimeMinutes")
    ? overrides?.undertimeMinutes ?? null
    : record.undertimeMinutes ?? null;
  const overtimeMinutesRaw = hasOverride(overrides, "overtimeMinutesRaw")
    ? overrides?.overtimeMinutesRaw ?? null
    : record.overtimeMinutesRaw ?? null;
  const workedMinutes = hasOverride(overrides, "workedMinutes")
    ? overrides?.workedMinutes ?? null
    : record.workedMinutes ?? null;

  return {
    id: record.id,
    employeeId: record.employeeId,
    workDate: record.workDate.toISOString(),
    status: record.status,
    expectedShiftId,
    expectedShiftName,
    scheduledStartMinutes,
    scheduledEndMinutes,
    paidHoursPerDay: toStringOrNull(record.paidHoursPerDay),
    actualInAt: toIsoString(actualInAt),
    actualOutAt: toIsoString(actualOutAt),
    workedMinutes,
    breakMinutes,
    breakCount,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutesRaw,
    overtimeMinutesApproved: record.overtimeMinutesApproved ?? 0,
    nightMinutes: record.nightMinutes ?? 0,
    isLocked: record.isLocked,
    payrollPeriodId: record.payrollPeriodId ?? null,
    punchesCount,
    employee: record.employee ?? null,
    expectedShift: record.expectedShift ?? null,
  };
};

const computeBreakStats = (punches: Array<PunchRecord | Punch>) => {
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;
  punches.forEach((p) => {
    if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
      if (!breakStart) {
        breakStart = p.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(
          0,
          Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000)
        );
        breakStart = null;
      }
    }
  });
  return { breakCount, breakMinutes };
};

const isIpAllowed = (ip: string | null) => {
  const raw = process.env.ALLOWED_PUNCH_IPS;
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return Boolean(ip && list.includes(ip));
};

export async function listAttendance(input?: {
  start?: string | null;
  end?: string | null;
  employeeId?: string | null;
  status?: string | null;
  includeAll?: boolean;
}) {
  try {
    const start = typeof input?.start === "string" ? input.start : null;
    const end = typeof input?.end === "string" ? input.end : null;
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId : null;
    const status = typeof input?.status === "string" ? input.status : null;
    const includeAll = Boolean(input?.includeAll);
    const singleDay = Boolean(start && end && start === end);

    const where: Record<string, any> = {};
    if (start || end) {
      const workDate: Record<string, Date> = {};
      if (start) {
        const parsedStart = new Date(start);
        if (!Number.isNaN(parsedStart.getTime())) {
          workDate.gte = startOfZonedDay(parsedStart);
        }
      }
      if (end) {
        const parsedEnd = new Date(end);
        if (!Number.isNaN(parsedEnd.getTime())) {
          workDate.lt = endOfZonedDay(parsedEnd);
        }
      }
      if (Object.keys(workDate).length > 0) {
        where.workDate = workDate;
      }
    }

    if (employeeId) where.employeeId = employeeId;
    if (
      status &&
      Object.values(ATTENDANCE_STATUS).includes(status as ATTENDANCE_STATUS)
    ) {
      where.status = status as ATTENDANCE_STATUS;
    }

    const records = await db.attendance.findMany({
      where,
      orderBy: { workDate: "desc" },
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
        expectedShift: { select: { name: true } },
      },
    });

    const enriched = await Promise.all(
      records.map(async (record) => {
        const localDisplay = new Date(
          new Date(record.workDate).toLocaleString("en-US", { timeZone: TZ })
        );
        localDisplay.setHours(0, 0, 0, 0);
        const dayStart = startOfZonedDay(localDisplay);
        const dayEnd = endOfZonedDay(localDisplay);

        const punches = await db.punch.findMany({
          where: {
            employeeId: record.employeeId,
            punchTime: { gte: dayStart, lt: dayEnd },
          },
          orderBy: { punchTime: "asc" },
        });
        const { breakCount, breakMinutes } = computeBreakStats(punches);

        const expected = await getExpectedShiftForDate(
          record.employeeId,
          dayStart
        );
        const expectedStart = expected.scheduledStartMinutes ?? null;
        const expectedEnd = expected.scheduledEndMinutes ?? null;

        const firstClockIn =
          punches.find((p) => p.punchType === "TIME_IN") ?? null;
        const lastClockOut =
          [...punches].reverse().find((p) => p.punchType === "TIME_OUT") ?? null;

        const actualInAt = firstClockIn?.punchTime ?? record.actualInAt ?? null;
        const actualOutAt = lastClockOut?.punchTime ?? null;
        const actualInMinutes = actualInAt
          ? Math.round((actualInAt.getTime() - dayStart.getTime()) / 60000)
          : null;
        const actualOutMinutes = actualOutAt
          ? Math.round((actualOutAt.getTime() - dayStart.getTime()) / 60000)
          : null;

        const lateMinutes =
          expectedStart != null && actualInMinutes != null
            ? Math.max(0, actualInMinutes - expectedStart)
            : record.lateMinutes ?? null;
        const undertimeMinutes =
          expectedEnd != null && actualOutMinutes != null
            ? Math.max(0, expectedEnd - actualOutMinutes)
            : null;
        const overtimeMinutesRaw =
          expectedEnd != null && actualOutMinutes != null
            ? Math.max(0, actualOutMinutes - expectedEnd)
            : null;
        const workedMinutes =
          actualInAt && actualOutAt
            ? Math.max(
                0,
                Math.round((actualOutAt.getTime() - actualInAt.getTime()) / 60000)
              )
            : null;

        return serializeAttendance(record, {
          breakCount: breakCount || record.breakCount || 0,
          breakMinutes: breakMinutes || record.breakMinutes || 0,
          actualInAt,
          actualOutAt,
          expectedShiftId: expected.shift?.id ?? record.expectedShiftId ?? null,
          expectedShiftName:
            expected.shift?.name ?? record.expectedShift?.name ?? null,
          scheduledStartMinutes: expectedStart,
          scheduledEndMinutes: expectedEnd,
          punchesCount: punches.length,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutesRaw,
          workedMinutes,
        });
      })
    );

    if (includeAll && singleDay && start) {
      const employees = await db.employee.findMany({
        where: { isArchived: false },
        orderBy: { employeeCode: "asc" },
        select: {
          employeeId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      });

      const parsedStart = new Date(start);
      if (Number.isNaN(parsedStart.getTime())) {
        return { success: false, error: "Invalid start date" };
      }
      const dayStart = startOfZonedDay(parsedStart);
      const dayEnd = endOfZonedDay(parsedStart);

      const employeeIds = employees.map((employee) => employee.employeeId);
      const punches = await db.punch.findMany({
        where: {
          employeeId: { in: employeeIds },
          punchTime: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { punchTime: "asc" },
      });

      const breakMap = new Map<string, { count: number; minutes: number }>();
      for (const empId of employeeIds) {
        breakMap.set(empId, { count: 0, minutes: 0 });
      }

      const groupedPunches = new Map<string, typeof punches>();
      punches.forEach((p) => {
        if (!groupedPunches.has(p.employeeId)) groupedPunches.set(p.employeeId, []);
        groupedPunches.get(p.employeeId)!.push(p);
      });

      groupedPunches.forEach((list, empId) => {
        const stats = computeBreakStats(list);
        breakMap.set(empId, { count: stats.breakCount, minutes: stats.breakMinutes });
      });

      const map = new Map(enriched.map((row) => [row.employeeId, row]));
      const expectedMap = new Map<
        string,
        Awaited<ReturnType<typeof getExpectedShiftForDate>>
      >();
      await Promise.all(
        employees.map(async (emp) => {
          const expected = await getExpectedShiftForDate(emp.employeeId, dayStart);
          expectedMap.set(emp.employeeId, expected);
        })
      );

      const merged = employees.map((emp) => {
        const existing = map.get(emp.employeeId);
        const breaks = breakMap.get(emp.employeeId) ?? { count: 0, minutes: 0 };
        const expected = expectedMap.get(emp.employeeId);
        const scheduledStart =
          existing?.scheduledStartMinutes ?? expected?.scheduledStartMinutes ?? null;
        const scheduledEnd =
          existing?.scheduledEndMinutes ?? expected?.scheduledEndMinutes ?? null;
        const expectedShiftId =
          existing?.expectedShiftId ?? expected?.shift?.id ?? null;
        const expectedShiftName =
          existing?.expectedShiftName ?? expected?.shift?.name ?? null;

        if (existing) {
          return {
            ...existing,
            scheduledStartMinutes: scheduledStart,
            scheduledEndMinutes: scheduledEnd,
            expectedShiftId,
            expectedShiftName,
            breakCount: breaks.count || existing.breakCount || 0,
            breakMinutes: breaks.minutes || existing.breakMinutes || 0,
          };
        }

        return {
          id: `placeholder-${emp.employeeId}-${start}`,
          workDate: dayStart.toISOString(),
          status: "ABSENT",
          expectedShiftId,
          expectedShiftName,
          scheduledStartMinutes: scheduledStart,
          scheduledEndMinutes: scheduledEnd,
          actualInAt: null,
          actualOutAt: null,
          workedMinutes: null,
          lateMinutes: null,
          undertimeMinutes: null,
          overtimeMinutesRaw: null,
          punchesCount: 0,
          breakCount: breaks.count,
          breakMinutes: breaks.minutes,
          employeeId: emp.employeeId,
          employee: emp,
        };
      });

      return { success: true, data: merged };
    }

    return { success: true, data: enriched };
  } catch (error) {
    console.error("Failed to fetch attendance", error);
    return { success: false, error: "Failed to load attendance" };
  }
}

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

    const data: Record<string, any> = {};
    if (punchType) {
      if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
        return { success: false, error: "Invalid punchType" };
      }
      data.punchType = punchType;
    }
    if (punchTimeRaw) {
      const parsed = new Date(punchTimeRaw);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid punchTime" };
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

export async function autoLockAttendance(input?: { date?: string }) {
  try {
    const dateRaw = typeof input?.date === "string" ? input.date : null;
    const targetDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const dayStart = startOfZonedDay(targetDate);
    const dayEnd = endOfZonedDay(targetDate);

    const candidates = await db.attendance.findMany({
      where: {
        workDate: { gte: dayStart, lt: dayEnd },
        isLocked: false,
      },
    });

    let lockedCount = 0;
    for (const att of candidates) {
      let status = att.status;
      if (!att.actualOutAt) status = ATTENDANCE_STATUS.INCOMPLETE;

      await db.attendance.update({
        where: { id: att.id },
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

export async function getSelfAttendanceStatus(input?: { date?: string }) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: "Unauthorized", reason: "unauthorized" };
    }

    const dateParam = typeof input?.date === "string" ? input.date : null;
    const day = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(day.getTime())) {
      return { success: false, error: "Invalid date", reason: "invalid_date" };
    }
    const dayStart = startOfZonedDay(day);
    const dayEnd = endOfZonedDay(day);

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
    if (!employee) {
      return {
        success: false,
        error: "Employee not found for user",
        reason: "employee_not_found",
      };
    }

    const expected = await getExpectedShiftForDate(employee.employeeId, dayStart);
    const punches = await db.punch.findMany({
      where: { employeeId: employee.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
    });

    const breakStats = computeBreakStats(punches);
    const lastPunch = punches[punches.length - 1] ?? null;

    return {
      success: true,
      data: {
        employee,
        expected: {
          start: expected.scheduledStartMinutes,
          end: expected.scheduledEndMinutes,
          shiftName: expected.shift?.name ?? null,
          source: expected.source,
        },
        punches: punches.map((p) => serializePunch(p)),
        lastPunch: serializePunchNullable(lastPunch),
        breakCount: breakStats.breakCount,
        breakMinutes: breakStats.breakMinutes,
      },
    };
  } catch (error) {
    console.error("Failed to fetch self attendance status", error);
    return {
      success: false,
      error: "Failed to load attendance status",
    };
  }
}

export async function recordSelfPunch(input: { punchType: string }) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isIpAllowed(clientIp)) {
      return {
        success: false,
        error: "Punching not allowed from this device",
        reason: "ip_not_allowed",
      };
    }

    const punchType =
      typeof input?.punchType === "string" ? input.punchType : "";
    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return {
        success: false,
        error: "Invalid punchType",
        reason: "invalid_punch_type",
      };
    }

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: { employeeId: true },
    });
    if (!employee) {
      return {
        success: false,
        error: "Employee not found for user",
        reason: "employee_not_found",
      };
    }

    const now = zonedNow();
    const todayStart = startOfZonedDay(now);
    const expected = await getExpectedShiftForDate(employee.employeeId, todayStart);

    if (punchType === PUNCH_TYPE.TIME_IN) {
      if (expected.scheduledStartMinutes == null) {
        return {
          success: false,
          error: "No scheduled shift for today",
          reason: "no_shift_today",
        };
      }
      const minutesSinceStart = Math.round(
        (now.getTime() - todayStart.getTime()) / 60000
      );
      if (minutesSinceStart < expected.scheduledStartMinutes) {
        return {
          success: false,
          error:
            "Too early to clock in. You can time in at the scheduled start time.",
          reason: "too_early",
        };
      }
      if (
        expected.scheduledEndMinutes != null &&
        minutesSinceStart > expected.scheduledEndMinutes
      ) {
        return {
          success: false,
          error: "Cannot clock in after your scheduled end time.",
          reason: "too_late",
        };
      }
    }

    const punch = await createPunchAndMaybeRecompute({
      employeeId: employee.employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime: now,
      source: "WEB_SELF",
      recompute: true,
    });

    return { success: true, data: serializePunch(punch.punch) };
  } catch (error) {
    console.error("Failed to record self punch", error);
    return { success: false, error: "Failed to record punch" };
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
