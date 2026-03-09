"use server";

import {
  Roles,
  type EmployeeViolationStatus,
  type Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const EMPLOYEE_VIOLATION_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

const VIOLATION_RESET_FREQUENCY = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  YEARLY: "YEARLY",
} as const;

type ViolationResetFrequencyValue =
  (typeof VIOLATION_RESET_FREQUENCY)[keyof typeof VIOLATION_RESET_FREQUENCY];

const FIXED_STRIKE_POINTS_PER_VIOLATION = 1;
const DEFAULT_MAX_STRIKES_PER_TYPE = 3;
const MAX_STRIKES_REACHED_NOTE =
  "Max strikes reached for this violation type; kept for history only.";

let cachedHasViolationMaxStrikeColumn: boolean | null = null;

type EmployeeViolationRecord = Prisma.EmployeeViolationGetPayload<{
  include: {
    employee: {
      select: {
        employeeId: true;
        employeeCode: true;
        firstName: true;
        lastName: true;
        img: true;
      };
    };
    violation: {
      select: {
        violationId: true;
        name: true;
        description: true;
      };
    };
  };
}>;

export type ViolationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  violationId: string;
  violationName: string;
  violationDescription?: string | null;
  violationDate: string;
  strikePointsSnapshot: number;
  status: EmployeeViolationStatus;
  draftedById?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  isCountedForStrike: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
  remarks?: string | null;
  createdAt: string;
};

export type ViolationDefinitionOption = {
  violationId: string;
  name: string;
  description: string;
  defaultStrikePoints: number;
  maxStrikesPerEmployee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ViolationEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

export type EmployeeViolationResetRow = {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  violationId?: string | null;
  violationName?: string | null;
  effectiveFrom: string;
  reason: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
  autoPolicyId?: string | null;
  createdAt: string;
};

export type ViolationAutoResetPolicyRow = {
  id: string;
  name?: string | null;
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear?: number | null;
  effectiveFrom: string;
  nextRunAt: string;
  lastRunAt?: string | null;
  reasonTemplate?: string | null;
  appliesToAllEmployees: boolean;
  employeeId?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  violationId?: string | null;
  violationName?: string | null;
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ViolationStrikeProgressRow = {
  violationId: string;
  violationName: string;
  maxStrikesPerEmployee: number;
  currentCountedStrikes: number;
  progressLabel: string;
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
};

const parseDateInput = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const clampDayOfMonth = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, Math.min(31, parsed));
};

const clampMonthOfYear = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, Math.min(12, parsed));
};

const toMidnight = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const toMonthDate = (year: number, monthIndex: number, dayOfMonth: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), lastDay);
  return new Date(year, monthIndex, safeDay, 0, 0, 0, 0);
};

