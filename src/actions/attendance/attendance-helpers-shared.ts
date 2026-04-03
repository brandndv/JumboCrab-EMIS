import { db } from "@/lib/db";
import { endOfZonedDay, startOfZonedDay, TZ } from "@/lib/timezone";

export const toNumberOrNull = (value: unknown) => {
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

export const buildRateLookupKey = (employeeId: string, workDate: Date | string) =>
  `${employeeId}::${typeof workDate === "string" ? workDate : workDate.toISOString()}`;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const toDayKey = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: TZ });

export const buildEmployeeDayKey = (employeeId: string, date: Date) =>
  `${employeeId}::${toDayKey(date)}`;

export const resolveEffectiveDailyRates = async ({
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
    (latest, current) =>
      current.getTime() > latest.getTime() ? current : latest,
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
    const uniqueDateIsos = [
      ...new Set(dates.map((date) => date.toISOString())),
    ].sort();
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

      const rate = currentRate ?? (history.length === 0 ? fallbackRate : null);

      resolved.set(buildRateLookupKey(id, iso), rate);
    });
  });

  return resolved;
};

const isIpAllowed = (ip: string | null, raw: string | undefined) => {
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return Boolean(ip && list.includes(ip));
};

export const isSelfPunchIpAllowed = (ip: string | null) =>
  isIpAllowed(ip, process.env.ALLOWED_SELF_PUNCH_IPS);

export const parseDateInput = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getRangeBounds = (start: Date, end?: Date) => {
  const rangeStart = startOfZonedDay(start);
  const rangeEnd = end ? endOfZonedDay(end) : endOfZonedDay(start);
  return { rangeStart, rangeEnd };
};

export type AttendanceFreezeState = {
  isLocked: boolean;
  payrollPeriodId: string | null;
};

export const getAttendanceFreezeStateForMoment = async (
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

export const getAttendanceFreezeError = (
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
