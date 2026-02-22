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

// Minimal employee shape embedded in attendance/punch responses.
type EmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

// Attendance row loaded from DB with selected relation data.
type AttendanceRecord = Attendance & {
  employee?: EmployeeSummary | null;
  expectedShift?: { name: string | null } | null;
};

// Punch row loaded from DB with selected relation data.
type PunchRecord = Punch & {
  employee?: EmployeeSummary | null;
};

// Optional computed/override values to merge into serialized attendance payloads.
type AttendanceOverrides = {
  status?: ATTENDANCE_STATUS | null;
  actualInAt?: Date | string | null;
  actualOutAt?: Date | string | null;
  forgotToTimeOut?: boolean;
  breakStartAt?: Date | string | null;
  breakEndAt?: Date | string | null;
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

// Checks whether a key exists on overrides, even if the value is null.
const hasOverride = (
  overrides: AttendanceOverrides | undefined,
  key: keyof AttendanceOverrides
) => Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, key));

// Normalizes Date/string values into ISO strings for API responses.
const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

// Safely converts Decimal/number/string-like values to string for JSON responses.
const toStringOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return null;
};

// Canonical serializer for punch records returned by server actions.
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

// Canonical serializer for attendance records.
// Merges DB values with computed overrides so callers get a stable payload shape.
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
  const forgotToTimeOut = hasOverride(overrides, "forgotToTimeOut")
    ? Boolean(overrides?.forgotToTimeOut)
    : false;
  const breakStartAt = hasOverride(overrides, "breakStartAt")
    ? overrides?.breakStartAt ?? null
    : null;
  const breakEndAt = hasOverride(overrides, "breakEndAt")
    ? overrides?.breakEndAt ?? null
    : null;
  const status = hasOverride(overrides, "status")
    ? overrides?.status ?? record.status
    : record.status;
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
    status,
    expectedShiftId,
    expectedShiftName,
    scheduledStartMinutes,
    scheduledEndMinutes,
    paidHoursPerDay: toStringOrNull(record.paidHoursPerDay),
    actualInAt: toIsoString(actualInAt),
    actualOutAt: toIsoString(actualOutAt),
    forgotToTimeOut,
    breakStartAt: toIsoString(breakStartAt),
    breakEndAt: toIsoString(breakEndAt),
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

// Derives break summary from raw punch sequence.
// Break punches are paired in order, regardless of whether the first event is BREAK_IN/OUT.
const computeBreakStats = (punches: Array<PunchRecord | Punch>) => {
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;
  let breakStartAt: Date | null = null;
  let breakEndAt: Date | null = null;
  punches.forEach((p) => {
    if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
      if (!breakStart) {
        breakStart = p.punchTime;
        if (!breakStartAt) breakStartAt = p.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(
          0,
          Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000)
        );
        breakEndAt = p.punchTime;
        breakStart = null;
      }
    }
  });
  return { breakCount, breakMinutes, breakStartAt, breakEndAt };
};

const isIpAllowed = (ip: string | null, raw: string | undefined) => {
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return Boolean(ip && list.includes(ip));
};

// Self-punch from employee phone is open by default.
// Set ALLOWED_SELF_PUNCH_IPS to enforce a specific allowlist.
const isSelfPunchIpAllowed = (ip: string | null) =>
  isIpAllowed(ip, process.env.ALLOWED_SELF_PUNCH_IPS);

