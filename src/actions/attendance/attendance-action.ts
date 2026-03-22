"use server";

import {
  ATTENDANCE_STATUS,
  PUNCH_TYPE,
  type Attendance,
  type Prisma,
  type Punch,
} from "@prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  computeBreakDeduction,
  computeLateGraceCreditMinutes,
  computeLateMinutes,
  computePayableAmountFromNetMinutes,
  computePayrollVariance,
  computeRatePerMinute,
  computeScheduledPaidMinutes,
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
  dailyRate?: unknown;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

// Attendance row loaded from DB with selected relation data.
type AttendanceRecord = Attendance & {
  employee?: EmployeeSummary | null;
  expectedShift?: {
    id: number;
    name: string | null;
    startMinutes: number;
    endMinutes: number;
    breakStartMinutes: number | null;
    breakEndMinutes: number | null;
    breakMinutesUnpaid?: number | null;
    paidHoursPerDay?: unknown;
  } | null;
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
  scheduledBreakMinutes?: number | null;
  breakCount?: number;
  breakMinutes?: number;
  deductedBreakMinutes?: number;
  netWorkedMinutes?: number | null;
  dailyRate?: unknown;
  ratePerMinute?: number | null;
  payableAmount?: number | null;
  punchesCount?: number;
  lateMinutes?: number | null;
  lateGraceCreditMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  workedMinutes?: number | null;
  payableWorkedMinutes?: number | null;
  payableWorkedHoursAndMinutes?: string | null;
};

// Checks whether a key exists on overrides, even if the value is null.
const hasOverride = (
  overrides: AttendanceOverrides | undefined,
  key: keyof AttendanceOverrides,
) => Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, key));

// Normalizes Date/string values into ISO strings for API responses.
const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

const toDateOrNull = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

// Safely converts Decimal/number/string-like values to number for calculations.
const toNumberOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    const parsed = Number.parseFloat(
      (value as { toString: () => string }).toString(),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isMissingRateHistoryTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "P2021";
};

const buildRateLookupKey = (employeeId: string, workDate: Date | string) =>
  `${employeeId}::${typeof workDate === "string" ? workDate : workDate.toISOString()}`;

const buildEmployeeDayKey = (employeeId: string, date: Date) =>
  `${employeeId}::${toDayKey(date)}`;

const resolveEffectiveDailyRates = async ({
  employeeDates,
  fallbackDailyRates,
}: {
  employeeDates: Map<string, Date[]>;
  fallbackDailyRates?: Map<string, unknown>;
}) => {
  const employeeIds = [...employeeDates.keys()];
  if (employeeIds.length === 0) return new Map<string, number | null>();

  const allDates = [...employeeDates.values()].flat();
  if (allDates.length === 0) return new Map<string, number | null>();

  const maxWorkDate = allDates.reduce(
    (latest, current) => (current.getTime() > latest.getTime() ? current : latest),
    allDates[0],
  );

  let historyRows: Array<{
    employeeId: string;
    dailyRate: unknown;
    effectiveFrom: Date;
  }> = [];
  try {
    historyRows = await db.employeeRateHistory.findMany({
      where: {
        employeeId: { in: employeeIds },
        effectiveFrom: { lte: maxWorkDate },
      },
      orderBy: [{ employeeId: "asc" }, { effectiveFrom: "asc" }],
      select: {
        employeeId: true,
        dailyRate: true,
        effectiveFrom: true,
      },
    });
  } catch (error) {
    if (!isMissingRateHistoryTableError(error)) {
      throw error;
    }
    console.warn(
      "EmployeeRateHistory table is not available yet. Falling back to Employee.dailyRate.",
    );
  }

  const historyByEmployee = new Map<
    string,
    { effectiveFrom: Date; dailyRate: unknown }[]
  >();
  historyRows.forEach((row) => {
    if (!historyByEmployee.has(row.employeeId)) {
      historyByEmployee.set(row.employeeId, []);
    }
    historyByEmployee.get(row.employeeId)!.push({
      effectiveFrom: row.effectiveFrom,
      dailyRate: row.dailyRate,
    });
  });

  const resolved = new Map<string, number | null>();

  employeeDates.forEach((dates, id) => {
    const uniqueDateIsos = [...new Set(dates.map((date) => date.toISOString()))].sort();
    const history = historyByEmployee.get(id) ?? [];
    const fallbackRate = toNumberOrNull(fallbackDailyRates?.get(id));

    let historyIndex = 0;
    let currentRate: number | null = history.length === 0 ? fallbackRate : null;

    uniqueDateIsos.forEach((iso) => {
      const dateMs = new Date(iso).getTime();
      while (
        historyIndex < history.length &&
        history[historyIndex].effectiveFrom.getTime() <= dateMs
      ) {
        currentRate = toNumberOrNull(history[historyIndex].dailyRate);
        historyIndex += 1;
      }

      const rate =
        currentRate ?? (history.length === 0 ? fallbackRate : null);

      resolved.set(buildRateLookupKey(id, iso), rate);
    });
  });

  return resolved;
};

const formatWorkedHoursAndMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return null;
  const normalizedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  if (hours === 0) return `${mins} min${mins === 1 ? "" : "s"}`;
  if (mins === 0) return `${hours}hr`;
  return `${hours}hr ${mins} min${mins === 1 ? "" : "s"}`;
};

const serializeEmployeeSummary = (employee?: EmployeeSummary | null) => {
  if (!employee) return null;
  return {
    employeeId: employee.employeeId,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    dailyRate: toNumberOrNull(employee.dailyRate ?? null),
    department: employee.department ?? null,
    position: employee.position ?? null,
  };
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
    employee: serializeEmployeeSummary(punch.employee),
  };
};

const serializePunchNullable = (punch: PunchRecord | null) =>
  punch ? serializePunch(punch) : null;

// Canonical serializer for attendance records.
// Merges DB values with computed overrides so callers get a stable payload shape.
const serializeAttendance = (
  record: AttendanceRecord,
  overrides?: AttendanceOverrides,
) => {
  // Override precedence:
  // 1) If an override key exists, use it (including explicit null to clear a value).
  // 2) If no override key exists, keep the persisted DB value.
  const actualInAt = hasOverride(overrides, "actualInAt")
    ? (overrides?.actualInAt ?? null)
    : (record.actualInAt ?? null);
  const actualOutAt = hasOverride(overrides, "actualOutAt")
    ? (overrides?.actualOutAt ?? null)
    : (record.actualOutAt ?? null);
  const forgotToTimeOut = hasOverride(overrides, "forgotToTimeOut")
    ? Boolean(overrides?.forgotToTimeOut)
    : false;
  const breakStartAt = hasOverride(overrides, "breakStartAt")
    ? (overrides?.breakStartAt ?? null)
    : null;
  const breakEndAt = hasOverride(overrides, "breakEndAt")
    ? (overrides?.breakEndAt ?? null)
    : null;
  const status = hasOverride(overrides, "status")
    ? (overrides?.status ?? record.status)
    : record.status;
  const expectedShiftId = hasOverride(overrides, "expectedShiftId")
    ? (overrides?.expectedShiftId ?? null)
    : (record.expectedShiftId ?? null);
  const expectedShiftName = hasOverride(overrides, "expectedShiftName")
    ? (overrides?.expectedShiftName ?? null)
    : (record.expectedShift?.name ?? null);
  const scheduledStartMinutes = hasOverride(overrides, "scheduledStartMinutes")
    ? (overrides?.scheduledStartMinutes ?? null)
    : (record.scheduledStartMinutes ?? null);
  const scheduledEndMinutes = hasOverride(overrides, "scheduledEndMinutes")
    ? (overrides?.scheduledEndMinutes ?? null)
    : (record.scheduledEndMinutes ?? null);
  const scheduledBreakMinutes = hasOverride(overrides, "scheduledBreakMinutes")
    ? (overrides?.scheduledBreakMinutes ?? null)
    : (record.expectedShift?.breakMinutesUnpaid ?? null);
  const breakCount = hasOverride(overrides, "breakCount")
    ? (overrides?.breakCount ?? 0)
    : (record.breakCount ?? 0);
  const breakMinutes = hasOverride(overrides, "breakMinutes")
    ? (overrides?.breakMinutes ?? 0)
    : (record.breakMinutes ?? 0);
  const deductedBreakMinutes = hasOverride(overrides, "deductedBreakMinutes")
    ? Math.max(0, overrides?.deductedBreakMinutes ?? 0)
    : Math.max(0, record.deductedBreakMinutes ?? 0);
  const dailyRate = hasOverride(overrides, "dailyRate")
    ? toNumberOrNull(overrides?.dailyRate ?? null)
    : toNumberOrNull(record.employee?.dailyRate ?? null);
  const ratePerMinute = hasOverride(overrides, "ratePerMinute")
    ? (overrides?.ratePerMinute ?? null)
    : null;
  const payableAmount = hasOverride(overrides, "payableAmount")
    ? (overrides?.payableAmount ?? null)
    : null;
  const punchesCount = hasOverride(overrides, "punchesCount")
    ? (overrides?.punchesCount ?? 0)
    : 0;
  const lateMinutes = hasOverride(overrides, "lateMinutes")
    ? (overrides?.lateMinutes ?? null)
    : (record.lateMinutes ?? null);
  const undertimeMinutes = hasOverride(overrides, "undertimeMinutes")
    ? (overrides?.undertimeMinutes ?? null)
    : (record.undertimeMinutes ?? null);
  const overtimeMinutesRaw = hasOverride(overrides, "overtimeMinutesRaw")
    ? (overrides?.overtimeMinutesRaw ?? null)
    : (record.overtimeMinutesRaw ?? null);
  const workedMinutes = hasOverride(overrides, "workedMinutes")
    ? (overrides?.workedMinutes ?? null)
    : (record.workedMinutes ?? null);
  const netWorkedMinutes = hasOverride(overrides, "netWorkedMinutes")
    ? (overrides?.netWorkedMinutes ?? null)
    : (record.netWorkedMinutes ?? null);
  const dayStart = startOfZonedDay(record.workDate);
  const actualInDate = toDateOrNull(actualInAt);
  const actualInMinutes = actualInDate
    ? Math.round((actualInDate.getTime() - dayStart.getTime()) / 60000)
    : null;
  const scheduledPaidMinutes = computeScheduledPaidMinutes({
    paidHoursPerDay: record.paidHoursPerDay ?? null,
    scheduledStartMinutes,
    scheduledEndMinutes,
    scheduledBreakMinutes,
  });
  const computedLateGraceCreditMinutes = computeLateGraceCreditMinutes({
    scheduledStartMinutes,
    actualInMinutes,
  });
  const lateGraceCreditMinutes = hasOverride(overrides, "lateGraceCreditMinutes")
    ? Math.max(0, overrides?.lateGraceCreditMinutes ?? 0)
    : computedLateGraceCreditMinutes;
  const computedPayableWorkedMinutes =
    typeof netWorkedMinutes === "number" && Number.isFinite(netWorkedMinutes)
      ? typeof scheduledPaidMinutes === "number" &&
        Number.isFinite(scheduledPaidMinutes)
        ? Math.max(
            0,
            Math.min(
              Math.round(scheduledPaidMinutes),
              Math.round(netWorkedMinutes) + lateGraceCreditMinutes,
            ),
          )
        : Math.max(0, Math.round(netWorkedMinutes))
      : null;
  const payableWorkedMinutes = hasOverride(overrides, "payableWorkedMinutes")
    ? Math.max(0, overrides?.payableWorkedMinutes ?? 0)
    : computedPayableWorkedMinutes;
  const workedHoursAndMinutes = formatWorkedHoursAndMinutes(workedMinutes);
  const netWorkedHoursAndMinutes =
    formatWorkedHoursAndMinutes(netWorkedMinutes);
  const payableWorkedHoursAndMinutes = hasOverride(
    overrides,
    "payableWorkedHoursAndMinutes",
  )
    ? (overrides?.payableWorkedHoursAndMinutes ?? null)
    : formatWorkedHoursAndMinutes(payableWorkedMinutes);

  return {
    id: record.id,
    employeeId: record.employeeId,
    workDate: record.workDate.toISOString(),
    status,
    expectedShiftId,
    expectedShiftName,
    scheduledStartMinutes,
    scheduledEndMinutes,
    scheduledBreakMinutes,
    paidHoursPerDay: toStringOrNull(record.paidHoursPerDay),
    actualInAt: toIsoString(actualInAt),
    actualOutAt: toIsoString(actualOutAt),
    forgotToTimeOut,
    breakStartAt: toIsoString(breakStartAt),
    breakEndAt: toIsoString(breakEndAt),
    workedMinutes,
    workedHoursAndMinutes,
    dailyRate,
    ratePerMinute,
    payableAmount,
    breakMinutes,
    deductedBreakMinutes,
    netWorkedMinutes,
    netWorkedHoursAndMinutes,
    payableWorkedMinutes,
    payableWorkedHoursAndMinutes,
    lateGraceCreditMinutes,
    breakCount,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutesRaw,
    overtimeMinutesApproved: record.overtimeMinutesApproved ?? 0,
    nightMinutes: record.nightMinutes ?? 0,
    isLocked: record.isLocked,
    payrollPeriodId: record.payrollPeriodId ?? null,
    punchesCount,
    employee: serializeEmployeeSummary(record.employee),
    expectedShift: record.expectedShift
      ? {
          id: record.expectedShift.id,
          name: record.expectedShift.name,
          startMinutes: record.expectedShift.startMinutes,
          endMinutes: record.expectedShift.endMinutes,
          breakStartMinutes: record.expectedShift.breakStartMinutes,
          breakEndMinutes: record.expectedShift.breakEndMinutes,
          breakMinutesUnpaid: record.expectedShift.breakMinutesUnpaid ?? null,
          paidHoursPerDay: toStringOrNull(record.expectedShift.paidHoursPerDay),
        }
      : null,
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
          Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000),
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

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayKey = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: TZ });

