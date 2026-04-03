import { type Prisma } from "@prisma/client";
import type {
  EmployeeViolationResetRow,
  ViolationAutoResetPolicyRow,
  ViolationDefinitionOption,
  ViolationResetFrequencyValue,
  ViolationRow,
} from "./types";
import {
  DEFAULT_MAX_STRIKES_PER_TYPE,
  FIXED_STRIKE_POINTS_PER_VIOLATION,
  employeeViolationInclude,
  employeeViolationResetInclude,
  normalizeMaxStrikesPerEmployee,
  toIsoString,
  violationAutoResetPolicyInclude,
} from "./violations-core-shared";

type EmployeeViolationRecord = Prisma.EmployeeViolationGetPayload<{
  include: typeof employeeViolationInclude;
}>;

export const serializeViolation = (
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

export const toViolationDefinitionOption = (row: {
  violationId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  maxStrikesPerEmployee?: number | null;
}): ViolationDefinitionOption => ({
  violationId: row.violationId,
  name: row.name,
  description: row.description,
  defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
  maxStrikesPerEmployee: normalizeMaxStrikesPerEmployee(
    row.maxStrikesPerEmployee ?? DEFAULT_MAX_STRIKES_PER_TYPE,
  ),
  isActive: row.isActive,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

export const serializeResetRow = (
  row: Prisma.EmployeeViolationResetGetPayload<{
    include: typeof employeeViolationResetInclude;
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

export const serializeAutoPolicyRow = (
  row: Prisma.ViolationAutoResetPolicyGetPayload<{
    include: typeof violationAutoResetPolicyInclude;
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