export async function listAttendance(input?: {
  start?: string | null;
  end?: string | null;
  employeeId?: string | null;
  status?: string | null;
  includeAll?: boolean;
}) {
  try {
    // Normalize and validate query inputs first.
    const start = typeof input?.start === "string" ? input.start : null;
    const end = typeof input?.end === "string" ? input.end : null;
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId : null;
    const status = typeof input?.status === "string" ? input.status : null;
    const includeAll = Boolean(input?.includeAll);
    const singleDay = Boolean(start && end && start === end);

    const where: Record<string, any> = {};
    if (start || end) {
      // Convert date boundaries into timezone-aware day boundaries for DB filtering.
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

    // Optional dimension filters.
    if (employeeId) where.employeeId = employeeId;
    if (
      status &&
      Object.values(ATTENDANCE_STATUS).includes(status as ATTENDANCE_STATUS)
    ) {
      where.status = status as ATTENDANCE_STATUS;
    }

    // Base attendance rows from DB.
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

    // Enrich each row with punch-derived values and expected schedule values.
    const enriched = await Promise.all(
      records.map(async (record) => {
        // Rebuild local day boundaries in configured timezone before querying punches.
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
        const { breakCount, breakMinutes, breakStartAt, breakEndAt } =
          computeBreakStats(punches);

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
        // Synthetic TIME_OUT generated by auto-timeout logic in lib/attendance.ts.
        const autoTimeoutPunch =
          [...punches]
            .reverse()
            .find(
              (p) =>
                p.punchType === PUNCH_TYPE.TIME_OUT &&
                p.source === "AUTO_TIMEOUT"
            ) ?? null;

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
        const normalizedStatus =
          !expected.shift && !actualInAt && !actualOutAt && punches.length === 0
            ? ATTENDANCE_STATUS.REST
            : record.status;
        // "Forgot to timeout" is true when system auto-closed the shift,
        // or when a shift is still incomplete with no TIME_OUT.
        const forgotToTimeOut =
          Boolean(autoTimeoutPunch) ||
          (normalizedStatus === ATTENDANCE_STATUS.INCOMPLETE &&
            Boolean(actualInAt) &&
            !actualOutAt);

        return serializeAttendance(record, {
          status: normalizedStatus,
          forgotToTimeOut,
          breakCount: breakCount || record.breakCount || 0,
          breakMinutes: breakMinutes || record.breakMinutes || 0,
          breakStartAt,
          breakEndAt,
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

    // Include-all mode (single day only): include employees with no attendance row yet.
    // Used by Daily Attendance to show a complete employee roster for the selected day.
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

      const breakMap = new Map<
        string,
        { count: number; minutes: number; startAt: string | null; endAt: string | null }
      >();
      const forgotTimeoutMap = new Map<string, boolean>();
      for (const empId of employeeIds) {
        breakMap.set(empId, { count: 0, minutes: 0, startAt: null, endAt: null });
        forgotTimeoutMap.set(empId, false);
      }

      const groupedPunches = new Map<string, typeof punches>();
      punches.forEach((p) => {
        if (!groupedPunches.has(p.employeeId)) groupedPunches.set(p.employeeId, []);
        groupedPunches.get(p.employeeId)!.push(p);
      });

      groupedPunches.forEach((list, empId) => {
        const stats = computeBreakStats(list);
        // Track whether this employee had a system-generated timeout punch.
        const autoTimeoutPunch =
          [...list]
            .reverse()
            .find(
              (p) =>
                p.punchType === PUNCH_TYPE.TIME_OUT &&
                p.source === "AUTO_TIMEOUT"
            ) ?? null;
        breakMap.set(empId, {
          count: stats.breakCount,
          minutes: stats.breakMinutes,
          startAt: toIsoString(stats.breakStartAt),
          endAt: toIsoString(stats.breakEndAt),
        });
        forgotTimeoutMap.set(empId, Boolean(autoTimeoutPunch));
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
        // Existing row => augment with latest derived schedule/break/forgot-timeout values.
        const existing = map.get(emp.employeeId);
        const breaks = breakMap.get(emp.employeeId) ?? {
          count: 0,
          minutes: 0,
          startAt: null,
          endAt: null,
        };
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
            forgotToTimeOut:
              (forgotTimeoutMap.get(emp.employeeId) ?? false) ||
              existing.forgotToTimeOut ||
              false,
            breakCount: breaks.count || existing.breakCount || 0,
            breakMinutes: breaks.minutes || existing.breakMinutes || 0,
            breakStartAt: breaks.startAt ?? existing.breakStartAt ?? null,
            breakEndAt: breaks.endAt ?? existing.breakEndAt ?? null,
          };
        }

        // Missing row => create placeholder attendance (ABSENT/REST) for table completeness.
        return {
          id: `placeholder-${emp.employeeId}-${start}`,
          workDate: dayStart.toISOString(),
          status: expected?.shift
            ? ATTENDANCE_STATUS.ABSENT
            : ATTENDANCE_STATUS.REST,
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
          forgotToTimeOut: forgotTimeoutMap.get(emp.employeeId) ?? false,
          breakCount: breaks.count,
          breakMinutes: breaks.minutes,
          breakStartAt: breaks.startAt,
          breakEndAt: breaks.endAt,
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
    // This endpoint is day-scoped (one day at a time).
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

    // Return all punches in chronological order with employee metadata.
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
    // Validate mutable fields; only provided fields are updated.
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

    // Any punch change can alter totals/status, so recompute that employee-day.
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
    // Load the row first so we still know which employee/day to recompute after delete.
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

export async function autoLockAttendance(input?: { date?: string }) {
  try {
    // Locks unlocked rows for a day and forces INCOMPLETE if TIME_OUT is missing.
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
    // Self-service endpoint for employee dashboard/kiosk-like views.
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

    // Return schedule context + raw punches + quick break summary for UI.
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
    // Self-punch applies auth + optional IP restrictions + schedule timing guards.
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isSelfPunchIpAllowed(clientIp)) {
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
      // Time-in is only valid during scheduled shift window.
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
      // Keep attendance row fresh immediately after punch.
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
    // Admin/manager punch endpoint: can set explicit punch time/source.
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
      // Caller controls whether recomputation runs immediately.
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
    // Recompute one employee for one day.
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

export async function recomputeAttendanceForDate(input?: { date?: string }) {
  try {
    // Batch recompute all active employees for a specific day.
    const dateRaw = typeof input?.date === "string" ? input.date : null;
    const targetDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return { success: false, error: "Invalid date" };
    }

    const dayStart = startOfZonedDay(targetDate);
    const employees = await db.employee.findMany({
      where: { isArchived: false },
      select: { employeeId: true },
    });

    await Promise.all(
      employees.map((employee) =>
        recomputeAttendanceForDay(employee.employeeId, dayStart)
      )
    );

    return {
      success: true,
      data: {
        processedCount: employees.length,
        date: dayStart.toISOString(),
        tz: TZ,
      },
    };
  } catch (error) {
    console.error("Failed to recompute attendance for date", error);
    return { success: false, error: "Failed to recompute attendance" };
  }
}