const parseDateInput = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRangeBounds = (start: Date, end?: Date) => {
  const rangeStart = startOfZonedDay(start);
  const rangeEnd = end ? endOfZonedDay(end) : endOfZonedDay(start);
  return { rangeStart, rangeEnd };
};

type AttendanceFreezeState = {
  isLocked: boolean;
  payrollPeriodId: string | null;
};

const getAttendanceFreezeStateForMoment = async (
  employeeId: string,
  punchTime: Date,
) => {
  const dayStart = startOfZonedDay(punchTime);
  const dayEnd = endOfZonedDay(punchTime);
  const attendance = await db.attendance.findFirst({
    where: {
      employeeId,
      workDate: { gte: dayStart, lt: dayEnd },
    },
    select: {
      isLocked: true,
      payrollPeriodId: true,
    },
  });
  if (!attendance) return null;
  return {
    isLocked: Boolean(attendance.isLocked),
    payrollPeriodId: attendance.payrollPeriodId ?? null,
  } satisfies AttendanceFreezeState;
};

const getAttendanceFreezeError = (
  state: AttendanceFreezeState | null,
  lockedMessage: string,
) => {
  if (!state) return null;
  if (state.payrollPeriodId) {
    return "Attendance is already linked to payroll. Use payroll adjustments instead of editing punches.";
  }
  if (state.isLocked) {
    return lockedMessage;
  }
  return null;
};

