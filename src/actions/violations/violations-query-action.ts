"use server";

import { Roles, type Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyDueViolationAutoResetsInternal,
  canDraftViolations,
  canManageViolationResets,
  canReviewViolations,
  countApprovedCountedStrikesForType,
  employeeViolationResetInclude,
  employeeViolationInclude,
  getViolationMaxStrikesPerEmployee,
  hasViolationMaxStrikeColumn,
  parseDateInput,
  serializeAutoPolicyRow,
  serializeResetRow,
  serializeViolation,
  toViolationDefinitionOption,
  violationAutoResetPolicyInclude,
} from "./violations-shared";
import type {
  EmployeeViolationResetRow,
  ViolationAutoResetPolicyRow,
  ViolationDefinitionOption,
  ViolationEmployeeOption,
  ViolationRow,
  ViolationStrikeProgressRow,
} from "./types";

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
      include: employeeViolationInclude,
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
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        data: rows.map(toViolationDefinitionOption),
      };
    }

    const rows = await db.violation.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        violationId: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: rows.map(toViolationDefinitionOption),
    };
  } catch (error) {
    console.error("Error listing violation definitions:", error);
    return { success: false, error: "Failed to load violation definitions." };
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
      include: employeeViolationResetInclude,
    });

    return { success: true, data: rows.map(serializeResetRow) };
  } catch (error) {
    console.error("Error listing violation resets:", error);
    return { success: false, error: "Failed to load violation resets." };
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
      include: violationAutoResetPolicyInclude,
    });

    return { success: true, data: rows.map(serializeAutoPolicyRow) };
  } catch (error) {
    console.error("Error listing violation auto reset policies:", error);
    return { success: false, error: "Failed to load auto reset policies." };
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
