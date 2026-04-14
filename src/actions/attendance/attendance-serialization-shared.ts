import {
  ATTENDANCE_STATUS,
  type Attendance,
  type Punch,
} from "@prisma/client";
import {
  computeLateGraceCreditMinutes,
  computeScheduledPaidMinutes,
} from "@/lib/attendance";
import { startOfZonedDay } from "@/lib/timezone";
import { toNumberOrNull } from "./attendance-helpers-shared";

export type EmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  dailyRate?: unknown;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

export type AttendanceRecord = Attendance & {
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
  _count?: {
    suspiciousLogs?: number;
  };
};

export type PunchRecord = Punch & {
  employee?: EmployeeSummary | null;
};

export type AttendanceOverrides = {
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

const hasOverride = (
  overrides: AttendanceOverrides | undefined,
  key: keyof AttendanceOverrides,
) => Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, key));

export const toIsoString = (value: Date | string | null | undefined) => {
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

const toStringOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return null;
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

export const serializeEmployeeSummary = (employee?: EmployeeSummary | null) => {
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

export const serializePunch = (punch: PunchRecord) => {
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

export const serializePunchNullable = (punch: PunchRecord | null) =>
  punch ? serializePunch(punch) : null;

export const serializeAttendance = (
  record: AttendanceRecord,
  overrides?: AttendanceOverrides,
) => {
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
  const lateGraceCreditMinutes = hasOverride(
    overrides,
    "lateGraceCreditMinutes",
  )
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
    isFlagged: record.isFlagged ?? false,
    flaggedAt: toIsoString(record.flaggedAt),
    payrollPeriodId: record.payrollPeriodId ?? null,
    punchesCount,
    suspiciousLogCount: record._count?.suspiciousLogs ?? 0,
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