const computeNextPolicyRunAt = (input: {
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

const normalizeMaxStrikesPerEmployee = (value: unknown) => {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_MAX_STRIKES_PER_TYPE;
  return Math.max(1, parsed);
};

const hasViolationMaxStrikeColumn = async () => {
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
    // Fallback for environments where schema metadata query is restricted.
    console.error("Could not check max strike column existence:", error);
    cachedHasViolationMaxStrikeColumn = false;
    return cachedHasViolationMaxStrikeColumn;
  }
};

const getViolationMaxStrikesPerEmployee = async (violationId: string) => {
  const hasColumn = await hasViolationMaxStrikeColumn();
  if (!hasColumn) return DEFAULT_MAX_STRIKES_PER_TYPE;

  const row = await db.violation.findUnique({
    where: { violationId },
    select: { maxStrikesPerEmployee: true },
  });
  return normalizeMaxStrikesPerEmployee(row?.maxStrikesPerEmployee);
};

const appendMaxStrikeNote = (current: string | null | undefined) => {
  const base = (current ?? "").trim();
  if (!base) return MAX_STRIKES_REACHED_NOTE;
  if (base.includes(MAX_STRIKES_REACHED_NOTE)) return base;
  return `${base} | ${MAX_STRIKES_REACHED_NOTE}`;
};

const getLatestResetBaseline = async (
  employeeId: string,
  violationId: string,
) => {
  const latestReset = await db.employeeViolationReset.findFirst({
    where: {
      employeeId,
      OR: [{ violationId }, { violationId: null }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { effectiveFrom: true, createdAt: true },
  });

  return latestReset ?? null;
};

type ViolationAutoResetPolicyWorker = {
  id: string;
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear: number | null;
  nextRunAt: Date;
  reasonTemplate: string | null;
  appliesToAllEmployees: boolean;
  employeeId: string | null;
  violationId: string | null;
};

const getAutoPolicyTargetEmployeeIds = async (
  policy: ViolationAutoResetPolicyWorker,
) => {
  if (policy.appliesToAllEmployees) {
    const employees = await db.employee.findMany({
      where: { isArchived: false },
      select: { employeeId: true },
    });
    return employees.map((employee) => employee.employeeId);
  }

  if (policy.employeeId) {
    return [policy.employeeId];
  }

  return [];
};

const createAutoResetsForPolicyRunAt = async (
  policy: ViolationAutoResetPolicyWorker,
  targetEmployeeIds: string[],
  runAt: Date,
) => {
  if (targetEmployeeIds.length === 0) return 0;

  const existing = await db.employeeViolationReset.findMany({
    where: {
      autoPolicyId: policy.id,
      effectiveFrom: runAt,
      employeeId: { in: targetEmployeeIds },
      violationId: policy.violationId ?? null,
    },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((row) => row.employeeId));

  const rowsToCreate = targetEmployeeIds
    .filter((employeeId) => !existingIds.has(employeeId))
    .map((employeeId) => ({
      employeeId,
      violationId: policy.violationId ?? null,
      effectiveFrom: runAt,
      reason:
        policy.reasonTemplate?.trim() ||
        `Auto reset (${policy.frequency.toLowerCase()})`,
      autoPolicyId: policy.id,
    }));

  if (rowsToCreate.length === 0) return 0;
  await db.employeeViolationReset.createMany({ data: rowsToCreate });
  return rowsToCreate.length;
};

const applyDueViolationAutoResetsInternal = async () => {
  const now = toMidnight(new Date());
  const duePolicies = await db.violationAutoResetPolicy.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    orderBy: [{ nextRunAt: "asc" }],
    take: 100,
    select: {
      id: true,
      frequency: true,
      dayOfMonth: true,
      monthOfYear: true,
      nextRunAt: true,
      reasonTemplate: true,
      appliesToAllEmployees: true,
      employeeId: true,
      violationId: true,
    },
  });

  let processedPolicies = 0;
  let createdResets = 0;

  for (const policy of duePolicies) {
    processedPolicies += 1;

    const policyWorker: ViolationAutoResetPolicyWorker = {
      ...policy,
      frequency: policy.frequency as ViolationResetFrequencyValue,
    };
    const targetEmployeeIds =
      await getAutoPolicyTargetEmployeeIds(policyWorker);

    let runAt = toMidnight(policy.nextRunAt);
    let lastRunAt: Date | null = null;
    let guard = 0;

    while (runAt <= now && guard < 60) {
      guard += 1;
      createdResets += await createAutoResetsForPolicyRunAt(
        policyWorker,
        targetEmployeeIds,
        runAt,
      );

      lastRunAt = runAt;
      runAt = computeNextPolicyRunAt({
        frequency: policyWorker.frequency,
        dayOfMonth: policy.dayOfMonth,
        monthOfYear: policy.monthOfYear,
        fromDate: runAt,
      });
    }

    await db.violationAutoResetPolicy.update({
      where: { id: policy.id },
      data: {
        nextRunAt: runAt,
        ...(lastRunAt ? { lastRunAt } : {}),
      },
    });
  }

  return { processedPolicies, createdResets };
};

const runViolationAutoResetPolicyNowInternal = async (policyId: string) => {
  const now = toMidnight(new Date());
  const effectiveFrom = new Date(now);
  effectiveFrom.setDate(effectiveFrom.getDate() + 1);
  const policy = await db.violationAutoResetPolicy.findUnique({
    where: { id: policyId },
    select: {
      id: true,
      frequency: true,
      dayOfMonth: true,
      monthOfYear: true,
      nextRunAt: true,
      reasonTemplate: true,
      appliesToAllEmployees: true,
      employeeId: true,
      violationId: true,
      isActive: true,
    },
  });

  if (!policy) return { found: false, active: false, createdResets: 0 };
  if (!policy.isActive) return { found: true, active: false, createdResets: 0 };

  const policyWorker: ViolationAutoResetPolicyWorker = {
    ...policy,
    frequency: policy.frequency as ViolationResetFrequencyValue,
  };
  const targetEmployeeIds = await getAutoPolicyTargetEmployeeIds(policyWorker);
  const runAt = effectiveFrom;
  const createdResets = await createAutoResetsForPolicyRunAt(
    policyWorker,
    targetEmployeeIds,
    runAt,
  );
  const nextRunAt = computeNextPolicyRunAt({
    frequency: policyWorker.frequency,
    dayOfMonth: policyWorker.dayOfMonth,
    monthOfYear: policyWorker.monthOfYear,
    fromDate: runAt,
  });

  await db.violationAutoResetPolicy.update({
    where: { id: policy.id },
    data: {
      lastRunAt: runAt,
      nextRunAt,
    },
  });

  return {
    found: true,
    active: true,
    createdResets,
    runAt,
    nextRunAt,
  };
};

const countApprovedCountedStrikesForType = async (
  employeeId: string,
  violationId: string,
  options?: { skipAutoApply?: boolean },
) => {
  if (!options?.skipAutoApply) {
    await applyDueViolationAutoResetsInternal();
  }
  const resetBaseline = await getLatestResetBaseline(employeeId, violationId);

  return db.employeeViolation.count({
    where: {
      employeeId,
      violationId,
      status: EMPLOYEE_VIOLATION_STATUS.APPROVED,
      isCountedForStrike: true,
      voidedAt: null,
      ...(resetBaseline
        ? {
            violationDate: { gte: resetBaseline.effectiveFrom },
            createdAt: { gte: resetBaseline.createdAt },
          }
        : {}),
    },
  });
};

const canManageViolationDefinitions = (role: Roles | undefined) =>
  role === Roles.Admin ||
  role === Roles.GeneralManager ||
  role === Roles.Manager;

const canDraftViolations = (role: Roles | undefined) =>
  role === Roles.Supervisor || canManageViolationDefinitions(role);

const canReviewViolations = (role: Roles | undefined) =>
  canManageViolationDefinitions(role);

const canManageViolationResets = (role: Roles | undefined) =>
  canManageViolationDefinitions(role);

const serializeViolation = (
  violation: EmployeeViolationRecord,
): ViolationRow => {
  const employeeName = [
    violation.employee.firstName,
    violation.employee.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: violation.id,
    employeeId: violation.employeeId,
    employeeName: employeeName || "Unknown Employee",
    employeeCode: violation.employee.employeeCode,
    avatarUrl: violation.employee.img ?? null,
    violationId: violation.violationId,
    violationName: violation.violation.name,
    violationDescription: violation.violation.description ?? null,
    violationDate: toIsoString(violation.violationDate),
    strikePointsSnapshot: violation.strikePointsSnapshot,
    status: violation.status,
    draftedById: violation.draftedById ?? null,
    submittedAt: toIsoString(violation.submittedAt) || null,
    reviewedById: violation.reviewedById ?? null,
    reviewedAt: toIsoString(violation.reviewedAt) || null,
    reviewRemarks: violation.reviewRemarks ?? null,
    isAcknowledged: Boolean(violation.isAcknowledged),
    acknowledgedAt: toIsoString(violation.acknowledgedAt) || null,
    isCountedForStrike: Boolean(violation.isCountedForStrike),
    voidedAt: toIsoString(violation.voidedAt) || null,
    voidReason: violation.voidReason ?? null,
    remarks: violation.remarks ?? null,
    createdAt: toIsoString(violation.createdAt),
  };
};

export async function getViolations(input?: {
  employeeId?: string | null;
  start?: string | null;
  end?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }
    if (
      session.role !== Roles.Employee &&
      !canDraftViolations(session.role) &&
      !canReviewViolations(session.role)
    ) {
      return {
        success: false,
        error: "You are not allowed to view violations.",
      };
    }

    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const start =
      typeof input?.start === "string" && input.start.trim()
        ? parseDateInput(input.start)
        : null;
    const end =
      typeof input?.end === "string" && input.end.trim()
        ? parseDateInput(input.end)
        : null;

    if (input?.start && !start) {
      return { success: false, error: "Invalid start date" };
    }
    if (input?.end && !end) {
      return { success: false, error: "Invalid end date" };
    }
    if (start && end && end.getTime() < start.getTime()) {
      return { success: false, error: "end must be on/after start" };
    }

    const where: Prisma.EmployeeViolationWhereInput = {};

    if (session.role === Roles.Employee) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      where.employee = { userId: session.userId };
    }

    if (session.role === Roles.Supervisor) {
      if (!session.userId) {
        return { success: false, error: "Supervisor session is invalid." };
      }
      where.draftedById = session.userId;
    }

    if (employeeId) where.employeeId = employeeId;
    if (start || end) {
      where.violationDate = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      };
    }

    const violations = await db.employeeViolation.findMany({
      where,
      orderBy: [{ violationDate: "desc" }, { createdAt: "desc" }],
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
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
      },
    });

    return {
      success: true,
      data: violations.map(serializeViolation),
    };
  } catch (error) {
    console.error("Error fetching violations:", error);
    return {
      success: false,
      error: "Failed to fetch violations.",
    };
  }
}