export async function listAttendance(input?: {
  start?: string | null;
  end?: string | null;
  employeeId?: string | null;
  status?: string | null;
  query?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  variance?: "OT" | "UT" | "LATE" | null;
  page?: number | null;
  pageSize?: number | null;
  includeAll?: boolean;
}) {
  try {
    // Normalize and validate query inputs first.
    const start = typeof input?.start === "string" ? input.start : null;
    const end = typeof input?.end === "string" ? input.end : null;
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId.trim() : null;
    const status = typeof input?.status === "string" ? input.status : null;
    const query =
      typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const departmentId =
      typeof input?.departmentId === "string" ? input.departmentId.trim() : "";
    const positionId =
      typeof input?.positionId === "string" ? input.positionId.trim() : "";
    const variance = input?.variance ?? null;
    const includeAll = Boolean(input?.includeAll);
    const singleDay = Boolean(start && end && start === end);
    const pageRaw =
      typeof input?.page === "number" && Number.isFinite(input.page)
        ? Math.floor(input.page)
        : 1;
    const pageSizeRaw =
      typeof input?.pageSize === "number" && Number.isFinite(input.pageSize)
        ? Math.floor(input.pageSize)
        : 100;
    const page = Math.max(1, pageRaw);
    const pageSize = Math.max(10, Math.min(200, pageSizeRaw));
    const shouldPaginate = !includeAll;

    const where: Prisma.AttendanceWhereInput = {};
    if (start || end) {
      // Convert date boundaries into timezone-aware day boundaries for DB filtering.
      const workDate: Prisma.DateTimeFilter = {};
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
    if (variance === "OT") where.overtimeMinutesRaw = { gt: 0 };
    if (variance === "UT") where.undertimeMinutes = { gt: 0 };
    if (variance === "LATE") where.lateMinutes = { gt: 0 };
    if (departmentId || positionId || queryTokens.length > 0) {
      const employeeWhere: Prisma.EmployeeWhereInput = {
        isArchived: false,
      };
      if (departmentId) {
        employeeWhere.departmentId = departmentId;
      }
      if (positionId) {
        employeeWhere.positionId = positionId;
      }
      if (queryTokens.length > 0) {
        employeeWhere.AND = queryTokens.map((token) => ({
          OR: [
            { employeeCode: { contains: token, mode: "insensitive" } },
            { firstName: { contains: token, mode: "insensitive" } },
            { middleName: { contains: token, mode: "insensitive" } },
            { lastName: { contains: token, mode: "insensitive" } },
            {
              department: {
                is: { name: { contains: token, mode: "insensitive" } },
              },
            },
            {
              position: {
                is: { name: { contains: token, mode: "insensitive" } },
              },
            },
          ],
        }));
      }
      where.employee = { is: employeeWhere };
    }

    const totalCount = shouldPaginate
      ? await db.attendance.count({ where })
      : 0;
    const totalPages = shouldPaginate
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : 1;
    const safePage = shouldPaginate ? Math.min(page, totalPages) : 1;
    const skip = shouldPaginate ? (safePage - 1) * pageSize : undefined;
    const take = shouldPaginate ? pageSize : undefined;

    //#1
    // Base attendance rows from DB ( record.blank ).
    const records = await db.attendance.findMany({
      where,
      orderBy: { workDate: "desc" },
      skip,
      take,
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            dailyRate: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
        expectedShift: {
          select: {
            id: true,
            name: true,
            startMinutes: true,
            endMinutes: true,
            breakStartMinutes: true,
            breakEndMinutes: true,
            breakMinutesUnpaid: true,
            paidHoursPerDay: true,
          },
        },
      },
    });

    const recordDatesByEmployee = new Map<string, Date[]>();
    const recordFallbackRates = new Map<string, unknown>();
    records.forEach((record) => {
      if (!recordDatesByEmployee.has(record.employeeId)) {
        recordDatesByEmployee.set(record.employeeId, []);
      }
      recordDatesByEmployee.get(record.employeeId)!.push(record.workDate);
      if (!recordFallbackRates.has(record.employeeId)) {
        recordFallbackRates.set(record.employeeId, record.employee?.dailyRate ?? null);
      }
    });
    const effectiveDailyRates = await resolveEffectiveDailyRates({
      employeeDates: recordDatesByEmployee,
      fallbackDailyRates: recordFallbackRates,
    });

    const punchesByEmployeeDay = new Map<string, Punch[]>();
    if (records.length > 0) {
      const employeeIds = [...new Set(records.map((record) => record.employeeId))];
      const workDates = records.map((record) => record.workDate.getTime());
      const minWorkDate = new Date(Math.min(...workDates));
      const maxWorkDate = new Date(Math.max(...workDates));
      const rangeStart = startOfZonedDay(minWorkDate);
      const rangeEnd = endOfZonedDay(maxWorkDate);

      const allPunches = await db.punch.findMany({
        where: {
          employeeId: { in: employeeIds },
          punchTime: { gte: rangeStart, lt: rangeEnd },
        },
        orderBy: { punchTime: "asc" },
      });

      allPunches.forEach((punch) => {
        const key = buildEmployeeDayKey(punch.employeeId, punch.punchTime);
        if (!punchesByEmployeeDay.has(key)) {
          punchesByEmployeeDay.set(key, []);
        }
        punchesByEmployeeDay.get(key)!.push(punch);
      });
    }

    //#2
    // Enrich each row with punch values and expected schedule values.
    const enriched = records.map((record) => {
      const effectiveDailyRate =
        effectiveDailyRates.get(
          buildRateLookupKey(record.employeeId, record.workDate),
        ) ?? toNumberOrNull(record.employee?.dailyRate ?? null);

      const dayStart = startOfZonedDay(record.workDate);
      const punches =
        punchesByEmployeeDay.get(
          buildEmployeeDayKey(record.employeeId, record.workDate),
        ) ?? [];
      const { breakCount, breakMinutes, breakStartAt, breakEndAt } =
        computeBreakStats(punches);

      const expectedShift = record.expectedShift ?? null;
      const expectedStart = record.scheduledStartMinutes ?? null;
      const expectedEnd = record.scheduledEndMinutes ?? null;
      const scheduledBreakMinutes = expectedShift?.breakMinutesUnpaid ?? null;

      const firstClockIn = punches.find((p) => p.punchType === "TIME_IN") ?? null;
      const lastClockOut =
        [...punches].reverse().find((p) => p.punchType === "TIME_OUT") ?? null;
      // Synthetic TIME_OUT generated by auto-timeout logic in lib/attendance.ts.
      const autoTimeoutPunch =
        [...punches]
          .reverse()
          .find(
            (p) =>
              p.punchType === PUNCH_TYPE.TIME_OUT &&
              p.source === "AUTO_TIMEOUT",
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
        computeLateMinutes(expectedStart, actualInMinutes) ??
        record.lateMinutes ??
        null;
      const workedMinutes =
        actualInAt && actualOutAt
          ? Math.max(
              0,
              Math.round((actualOutAt.getTime() - actualInAt.getTime()) / 60000),
            )
          : null;
      const mergedBreakMinutes = breakMinutes || record.breakMinutes || 0;
      const { deductedBreakMinutes, netWorkedMinutes } = computeBreakDeduction({
        workedMinutes,
        actualBreakMinutes: mergedBreakMinutes,
        scheduledBreakMinutes,
        breakStartMinutes: expectedShift?.breakStartMinutes ?? null,
        breakEndMinutes: expectedShift?.breakEndMinutes ?? null,
        actualInMinutes,
        actualOutMinutes,
      });
      const scheduledPaidMinutes = computeScheduledPaidMinutes({
        paidHoursPerDay:
          record.paidHoursPerDay ?? expectedShift?.paidHoursPerDay ?? null,
        scheduledStartMinutes: expectedStart,
        scheduledEndMinutes: expectedEnd,
        scheduledBreakMinutes,
      });
      const lateGraceCreditMinutes = computeLateGraceCreditMinutes({
        scheduledStartMinutes: expectedStart,
        actualInMinutes,
      });
      const payableWorkedMinutes =
        netWorkedMinutes != null && Number.isFinite(netWorkedMinutes)
          ? scheduledPaidMinutes != null && Number.isFinite(scheduledPaidMinutes)
            ? Math.max(
                0,
                Math.min(
                  Math.round(scheduledPaidMinutes),
                  Math.round(netWorkedMinutes) + lateGraceCreditMinutes,
                ),
              )
            : Math.max(0, Math.round(netWorkedMinutes))
          : null;
      const { undertimeMinutes, overtimeMinutesRaw } =
        netWorkedMinutes != null && scheduledPaidMinutes != null
          ? computePayrollVariance({
              netWorkedMinutes,
              scheduledPaidMinutes,
              lateGraceCreditMinutes,
            })
          : { undertimeMinutes: null, overtimeMinutesRaw: null };
      const ratePerMinute = computeRatePerMinute({
        dailyRate: effectiveDailyRate,
        scheduledPaidMinutes,
      });
      const payableAmount = computePayableAmountFromNetMinutes({
        netWorkedMinutes,
        ratePerMinute,
      });
      const normalizedStatus =
        record.status !== ATTENDANCE_STATUS.LEAVE &&
        !expectedShift &&
        !actualInAt &&
        !actualOutAt &&
        punches.length === 0
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
        breakMinutes: mergedBreakMinutes,
        deductedBreakMinutes,
        netWorkedMinutes,
        dailyRate: effectiveDailyRate,
        ratePerMinute,
        payableAmount,
        breakStartAt,
        breakEndAt,
        actualInAt,
        actualOutAt,
        expectedShiftId: expectedShift?.id ?? record.expectedShiftId ?? null,
        expectedShiftName: expectedShift?.name ?? record.expectedShift?.name ?? null,
        scheduledStartMinutes: expectedStart,
        scheduledEndMinutes: expectedEnd,
        scheduledBreakMinutes,
        punchesCount: punches.length,
        lateMinutes,
        lateGraceCreditMinutes,
        undertimeMinutes,
        overtimeMinutesRaw,
        workedMinutes,
        payableWorkedMinutes,
      });
    });

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
          dailyRate: true,
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

      const includeAllDatesByEmployee = new Map<string, Date[]>();
      const includeAllFallbackRates = new Map<string, unknown>();
      employees.forEach((emp) => {
        includeAllDatesByEmployee.set(emp.employeeId, [dayStart]);
        includeAllFallbackRates.set(emp.employeeId, emp.dailyRate ?? null);
      });
      const includeAllEffectiveRates = await resolveEffectiveDailyRates({
        employeeDates: includeAllDatesByEmployee,
        fallbackDailyRates: includeAllFallbackRates,
      });

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
        {
          count: number;
          minutes: number;
          startAt: string | null;
          endAt: string | null;
        }
      >();
      const forgotTimeoutMap = new Map<string, boolean>();
      for (const empId of employeeIds) {
        breakMap.set(empId, {
          count: 0,
          minutes: 0,
          startAt: null,
          endAt: null,
        });
        forgotTimeoutMap.set(empId, false);
      }

      const groupedPunches = new Map<string, typeof punches>();
      punches.forEach((p) => {
        if (!groupedPunches.has(p.employeeId))
          groupedPunches.set(p.employeeId, []);
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
                p.source === "AUTO_TIMEOUT",
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
          const expected = await getExpectedShiftForDate(
            emp.employeeId,
            dayStart,
          );
          expectedMap.set(emp.employeeId, expected);
        }),
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
          existing?.scheduledStartMinutes ??
          expected?.scheduledStartMinutes ??
          null;
        const scheduledEnd =
          existing?.scheduledEndMinutes ??
          expected?.scheduledEndMinutes ??
          null;
        const scheduledBreakMinutes =
          existing?.scheduledBreakMinutes ??
          expected?.shift?.breakMinutesUnpaid ??
          null;
        const scheduledPaidMinutes = computeScheduledPaidMinutes({
          paidHoursPerDay: expected?.shift?.paidHoursPerDay ?? null,
          scheduledStartMinutes: scheduledStart,
          scheduledEndMinutes: scheduledEnd,
          scheduledBreakMinutes,
        });
        const effectiveDailyRate =
          includeAllEffectiveRates.get(
            buildRateLookupKey(emp.employeeId, dayStart),
          ) ?? toNumberOrNull(emp.dailyRate ?? null);
        const ratePerMinute = computeRatePerMinute({
          dailyRate: effectiveDailyRate,
          scheduledPaidMinutes,
        });
        const expectedShiftId =
          existing?.expectedShiftId ?? expected?.shift?.id ?? null;
        const expectedShiftName =
          existing?.expectedShiftName ?? expected?.shift?.name ?? null;

        if (existing) {
          return {
            ...existing,
            dailyRate: existing.dailyRate ?? effectiveDailyRate,
            ratePerMinute: existing.ratePerMinute ?? ratePerMinute ?? null,
            scheduledStartMinutes: scheduledStart,
            scheduledEndMinutes: scheduledEnd,
            scheduledBreakMinutes,
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
          scheduledBreakMinutes,
          actualInAt: null,
          actualOutAt: null,
          workedMinutes: null,
          workedHoursAndMinutes: null,
          dailyRate: effectiveDailyRate,
          ratePerMinute,
          payableAmount: null,
          deductedBreakMinutes: 0,
          netWorkedMinutes: null,
          netWorkedHoursAndMinutes: null,
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
          employee: serializeEmployeeSummary(emp),
        };
      });

      return {
        success: true,
        data: merged,
        totalCount: merged.length,
        page: 1,
        pageSize: merged.length,
        totalPages: 1,
      };
    }

    return {
      success: true,
      data: enriched,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("Failed to fetch attendance", error);
    return { success: false, error: "Failed to load attendance" };
  }
}

