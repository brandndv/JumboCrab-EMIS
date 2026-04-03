import { Roles, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ViolationResetFrequencyValue } from "./types";

export const EMPLOYEE_VIOLATION_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const VIOLATION_RESET_FREQUENCY = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  YEARLY: "YEARLY",
} as const;

export const FIXED_STRIKE_POINTS_PER_VIOLATION = 1;
export const DEFAULT_MAX_STRIKES_PER_TYPE = 3;
export const MAX_STRIKES_REACHED_NOTE =
  "Max strikes reached for this violation type; kept for history only.";

let cachedHasViolationMaxStrikeColumn: boolean | null = null;

export const employeeViolationInclude = {
  employee: {
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      img: true,
    },
  },
  violation: {
    select: {
      violationId: true,
      name: true,
      description: true,
    },
  },
} satisfies Prisma.EmployeeViolationInclude;

export const employeeViolationResetInclude = {
  employee: {
    select: {
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },
  violation: {
    select: {
      name: true,
    },
  },
  createdBy: {
    select: {
      username: true,
    },
  },
} satisfies Prisma.EmployeeViolationResetInclude;

export const violationAutoResetPolicyInclude = {
  employee: {
    select: {
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },
  violation: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ViolationAutoResetPolicyInclude;

export const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
};

export const parseDateInput = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const clampDayOfMonth = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, Math.min(31, parsed));
};

export const clampMonthOfYear = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, Math.min(12, parsed));
};

export const toMidnight = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const toMonthDate = (year: number, monthIndex: number, dayOfMonth: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), lastDay);
  return new Date(year, monthIndex, safeDay, 0, 0, 0, 0);
};

export const computeNextPolicyRunAt = (input: {
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear?: number | null;
  fromDate: Date;
}) => {
  const dayOfMonth = clampDayOfMonth(input.dayOfMonth);
  const from = toMidnight(input.fromDate);

  if (input.frequency === VIOLATION_RESET_FREQUENCY.MONTHLY) {
    let candidate = toMonthDate(
      from.getFullYear(),
      from.getMonth(),
      dayOfMonth,
    );
    if (candidate <= from) {
      candidate = toMonthDate(
        from.getFullYear(),
        from.getMonth() + 1,
        dayOfMonth,
      );
    }
    return candidate;
  }

  if (input.frequency === VIOLATION_RESET_FREQUENCY.QUARTERLY) {
    const monthOfYear = clampMonthOfYear(input.monthOfYear);
    let candidate = toMonthDate(
      from.getFullYear(),
      monthOfYear - 1,
      dayOfMonth,
    );
    while (candidate <= from) {
      candidate = toMonthDate(
        candidate.getFullYear(),
        candidate.getMonth() + 3,
        dayOfMonth,
      );
    }
    return candidate;
  }

  const monthOfYear = clampMonthOfYear(input.monthOfYear);
  let candidate = toMonthDate(from.getFullYear(), monthOfYear - 1, dayOfMonth);
  if (candidate <= from) {
    candidate = toMonthDate(
      from.getFullYear() + 1,
      monthOfYear - 1,
      dayOfMonth,
    );
  }
  return candidate;
};

export const normalizeMaxStrikesPerEmployee = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_MAX_STRIKES_PER_TYPE;
  return Math.max(1, parsed);
};

export const hasViolationMaxStrikeColumn = async () => {
  if (cachedHasViolationMaxStrikeColumn != null) {
    return cachedHasViolationMaxStrikeColumn;
  }

  try {
    const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Violation'
          AND column_name = 'maxStrikesPerEmployee'
      ) AS "exists"
    `;
    cachedHasViolationMaxStrikeColumn = Boolean(rows[0]?.exists);
    return cachedHasViolationMaxStrikeColumn;
  } catch (error) {
    console.error("Could not check max strike column existence:", error);
    cachedHasViolationMaxStrikeColumn = false;
    return cachedHasViolationMaxStrikeColumn;
  }
};

export const getViolationMaxStrikesPerEmployee = async (violationId: string) => {
  const hasColumn = await hasViolationMaxStrikeColumn();
  if (!hasColumn) return DEFAULT_MAX_STRIKES_PER_TYPE;

  const row = await db.violation.findUnique({
    where: { violationId },
    select: { maxStrikesPerEmployee: true },
  });
  return normalizeMaxStrikesPerEmployee(row?.maxStrikesPerEmployee);
};

export const appendMaxStrikeNote = (current: string | null | undefined) => {
  const base = (current ?? "").trim();
  if (!base) return MAX_STRIKES_REACHED_NOTE;
  if (base.includes(MAX_STRIKES_REACHED_NOTE)) return base;
  return `${base} | ${MAX_STRIKES_REACHED_NOTE}`;
};

export const canManageViolationDefinitions = (role: Roles | undefined) =>
  role === Roles.Admin ||
  role === Roles.GeneralManager ||
  role === Roles.Manager;

export const canDraftViolations = (role: Roles | undefined) =>
  role === Roles.Supervisor || canManageViolationDefinitions(role);

export const canReviewViolations = (role: Roles | undefined) =>
  canManageViolationDefinitions(role);

export const canManageViolationResets = (role: Roles | undefined) =>
  canManageViolationDefinitions(role);

export const parseResetFrequency = (value: unknown) => {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === VIOLATION_RESET_FREQUENCY.MONTHLY) {
    return VIOLATION_RESET_FREQUENCY.MONTHLY;
  }
  if (normalized === VIOLATION_RESET_FREQUENCY.QUARTERLY) {
    return VIOLATION_RESET_FREQUENCY.QUARTERLY;
  }
  if (normalized === VIOLATION_RESET_FREQUENCY.YEARLY) {
    return VIOLATION_RESET_FREQUENCY.YEARLY;
  }
  return null;
};