export async function listViolationDefinitions(): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption[];
  error?: string;
}> {
  try {
    const hasMaxColumn = await hasViolationMaxStrikeColumn();

    if (hasMaxColumn) {
      const rows = await db.violation.findMany({
        orderBy: [{ name: "asc" }],
        select: {
          violationId: true,
          name: true,
          description: true,
          defaultStrikePoints: true,
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        data: rows.map((row) => ({
          violationId: row.violationId,
          name: row.name,
          description: row.description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee: normalizeMaxStrikesPerEmployee(
            row.maxStrikesPerEmployee,
          ),
          isActive: row.isActive,
          createdAt: toIsoString(row.createdAt),
          updatedAt: toIsoString(row.updatedAt),
        })),
      };
    }

    const rows = await db.violation.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        violationId: true,
        name: true,
        description: true,
        defaultStrikePoints: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        violationId: row.violationId,
        name: row.name,
        description: row.description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        maxStrikesPerEmployee: DEFAULT_MAX_STRIKES_PER_TYPE,
        isActive: row.isActive,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      })),
    };
  } catch (error) {
    console.error("Error listing violation definitions:", error);
    return { success: false, error: "Failed to load violation definitions." };
  }
}

export async function createViolationDefinition(input: {
  name: string;
  description?: string | null;
  maxStrikesPerEmployee?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationDefinitions(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create violation definitions.",
      };
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const maxStrikesPerEmployee = normalizeMaxStrikesPerEmployee(
      input.maxStrikesPerEmployee,
    );
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;
    const hasMaxColumn = await hasViolationMaxStrikeColumn();

    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const duplicate = await db.violation.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { violationId: true },
    });
    if (duplicate) {
      return { success: false, error: "Violation name already exists" };
    }

    if (hasMaxColumn) {
      const created = await db.violation.create({
        data: {
          name,
          description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee,
          isActive,
        },
        select: {
          violationId: true,
          name: true,
          description: true,
          defaultStrikePoints: true,
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return {
        success: true,
        data: {
          violationId: created.violationId,
          name: created.name,
          description: created.description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee: normalizeMaxStrikesPerEmployee(
            created.maxStrikesPerEmployee,
          ),
          isActive: created.isActive,
          createdAt: toIsoString(created.createdAt),
          updatedAt: toIsoString(created.updatedAt),
        },
      };
    }

    const created = await db.violation.create({
      data: {
        name,
        description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        isActive,
      },
      select: {
        violationId: true,
        name: true,
        description: true,
        defaultStrikePoints: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: {
        violationId: created.violationId,
        name: created.name,
        description: created.description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        maxStrikesPerEmployee: DEFAULT_MAX_STRIKES_PER_TYPE,
        isActive: created.isActive,
        createdAt: toIsoString(created.createdAt),
        updatedAt: toIsoString(created.updatedAt),
      },
    };
  } catch (error) {
    console.error("Error creating violation definition:", error);
    return { success: false, error: "Failed to create violation definition." };
  }
}

export async function updateViolationDefinition(input: {
  violationId: string;
  name: string;
  description?: string | null;
  maxStrikesPerEmployee?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationDefinitions(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update violation definitions.",
      };
    }

    const violationId =
      typeof input.violationId === "string" ? input.violationId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const maxStrikesPerEmployee = normalizeMaxStrikesPerEmployee(
      input.maxStrikesPerEmployee,
    );
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;
    const hasMaxColumn = await hasViolationMaxStrikeColumn();

    if (!violationId) {
      return { success: false, error: "Violation ID is required" };
    }
    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db.violation.findUnique({
      where: { violationId },
      select: { violationId: true },
    });
    if (!existing) {
      return { success: false, error: "Violation not found" };
    }

    const duplicate = await db.violation.findFirst({
      where: {
        violationId: { not: violationId },
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { violationId: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "Another violation already uses this name",
      };
    }

    if (hasMaxColumn) {
      const updated = await db.violation.update({
        where: { violationId },
        data: {
          name,
          description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee,
          isActive,
        },
        select: {
          violationId: true,
          name: true,
          description: true,
          defaultStrikePoints: true,
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return {
        success: true,
        data: {
          violationId: updated.violationId,
          name: updated.name,
          description: updated.description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee: normalizeMaxStrikesPerEmployee(
            updated.maxStrikesPerEmployee,
          ),
          isActive: updated.isActive,
          createdAt: toIsoString(updated.createdAt),
          updatedAt: toIsoString(updated.updatedAt),
        },
      };
    }

    const updated = await db.violation.update({
      where: { violationId },
      data: {
        name,
        description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        isActive,
      },
      select: {
        violationId: true,
        name: true,
        description: true,
        defaultStrikePoints: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: {
        violationId: updated.violationId,
        name: updated.name,
        description: updated.description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        maxStrikesPerEmployee: DEFAULT_MAX_STRIKES_PER_TYPE,
        isActive: updated.isActive,
        createdAt: toIsoString(updated.createdAt),
        updatedAt: toIsoString(updated.updatedAt),
      },
    };
  } catch (error) {
    console.error("Error updating violation definition:", error);
    return { success: false, error: "Failed to update violation definition." };
  }
}

export async function listEmployeesForViolation(input?: {
  query?: string | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ViolationEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canDraftViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to load employees.",
      };
    }
    if (session.role === Roles.Supervisor && !session.userId) {
      return { success: false, error: "Supervisor session is invalid." };
    }

    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 30;
    const limit = Math.max(1, Math.min(limitRaw, 200));

    const where: Prisma.EmployeeWhereInput = { isArchived: false };
    if (session.role === Roles.Supervisor && session.userId) {
      where.supervisorUserId = session.userId;
    }
    if (queryTokens.length > 0) {
      // Every token must match at least one identity field.
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

    if (!employeeId) return { success: true, data: employees };

    const hasRequestedEmployee = employees.some(
      (employee) => employee.employeeId === employeeId,
    );
    if (hasRequestedEmployee) return { success: true, data: employees };

    const requestedEmployee = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        isArchived: true,
        supervisorUserId: true,
      },
    });
    if (!requestedEmployee || requestedEmployee.isArchived) {
      return { success: true, data: employees };
    }
    if (
      session.role === Roles.Supervisor &&
      requestedEmployee.supervisorUserId !== session.userId
    ) {
      return { success: true, data: employees };
    }

    return {
      success: true,
      data: [
        {
          employeeId: requestedEmployee.employeeId,
          employeeCode: requestedEmployee.employeeCode,
          firstName: requestedEmployee.firstName,
          lastName: requestedEmployee.lastName,
        },
        ...employees,
      ],
    };
  } catch (error) {
    console.error("Error listing employees for violation:", error);
    return { success: false, error: "Failed to load employees." };
  }
}

export async function createEmployeeViolation(input: {
  employeeId: string;
  violationId: string;
  violationDate: string;
  remarks?: string | null;
  isAcknowledged?: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canDraftViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create employee violations.",
      };
    }

    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const violationId =
      typeof input.violationId === "string" ? input.violationId.trim() : "";
    const violationDateRaw =
      typeof input.violationDate === "string" ? input.violationDate.trim() : "";
    const remarks =
      typeof input.remarks === "string" && input.remarks.trim()
        ? input.remarks.trim()
        : null;
    const isAcknowledged = Boolean(input.isAcknowledged);
    const voidedAtRaw =
      typeof input.voidedAt === "string" ? input.voidedAt.trim() : "";
    const voidedAt =
      voidedAtRaw.length > 0 ? parseDateInput(voidedAtRaw) : null;
    const voidReason =
      typeof input.voidReason === "string" && input.voidReason.trim()
        ? input.voidReason.trim()
        : null;
    const acknowledgedAt = isAcknowledged ? new Date() : null;
    const createdStatus =
      session.role === Roles.Supervisor
        ? EMPLOYEE_VIOLATION_STATUS.DRAFT
        : EMPLOYEE_VIOLATION_STATUS.APPROVED;
    const createdAtNow = new Date();

    if (!employeeId) return { success: false, error: "employeeId is required" };
    if (!violationId)
      return { success: false, error: "violationId is required" };
    if (!violationDateRaw) {
      return { success: false, error: "violationDate is required" };
    }

    const violationDate = parseDateInput(violationDateRaw);
    if (!violationDate) {
      return { success: false, error: "Invalid violation date" };
    }

    // FETCH EMPLOYEE UNDER SUPERVISOR !//
    const [employee, violation] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          isArchived: true,
          supervisorUserId: true,
        },
      }),
      db.violation.findUnique({
        where: { violationId },
        select: {
          violationId: true,
          defaultStrikePoints: true,
          isActive: true,
        },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found" };
    }
    if (
      session.role === Roles.Supervisor &&
      employee.supervisorUserId !== session.userId
    ) {
      return {
        success: false,
        error: "You can only create violations for your subordinates.",
      };
    }
    if (!violation) {
      return { success: false, error: "Violation definition not found" };
    }
    if (!violation.isActive) {
      return {
        success: false,
        error: "Violation definition is inactive and cannot be assigned",
      };
    }
    if (voidedAtRaw.length > 0 && !voidedAt) {
      return { success: false, error: "Invalid voidedAt date" };
    }

    let strikePointsSnapshot = FIXED_STRIKE_POINTS_PER_VIOLATION;
    let isCountedForStrike = false;
    let reviewRemarks =
      createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
        ? "Directly approved by management"
        : null;

    if (createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED) {
      const countedSoFar = await countApprovedCountedStrikesForType(
        employeeId,
        violationId,
      );
      const maxStrikes = normalizeMaxStrikesPerEmployee(
        await getViolationMaxStrikesPerEmployee(violationId),
      );
      if (countedSoFar >= maxStrikes) {
        isCountedForStrike = false;
        strikePointsSnapshot = 0;
        reviewRemarks = appendMaxStrikeNote(reviewRemarks);
      } else {
        isCountedForStrike = true;
      }
    }

    const created = await db.employeeViolation.create({
      data: {
        employeeId,
        violationId,
        violationDate,
        strikePointsSnapshot,
        status: createdStatus,
        draftedById: session.userId ?? null,
        submittedAt:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? createdAtNow
            : null,
        reviewedById:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? (session.userId ?? null)
            : null,
        reviewedAt:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? createdAtNow
            : null,
        reviewRemarks,
        isAcknowledged,
        acknowledgedAt,
        isCountedForStrike,
        voidedAt,
        voidReason,
        remarks,
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
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
      },
    });

    return { success: true, data: serializeViolation(created) };
  } catch (error) {
    console.error("Error creating employee violation:", error);
    return { success: false, error: "Failed to create violation." };
  }
}

export async function setEmployeeViolationAcknowledged(input: {
  id: string;
  isAcknowledged: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
    }

    const target = await db.employeeViolation.findUnique({
      where: { id },
      select: { id: true, employee: { select: { userId: true } } },
    });
    if (!target) {
      return { success: false, error: "Violation not found" };
    }

    if (session.role === Roles.Employee) {
      if (!session.userId || target.employee.userId !== session.userId) {
        return {
          success: false,
          error: "You can only acknowledge your own records.",
        };
      }
    } else if (!canReviewViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update acknowledgement.",
      };
    }

    const updated = await db.employeeViolation.update({
      where: { id },
      data: {
        isAcknowledged: Boolean(input.isAcknowledged),
        acknowledgedAt: Boolean(input.isAcknowledged) ? new Date() : null,
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
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
      },
    });

    return { success: true, data: serializeViolation(updated) };
  } catch (error) {
    console.error("Error updating violation acknowledgement:", error);
    return { success: false, error: "Failed to update acknowledgement." };
  }
}

