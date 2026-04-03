import { db } from "@/lib/db";
import type { ViolationResetFrequencyValue } from "./types";
import {
  EMPLOYEE_VIOLATION_STATUS,
  computeNextPolicyRunAt,
  toMidnight,
} from "./violations-core-shared";

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

const getLatestResetBaseline = async (employeeId: string, violationId: string) => {
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

export const applyDueViolationAutoResetsInternal = async () => {
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
    const targetEmployeeIds = await getAutoPolicyTargetEmployeeIds(policyWorker);

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

export const runViolationAutoResetPolicyNowInternal = async (policyId: string) => {
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

export const countApprovedCountedStrikesForType = async (
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
