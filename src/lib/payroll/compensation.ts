import "server-only";

import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseIsoDateAtNoonUtc,
  shiftDateByDays,
  toDateKeyInTz,
  toNumberOrNull,
} from "@/lib/payroll/helpers";

export type CompensationSnapshot = {
  positionId: string;
  positionName: string;
  dailyRate: number | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  currencyCode: string;
};

type PositionRateLike = {
  positionId?: string | null;
  name?: string | null;
  dailyRate?: unknown;
  hourlyRate?: unknown;
  monthlyRate?: unknown;
  currencyCode?: string | null;
};

const DEFAULT_CURRENCY_CODE = "PHP";

const normalizeCompensationSnapshot = (
  source: PositionRateLike | null | undefined,
): CompensationSnapshot | null => {
  if (!source?.positionId || !source.name) return null;

  const directDailyRate = toNumberOrNull(source.dailyRate);
  const directHourlyRate = toNumberOrNull(source.hourlyRate);
  const directMonthlyRate = toNumberOrNull(source.monthlyRate);

  const dailyRate =
    directDailyRate ??
    (directMonthlyRate != null
      ? Number((directMonthlyRate / 26).toFixed(2))
      : directHourlyRate != null
        ? Number((directHourlyRate * 8).toFixed(2))
        : null);
  const hourlyRate =
    directHourlyRate ??
    (dailyRate != null ? Number((dailyRate / 8).toFixed(2)) : null);
  const monthlyRate =
    directMonthlyRate ??
    (dailyRate != null ? Number((dailyRate * 26).toFixed(2)) : null);

  return {
    positionId: source.positionId,
    positionName: source.name,
    dailyRate,
    hourlyRate,
    monthlyRate,
    currencyCode: source.currencyCode?.trim() || DEFAULT_CURRENCY_CODE,
  };
};

const toDateKey = (value: Date | string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? String(value)
    : toDateKeyInTz(value);

export const buildCompensationLookupKey = (
  employeeId: string,
  workDate: Date | string,
) => `${employeeId}::${toDateKey(workDate)}`;

const getDateBounds = (employeeDates: Map<string, Date[]>) => {
  const allDates = [...employeeDates.values()].flat();
  if (allDates.length === 0) return null;

  const sorted = [...allDates].sort((left, right) => left.getTime() - right.getTime());
  return {
    minDate: sorted[0],
    maxDate: sorted[sorted.length - 1],
  };
};

const listUniqueSortedDateKeys = (dates: Date[]) =>
  [...new Set(dates.map((date) => toDateKeyInTz(date)))].sort();

const isDateKeyCovered = (
  dateKey: string,
  startAt: Date,
  endAt: Date | null,
) => {
  const startKey = toDateKeyInTz(startAt);
  if (startKey > dateKey) return false;
  if (!endAt) return true;
  return toDateKeyInTz(endAt) >= dateKey;
};

const pickEffectiveRow = <T extends { effectiveFrom: Date; effectiveTo?: Date | null }>(
  rows: T[],
  dateKey: string,
) => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (isDateKeyCovered(dateKey, row.effectiveFrom, row.effectiveTo ?? null)) {
      return row;
    }
  }

  return null;
};