export async function listAttendanceLockSummary(input?: {
  start?: string | null;
  end?: string | null;
}) {
  try {
    const startRaw = typeof input?.start === "string" ? input.start : "";
    if (!startRaw) {
      return { success: false, error: "start date is required" };
    }

    const startDate = parseDateInput(startRaw);
    if (!startDate) {
      return { success: false, error: "Invalid start date" };
    }

    const endRaw = typeof input?.end === "string" ? input.end : startRaw;
    const endDate = parseDateInput(endRaw);
    if (!endDate) {
      return { success: false, error: "Invalid end date" };
    }
    if (endDate.getTime() < startDate.getTime()) {
      return { success: false, error: "end date must be on/after start date" };
    }

    const { rangeStart, rangeEnd } = getRangeBounds(startDate, endDate);
    const rows = await db.attendance.findMany({
      where: {
        workDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        workDate: true,
        isLocked: true,
      },
    });

    const byDate = new Map<string, { totalRows: number; lockedRows: number }>();
    rows.forEach((row) => {
      const key = toDayKey(row.workDate);
      const current = byDate.get(key) ?? { totalRows: 0, lockedRows: 0 };
      current.totalRows += 1;
      if (row.isLocked) current.lockedRows += 1;
      byDate.set(key, current);
    });

    const data: Array<{
      date: string;
      totalRows: number;
      lockedRows: number;
      unlockedRows: number;
      lockState: "LOCKED" | "UNLOCKED" | "PARTIAL" | "NO_ROWS";
    }> = [];
    for (
      let cursor = new Date(rangeStart);
      cursor.getTime() < rangeEnd.getTime();
      cursor = new Date(cursor.getTime() + DAY_MS)
    ) {
      const key = toDayKey(cursor);
      const count = byDate.get(key) ?? { totalRows: 0, lockedRows: 0 };
      const unlockedRows = Math.max(0, count.totalRows - count.lockedRows);
      let lockState: "LOCKED" | "UNLOCKED" | "PARTIAL" | "NO_ROWS" = "NO_ROWS";
      if (count.totalRows > 0) {
        if (count.lockedRows === 0) {
          lockState = "UNLOCKED";
        } else if (count.lockedRows === count.totalRows) {
          lockState = "LOCKED";
        } else {
          lockState = "PARTIAL";
        }
      }
      data.push({
        date: key,
        totalRows: count.totalRows,
        lockedRows: count.lockedRows,
        unlockedRows,
        lockState,
      });
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to list attendance lock summary", error);
    return { success: false, error: "Failed to load lock summary" };
  }
}

export async function listLockableEmployees(input?: {
  query?: string | null;
  limit?: number | null;
}) {
  try {
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 30;
    const limit = Math.max(1, Math.min(limitRaw, 200));

    const where: Prisma.EmployeeWhereInput = { isArchived: false };
    if (queryTokens.length > 0) {
      // Each token must match at least one identity field.
      where.AND = queryTokens.map((token) => ({
        OR: [
          { employeeCode: { contains: token, mode: "insensitive" } },
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      }));
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    return { success: true, data: employees };
  } catch (error) {
    console.error("Failed to list lockable employees", error);
    return { success: false, error: "Failed to load employees" };
  }
}

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

    // For employee-targeted lock operations, ensure daily attendance rows exist first.
    // Only backfill missing rows; do not recompute existing ones during lock action.
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
      // If punch is moved to another day, block edits when target day is locked.
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
      if (att.actualInAt && !att.actualOutAt) {
        status = ATTENDANCE_STATUS.INCOMPLETE;
      }

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

// KIOSK ATTENDANCE PART
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

    const expected = await getExpectedShiftForDate(
      employee.employeeId,
      dayStart,
    );
    const punches = await db.punch.findMany({
      where: {
        employeeId: employee.employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
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
    const expected = await getExpectedShiftForDate(
      employee.employeeId,
      todayStart,
    );
    const dayState = await getAttendanceFreezeStateForMoment(
      employee.employeeId,
      now,
    );
    if (dayState?.payrollPeriodId) {
      return {
        success: false,
        error:
          "Attendance is already linked to payroll for today. Contact payroll admin for adjustment.",
        reason: "payroll_linked",
      };
    }
    if (dayState?.isLocked) {
      return {
        success: false,
        error: "Attendance is locked for today. Contact admin to unlock.",
        reason: "attendance_locked",
      };
    }

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
        (now.getTime() - todayStart.getTime()) / 60000,
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
    // Batch recompute all active employees for a specific day.
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