export async function reviewEmployeeViolation(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  reviewRemarks?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review violations.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const decision = input.decision;
    const reviewRemarks =
      typeof input.reviewRemarks === "string" && input.reviewRemarks.trim()
        ? input.reviewRemarks.trim()
        : null;

    if (!id) return { success: false, error: "id is required" };
    if (
      decision !== EMPLOYEE_VIOLATION_STATUS.APPROVED &&
      decision !== EMPLOYEE_VIOLATION_STATUS.REJECTED
    ) {
      return { success: false, error: "decision must be APPROVED or REJECTED" };
    }

    const existing = await db.employeeViolation.findUnique({
      where: { id },
      select: { id: true, status: true, employeeId: true, violationId: true },
    });
    if (!existing) {
      return { success: false, error: "Violation draft not found" };
    }
    if (existing.status !== EMPLOYEE_VIOLATION_STATUS.DRAFT) {
      return { success: false, error: "Only drafts can be reviewed" };
    }

    let isCountedForStrike = false;
    let strikePointsSnapshot = 0;
    let normalizedReviewRemarks = reviewRemarks;

    if (decision === EMPLOYEE_VIOLATION_STATUS.APPROVED) {
      const definition = await db.violation.findUnique({
        where: { violationId: existing.violationId },
        select: { violationId: true },
      });
      if (!definition) {
        return {
          success: false,
          error: "Violation definition not found for this draft.",
        };
      }

      const countedSoFar = await countApprovedCountedStrikesForType(
        existing.employeeId,
        existing.violationId,
      );
      const maxStrikes = normalizeMaxStrikesPerEmployee(
        await getViolationMaxStrikesPerEmployee(existing.violationId),
      );

      strikePointsSnapshot = FIXED_STRIKE_POINTS_PER_VIOLATION;
      if (countedSoFar >= maxStrikes) {
        isCountedForStrike = false;
        strikePointsSnapshot = 0;
        normalizedReviewRemarks = appendMaxStrikeNote(normalizedReviewRemarks);
      } else {
        isCountedForStrike = true;
      }
    }

    const reviewed = await db.employeeViolation.update({
      where: { id },
      data: {
        status: decision,
        reviewedById: session.userId ?? null,
        reviewedAt: new Date(),
        reviewRemarks: normalizedReviewRemarks,
        submittedAt: new Date(),
        strikePointsSnapshot,
        isCountedForStrike,
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
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
      },
    });

    return { success: true, data: serializeViolation(reviewed) };
  } catch (error) {
    console.error("Error reviewing employee violation:", error);
    return { success: false, error: "Failed to review violation." };
  }
}

