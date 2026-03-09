"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

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

const serializeViolation = (violation: EmployeeViolationRecord): ViolationRow => {
  const employeeName = [violation.employee.firstName, violation.employee.lastName]
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
        defaultStrikePoints: row.defaultStrikePoints,
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
  defaultStrikePoints?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const defaultStrikePointsRaw =
      typeof input.defaultStrikePoints === "number" &&
      Number.isFinite(input.defaultStrikePoints)
        ? Math.floor(input.defaultStrikePoints)
        : 1;
    const defaultStrikePoints = Math.max(0, defaultStrikePointsRaw);
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;

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

    const created = await db.violation.create({
      data: {
        name,
        description,
        defaultStrikePoints,
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
        defaultStrikePoints: created.defaultStrikePoints,
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
  defaultStrikePoints?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const violationId =
      typeof input.violationId === "string" ? input.violationId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const defaultStrikePointsRaw =
      typeof input.defaultStrikePoints === "number" &&
      Number.isFinite(input.defaultStrikePoints)
        ? Math.floor(input.defaultStrikePoints)
        : 1;
    const defaultStrikePoints = Math.max(0, defaultStrikePointsRaw);
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;

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
      return { success: false, error: "Another violation already uses this name" };
    }

    const updated = await db.violation.update({
      where: { violationId },
      data: {
        name,
        description,
        defaultStrikePoints,
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
        defaultStrikePoints: updated.defaultStrikePoints,
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
      },
    });
    if (!requestedEmployee || requestedEmployee.isArchived) {
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
  isCountedForStrike?: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
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
    const isCountedForStrike =
      typeof input.isCountedForStrike === "boolean"
        ? input.isCountedForStrike
        : true;
    const voidedAtRaw =
      typeof input.voidedAt === "string" ? input.voidedAt.trim() : "";
    const voidedAt =
      voidedAtRaw.length > 0 ? parseDateInput(voidedAtRaw) : null;
    const voidReason =
      typeof input.voidReason === "string" && input.voidReason.trim()
        ? input.voidReason.trim()
        : null;
    const acknowledgedAt = isAcknowledged ? new Date() : null;

    if (!employeeId) return { success: false, error: "employeeId is required" };
    if (!violationId) return { success: false, error: "violationId is required" };
    if (!violationDateRaw) {
      return { success: false, error: "violationDate is required" };
    }

    const violationDate = parseDateInput(violationDateRaw);
    if (!violationDate) {
      return { success: false, error: "Invalid violation date" };
    }

    const [employee, violation] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: { employeeId: true, isArchived: true },
      }),
      db.violation.findUnique({
        where: { violationId },
        select: { violationId: true, defaultStrikePoints: true, isActive: true },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found" };
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

    const created = await db.employeeViolation.create({
      data: {
        employeeId,
        violationId,
        violationDate,
        strikePointsSnapshot: violation.defaultStrikePoints,
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
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
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