export async function resolveEmployeeCompensationSnapshots(input: {
  employeeDates: Map<string, Date[]>;
  client?: Prisma.TransactionClient;
}) {
  const client = input.client ?? db;
  const employeeIds = [...input.employeeDates.keys()];
  if (employeeIds.length === 0) {
    return new Map<string, CompensationSnapshot | null>();
  }

  const bounds = getDateBounds(input.employeeDates);
  if (!bounds) {
    return new Map<string, CompensationSnapshot | null>();
  }

  const [employees, assignmentRows] = await Promise.all([
    client.employee.findMany({
      where: { employeeId: { in: employeeIds } },
      select: {
        employeeId: true,
        position: {
          select: {
            positionId: true,
            name: true,
            dailyRate: true,
            hourlyRate: true,
            monthlyRate: true,
            currencyCode: true,
          },
        },
      },
    }),
    client.employeePositionHistory.findMany({
      where: {
        employeeId: { in: employeeIds },
        effectiveFrom: { lte: bounds.maxDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: bounds.minDate } }],
      },
      orderBy: [{ employeeId: "asc" }, { effectiveFrom: "asc" }],
      select: {
        employeeId: true,
        positionId: true,
        effectiveFrom: true,
        effectiveTo: true,
        position: {
          select: {
            positionId: true,
            name: true,
            dailyRate: true,
            hourlyRate: true,
            monthlyRate: true,
            currencyCode: true,
          },
        },
      },
    }),
  ]);

  const employeeFallbackPositions = new Map(
    employees.map((employee) => [
      employee.employeeId,
      normalizeCompensationSnapshot(employee.position),
    ]),
  );

  const positionIds = [
    ...new Set(
      assignmentRows
        .map((row) => row.positionId)
        .concat(
          employees
            .map((employee) => employee.position?.positionId ?? null)
            .filter((value): value is string => Boolean(value)),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const positionRateRows =
    positionIds.length === 0
      ? []
      : await client.positionRateHistory.findMany({
          where: {
            positionId: { in: positionIds },
            effectiveFrom: { lte: bounds.maxDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: bounds.minDate } }],
          },
          orderBy: [{ positionId: "asc" }, { effectiveFrom: "asc" }],
          select: {
            positionId: true,
            dailyRate: true,
            hourlyRate: true,
            monthlyRate: true,
            currencyCode: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        });

  const assignmentsByEmployee = new Map<
    string,
    Array<
      (typeof assignmentRows)[number] & {
        fallbackPosition: CompensationSnapshot | null;
      }
    >
  >();
  assignmentRows.forEach((row) => {
    if (!assignmentsByEmployee.has(row.employeeId)) {
      assignmentsByEmployee.set(row.employeeId, []);
    }
    assignmentsByEmployee.get(row.employeeId)!.push({
      ...row,
      fallbackPosition: normalizeCompensationSnapshot(row.position),
    });
  });

  const ratesByPosition = new Map<string, typeof positionRateRows>();
  positionRateRows.forEach((row) => {
    if (!ratesByPosition.has(row.positionId)) {
      ratesByPosition.set(row.positionId, []);
    }
    ratesByPosition.get(row.positionId)!.push(row);
  });

  const resolved = new Map<string, CompensationSnapshot | null>();

  input.employeeDates.forEach((dates, employeeId) => {
    const dateKeys = listUniqueSortedDateKeys(dates);
    const assignments = assignmentsByEmployee.get(employeeId) ?? [];
    const employeeFallback = employeeFallbackPositions.get(employeeId) ?? null;

    dateKeys.forEach((dateKey) => {
      const resolvedKey = buildCompensationLookupKey(employeeId, dateKey);
      const assignment = pickEffectiveRow(assignments, dateKey);

      if (!assignment) {
        resolved.set(
          resolvedKey,
          assignments.length === 0 ? employeeFallback : null,
        );
        return;
      }

      if (!assignment.positionId) {
        resolved.set(resolvedKey, null);
        return;
      }

      const positionRates = ratesByPosition.get(assignment.positionId) ?? [];
      const rateRow = pickEffectiveRow(positionRates, dateKey);

      if (rateRow) {
        resolved.set(
          resolvedKey,
          normalizeCompensationSnapshot({
            positionId: assignment.positionId,
            name: assignment.position?.name ?? assignment.fallbackPosition?.positionName,
            dailyRate: rateRow.dailyRate,
            hourlyRate: rateRow.hourlyRate,
            monthlyRate: rateRow.monthlyRate,
            currencyCode: rateRow.currencyCode,
          }),
        );
        return;
      }

      resolved.set(
        resolvedKey,
        positionRates.length === 0 ? assignment.fallbackPosition : null,
      );
    });
  });

  return resolved;
}

export const listDateKeysInRange = (startKey: string, endKey: string) => {
  const keys: string[] = [];
  let cursor = parseIsoDateAtNoonUtc(startKey);
  if (!cursor || !parseIsoDateAtNoonUtc(endKey) || startKey > endKey) return keys;

  while (toDateKeyInTz(cursor) <= endKey) {
    keys.push(toDateKeyInTz(cursor));
    cursor = shiftDateByDays(cursor, 1);
  }

  return keys;
};

export const listMonthDateKeys = (monthStartKey: string) => {
  const monthStart = parseIsoDateAtNoonUtc(monthStartKey);
  if (!monthStart) return [];

  const startMonth = monthStartKey.slice(0, 7);
  const keys: string[] = [];
  let cursor = monthStart;

  while (toDateKeyInTz(cursor).startsWith(startMonth)) {
    keys.push(toDateKeyInTz(cursor));
    cursor = shiftDateByDays(cursor, 1);
  }

  return keys;
};