const serializeResetRow = (
  row: Prisma.EmployeeViolationResetGetPayload<{
    include: {
      employee: {
        select: {
          employeeCode: true;
          firstName: true;
          lastName: true;
        };
      };
      violation: {
        select: {
          name: true;
        };
      };
      createdBy: {
        select: {
          username: true;
        };
      };
    };
  }>,
): EmployeeViolationResetRow => {
  const employeeName = [row.employee.firstName, row.employee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee.employeeCode,
    employeeName: employeeName || "Employee",
    violationId: row.violationId ?? null,
    violationName: row.violation?.name ?? null,
    effectiveFrom: toIsoString(row.effectiveFrom),
    reason: row.reason,
    createdByUserId: row.createdByUserId ?? null,
    createdByName: row.createdBy?.username ?? null,
    autoPolicyId: row.autoPolicyId ?? null,
    createdAt: toIsoString(row.createdAt),
  };
};

const serializeAutoPolicyRow = (
  row: Prisma.ViolationAutoResetPolicyGetPayload<{
    include: {
      employee: {
        select: {
          employeeCode: true;
          firstName: true;
          lastName: true;
        };
      };
      violation: {
        select: {
          name: true;
        };
      };
    };
  }>,
): ViolationAutoResetPolicyRow => {
  const employeeName = row.employee
    ? [row.employee.firstName, row.employee.lastName]
        .filter(Boolean)
        .join(" ")
        .trim()
    : null;

  return {
    id: row.id,
    name: row.name ?? null,
    frequency: row.frequency as ViolationResetFrequencyValue,
    dayOfMonth: row.dayOfMonth,
    monthOfYear: row.monthOfYear ?? null,
    effectiveFrom: toIsoString(row.effectiveFrom),
    nextRunAt: toIsoString(row.nextRunAt),
    lastRunAt: toIsoString(row.lastRunAt) || null,
    reasonTemplate: row.reasonTemplate ?? null,
    appliesToAllEmployees: Boolean(row.appliesToAllEmployees),
    employeeId: row.employeeId ?? null,
    employeeCode: row.employee?.employeeCode ?? null,
    employeeName: employeeName || null,
    violationId: row.violationId ?? null,
    violationName: row.violation?.name ?? null,
    isActive: Boolean(row.isActive),
    createdByUserId: row.createdByUserId ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
};

const parseResetFrequency = (value: unknown) => {
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

export async function resetEmployeeViolationStrikes(input: {
  employeeId: string;
  violationId?: string | null;
  effectiveFrom: string;
  reason: string;
}): Promise<{
  success: boolean;
  data?: EmployeeViolationResetRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to reset violations.",
      };
    }

    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const violationId =
      typeof input.violationId === "string" && input.violationId.trim()
        ? input.violationId.trim()
        : null;
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    const effectiveFromRaw =
      typeof input.effectiveFrom === "string" ? input.effectiveFrom.trim() : "";
    const parsedEffectiveFrom = parseDateInput(effectiveFromRaw);
    const effectiveFrom = parsedEffectiveFrom
      ? toMidnight(parsedEffectiveFrom)
      : null;

    if (!employeeId) return { success: false, error: "employeeId is required" };
    if (!reason) return { success: false, error: "reason is required" };
    if (!effectiveFrom) {
      return { success: false, error: "effectiveFrom is invalid" };
    }

    const [employee, violation] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: { employeeId: true, isArchived: true },
      }),
      violationId
        ? db.violation.findUnique({
            where: { violationId },
            select: { violationId: true },
          })
        : Promise.resolve(null),
    ]);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found" };
    }
    if (violationId && !violation) {
      return { success: false, error: "Violation definition not found" };
    }

    const duplicate = await db.employeeViolationReset.findFirst({
      where: {
        employeeId,
        violationId,
        effectiveFrom,
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A reset already exists for this employee/type/effective date.",
      };
    }

    const created = await db.employeeViolationReset.create({
      data: {
        employeeId,
        violationId,
        effectiveFrom,
        reason,
        createdByUserId: session.userId ?? null,
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
        createdBy: { select: { username: true } },
      },
    });

    return { success: true, data: serializeResetRow(created) };
  } catch (error) {
    console.error("Error resetting employee violation strikes:", error);
    return {
      success: false,
      error: "Failed to reset employee violation strikes.",
    };
  }
}

