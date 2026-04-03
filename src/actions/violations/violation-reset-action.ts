"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  VIOLATION_RESET_FREQUENCY,
  applyDueViolationAutoResetsInternal,
  canManageViolationResets,
  clampDayOfMonth,
  clampMonthOfYear,
  computeNextPolicyRunAt,
  parseDateInput,
  parseResetFrequency,
  runViolationAutoResetPolicyNowInternal,
  serializeAutoPolicyRow,
  serializeResetRow,
  toIsoString,
  toMidnight,
  violationAutoResetPolicyInclude,
  employeeViolationResetInclude,
} from "./violations-shared";
import type {
  EmployeeViolationResetRow,
  ViolationAutoResetPolicyRow,
  ViolationResetFrequencyValue,
} from "./types";

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
      include: employeeViolationResetInclude,
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
      include: violationAutoResetPolicyInclude,
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
      include: violationAutoResetPolicyInclude,
    });

    return { success: true, data: serializeAutoPolicyRow(updated) };
  } catch (error) {
    console.error("Error updating violation auto reset policy:", error);
    return { success: false, error: "Failed to update auto reset policy." };
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
      include: violationAutoResetPolicyInclude,
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