export async function listEmployeeViolationResets(input?: {
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: EmployeeViolationResetRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return { success: false, error: "You are not allowed to view resets." };
    }

    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 100;
    const limit = Math.max(1, Math.min(limitRaw, 300));

    const rows = await db.employeeViolationReset.findMany({
      where: employeeId ? { employeeId } : undefined,
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
        createdBy: { select: { username: true } },
      },
    });

    return { success: true, data: rows.map(serializeResetRow) };
  } catch (error) {
    console.error("Error listing violation resets:", error);
    return { success: false, error: "Failed to load violation resets." };
  }
}

export async function createViolationAutoResetPolicy(input: {
  name?: string | null;
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear?: number | null;
  effectiveFrom?: string | null;
  reasonTemplate?: string | null;
  appliesToAllEmployees?: boolean;
  employeeId?: string | null;
  violationId?: string | null;
  isActive?: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationAutoResetPolicyRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to manage auto reset policies.",
      };
    }

    const frequency = parseResetFrequency(input.frequency);
    if (!frequency) {
      return {
        success: false,
        error: "frequency must be MONTHLY, QUARTERLY, or YEARLY",
      };
    }

    const dayOfMonth = clampDayOfMonth(input.dayOfMonth);
    const monthOfYear =
      frequency === VIOLATION_RESET_FREQUENCY.YEARLY ||
      frequency === VIOLATION_RESET_FREQUENCY.QUARTERLY
        ? clampMonthOfYear(input.monthOfYear)
        : null;
    const appliesToAllEmployees =
      typeof input.appliesToAllEmployees === "boolean"
        ? input.appliesToAllEmployees
        : true;
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const violationId =
      typeof input.violationId === "string" && input.violationId.trim()
        ? input.violationId.trim()
        : null;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const reasonTemplate =
      typeof input.reasonTemplate === "string"
        ? input.reasonTemplate.trim()
        : "";
    const effectiveFromRaw =
      typeof input.effectiveFrom === "string" ? input.effectiveFrom.trim() : "";
    const parsedEffectiveFrom =
      effectiveFromRaw.length > 0
        ? parseDateInput(effectiveFromRaw)
        : new Date();
    const effectiveFrom = parsedEffectiveFrom
      ? toMidnight(parsedEffectiveFrom)
      : null;

    if (!effectiveFrom) {
      return { success: false, error: "effectiveFrom is invalid" };
    }
    if (!appliesToAllEmployees && !employeeId) {
      return {
        success: false,
        error: "employeeId is required when not applying to all employees.",
      };
    }

    const [employee, violation] = await Promise.all([
      employeeId
        ? db.employee.findUnique({
            where: { employeeId },
            select: { employeeId: true, isArchived: true },
          })
        : Promise.resolve(null),
      violationId
        ? db.violation.findUnique({
            where: { violationId },
            select: { violationId: true },
          })
        : Promise.resolve(null),
    ]);
    if (employeeId && (!employee || employee.isArchived)) {
      return { success: false, error: "Employee not found" };
    }
    if (violationId && !violation) {
      return { success: false, error: "Violation definition not found" };
    }

    const firstRunAt = computeNextPolicyRunAt({
      frequency,
      dayOfMonth,
      monthOfYear,
      fromDate: new Date(effectiveFrom.getTime() - 1),
    });

    const created = await db.violationAutoResetPolicy.create({
      data: {
        name: name || null,
        frequency,
        dayOfMonth,
        monthOfYear,
        effectiveFrom,
        nextRunAt: firstRunAt,
        reasonTemplate: reasonTemplate || null,
        appliesToAllEmployees,
        employeeId: appliesToAllEmployees ? null : employeeId,
        violationId,
        isActive: typeof input.isActive === "boolean" ? input.isActive : true,
        createdByUserId: session.userId ?? null,
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
      },
    });

    return { success: true, data: serializeAutoPolicyRow(created) };
  } catch (error) {
    console.error("Error creating violation auto reset policy:", error);
    return { success: false, error: "Failed to create auto reset policy." };
  }
}

export async function updateViolationAutoResetPolicy(input: {
  id: string;
  name?: string | null;
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear?: number | null;
  effectiveFrom?: string | null;
  reasonTemplate?: string | null;
  appliesToAllEmployees?: boolean;
  employeeId?: string | null;
  violationId?: string | null;
  isActive?: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationAutoResetPolicyRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update auto reset policies.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return { success: false, error: "id is required" };

    const existing = await db.violationAutoResetPolicy.findUnique({
      where: { id },
      select: {
        id: true,
        effectiveFrom: true,
        appliesToAllEmployees: true,
        employeeId: true,
        isActive: true,
      },
    });
    if (!existing) {
      return { success: false, error: "Auto reset policy not found" };
    }

    const frequency = parseResetFrequency(input.frequency);
    if (!frequency) {
      return {
        success: false,
        error: "frequency must be MONTHLY, QUARTERLY, or YEARLY",
      };
    }

    const dayOfMonth = clampDayOfMonth(input.dayOfMonth);
    const monthOfYear =
      frequency === VIOLATION_RESET_FREQUENCY.YEARLY ||
      frequency === VIOLATION_RESET_FREQUENCY.QUARTERLY
        ? clampMonthOfYear(input.monthOfYear)
        : null;
    const appliesToAllEmployees =
      typeof input.appliesToAllEmployees === "boolean"
        ? input.appliesToAllEmployees
        : existing.appliesToAllEmployees;
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : (existing.employeeId ?? null);
    const violationId =
      typeof input.violationId === "string" && input.violationId.trim()
        ? input.violationId.trim()
        : null;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const reasonTemplate =
      typeof input.reasonTemplate === "string"
        ? input.reasonTemplate.trim()
        : "";
    const effectiveFromRaw =
      typeof input.effectiveFrom === "string" ? input.effectiveFrom.trim() : "";
    const parsedEffectiveFrom =
      effectiveFromRaw.length > 0
        ? parseDateInput(effectiveFromRaw)
        : existing.effectiveFrom;
    const effectiveFrom = parsedEffectiveFrom
      ? toMidnight(parsedEffectiveFrom)
      : null;

    if (!effectiveFrom) {
      return { success: false, error: "effectiveFrom is invalid" };
    }
    if (!appliesToAllEmployees && !employeeId) {
      return {
        success: false,
        error: "employeeId is required when not applying to all employees.",
      };
    }

    const [employee, violation] = await Promise.all([
      !appliesToAllEmployees && employeeId
        ? db.employee.findUnique({
            where: { employeeId },
            select: { employeeId: true, isArchived: true },
          })
        : Promise.resolve(null),
      violationId
        ? db.violation.findUnique({
            where: { violationId },
            select: { violationId: true },
          })
        : Promise.resolve(null),
    ]);
    if (
      !appliesToAllEmployees &&
      employeeId &&
      (!employee || employee.isArchived)
    ) {
      return { success: false, error: "Employee not found" };
    }
    if (violationId && !violation) {
      return { success: false, error: "Violation definition not found" };
    }

    const now = toMidnight(new Date());
    const scheduleAnchor =
      effectiveFrom.getTime() > now.getTime() ? effectiveFrom : now;
    const nextRunAt = computeNextPolicyRunAt({
      frequency,
      dayOfMonth,
      monthOfYear,
      fromDate: new Date(scheduleAnchor.getTime() - 1),
    });

    const updated = await db.violationAutoResetPolicy.update({
      where: { id },
      data: {
        name: name || null,
        frequency,
        dayOfMonth,
        monthOfYear,
        effectiveFrom,
        nextRunAt,
        lastRunAt: null,
        reasonTemplate: reasonTemplate || null,
        appliesToAllEmployees,
        employeeId: appliesToAllEmployees ? null : employeeId,
        violationId,
        isActive:
          typeof input.isActive === "boolean"
            ? input.isActive
            : existing.isActive,
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
      },
    });

    return { success: true, data: serializeAutoPolicyRow(updated) };
  } catch (error) {
    console.error("Error updating violation auto reset policy:", error);
    return { success: false, error: "Failed to update auto reset policy." };
  }
}

export async function listViolationAutoResetPolicies(): Promise<{
  success: boolean;
  data?: ViolationAutoResetPolicyRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to view auto reset policies.",
      };
    }

    const rows = await db.violationAutoResetPolicy.findMany({
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "desc" }],
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
      },
    });

    return { success: true, data: rows.map(serializeAutoPolicyRow) };
  } catch (error) {
    console.error("Error listing violation auto reset policies:", error);
    return { success: false, error: "Failed to load auto reset policies." };
  }
}

export async function setViolationAutoResetPolicyActive(input: {
  id: string;
  isActive: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationAutoResetPolicyRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update auto reset policies.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return { success: false, error: "id is required" };

    const updated = await db.violationAutoResetPolicy.update({
      where: { id },
      data: { isActive: Boolean(input.isActive) },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        violation: { select: { name: true } },
      },
    });
    return { success: true, data: serializeAutoPolicyRow(updated) };
  } catch (error) {
    console.error("Error updating auto reset policy active state:", error);
    return { success: false, error: "Failed to update auto reset policy." };
  }
}

export async function deleteViolationAutoResetPolicy(input: {
  id: string;
}): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to delete auto reset policies.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return { success: false, error: "id is required" };

    await db.violationAutoResetPolicy.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("Error deleting auto reset policy:", error);
    return { success: false, error: "Failed to delete auto reset policy." };
  }
}

export async function runDueViolationAutoResets(): Promise<{
  success: boolean;
  data?: { processedPolicies: number; createdResets: number };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to run auto resets.",
      };
    }

    const applied = await applyDueViolationAutoResetsInternal();
    return { success: true, data: applied };
  } catch (error) {
    console.error("Error running due violation auto resets:", error);
    return { success: false, error: "Failed to run due auto resets." };
  }
}

export async function runViolationAutoResetPolicyNow(input: {
  id: string;
}): Promise<{
  success: boolean;
  data?: {
    policyId: string;
    createdResets: number;
    runAt: string;
    nextRunAt: string;
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationResets(session.role)) {
      return {
        success: false,
        error: "You are not allowed to run auto resets.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return { success: false, error: "id is required" };

    const result = await runViolationAutoResetPolicyNowInternal(id);
    if (!result.found) {
      return { success: false, error: "Auto reset policy not found." };
    }
    if (!result.active) {
      return { success: false, error: "Auto reset policy is inactive." };
    }

    return {
      success: true,
      data: {
        policyId: id,
        createdResets: result.createdResets,
        runAt: toIsoString(result.runAt),
        nextRunAt: toIsoString(result.nextRunAt),
      },
    };
  } catch (error) {
    console.error("Error running auto reset policy now:", error);
    return { success: false, error: "Failed to run auto reset policy now." };
  }
}

export async function getEmployeeViolationStrikeProgress(input: {
  employeeId: string;
}): Promise<{
  success: boolean;
  data?: ViolationStrikeProgressRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }
    if (
      session.role === Roles.Employee &&
      (!session.userId ||
        (await db.employee.findFirst({
          where: { employeeId: input.employeeId, userId: session.userId },
          select: { employeeId: true },
        })) == null)
    ) {
      return {
        success: false,
        error: "You are not allowed to view this employee's strike progress.",
      };
    }
    if (
      session.role !== Roles.Employee &&
      !canDraftViolations(session.role) &&
      !canReviewViolations(session.role)
    ) {
      return {
        success: false,
        error: "You are not allowed to view strike progress.",
      };
    }

    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    if (!employeeId) return { success: false, error: "employeeId is required" };

    await applyDueViolationAutoResetsInternal();

    const committedTypes = await db.employeeViolation.findMany({
      where: { employeeId },
      select: { violationId: true },
      distinct: ["violationId"],
    });
    if (committedTypes.length === 0) {
      return { success: true, data: [] };
    }

    const definitions = await db.violation.findMany({
      where: {
        violationId: {
          in: committedTypes.map((typeRow) => typeRow.violationId),
        },
      },
      orderBy: [{ name: "asc" }],
      select: {
        violationId: true,
        name: true,
      },
    });

    const rows: ViolationStrikeProgressRow[] = [];
    for (const definition of definitions) {
      const maxStrikes = await getViolationMaxStrikesPerEmployee(
        definition.violationId,
      );
      const currentCount = await countApprovedCountedStrikesForType(
        employeeId,
        definition.violationId,
        { skipAutoApply: true },
      );
      rows.push({
        violationId: definition.violationId,
        violationName: definition.name,
        maxStrikesPerEmployee: maxStrikes,
        currentCountedStrikes: currentCount,
        progressLabel: `${currentCount}/${maxStrikes}`,
      });
    }

    return { success: true, data: rows };
  } catch (error) {
    console.error("Error getting employee violation strike progress:", error);
    return {
      success: false,
      error: "Failed to load employee strike progress.",
    };
  }
}
