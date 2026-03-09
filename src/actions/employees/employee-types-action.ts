"use server";

import { Roles } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export type EmployeeTypeRecord = {
  employeeTypeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

const canManageEmployeeTypes = (role: Roles | undefined) =>
  role === Roles.Admin || role === Roles.GeneralManager || role === Roles.Manager;

const toIso = (value: Date | null | undefined) =>
  value instanceof Date ? value.toISOString() : null;

const serializeType = (row: {
  employeeTypeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmployeeTypeRecord => ({
  employeeTypeId: row.employeeTypeId,
  name: row.name,
  description: row.description,
  isActive: row.isActive,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function listEmployeeTypes(input?: {
  activeOnly?: boolean | null;
}): Promise<{
  success: boolean;
  data?: EmployeeTypeRecord[];
  error?: string;
}> {
  try {
    const activeOnly = input?.activeOnly !== false;
    const rows = await db.employeeType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        employeeTypeId: true,
        name: true,
        description: true,
        isActive: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: rows.map(serializeType),
    };
  } catch (error) {
    console.error("Error listing employee types:", error);
    return { success: false, error: "Failed to load employee types." };
  }
}

export async function createEmployeeType(input: {
  name: string;
  description?: string | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: EmployeeTypeRecord;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageEmployeeTypes(session.role)) {
      return { success: false, error: "You are not allowed to create employee types." };
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null;
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;

    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db.employeeType.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { employeeTypeId: true },
    });
    if (existing) {
      return { success: false, error: "Employee type already exists" };
    }

    const created = await db.employeeType.create({
      data: {
        name,
        description,
        isActive,
        createdByUserId: session.userId ?? null,
      },
      select: {
        employeeTypeId: true,
        name: true,
        description: true,
        isActive: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: serializeType(created) };
  } catch (error) {
    console.error("Error creating employee type:", error);
    return { success: false, error: "Failed to create employee type." };
  }
}

export async function assignEmployeeType(input: {
  employeeId: string;
  employeeTypeId?: string | null;
}): Promise<{
  success: boolean;
  data?: {
    employeeId: string;
    employeeTypeId: string | null;
    employeeTypeName: string | null;
    updatedAt: string | null;
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageEmployeeTypes(session.role)) {
      return { success: false, error: "You are not allowed to assign employee types." };
    }

    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const employeeTypeId =
      typeof input.employeeTypeId === "string" && input.employeeTypeId.trim()
        ? input.employeeTypeId.trim()
        : null;

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true },
    });
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    if (employeeTypeId) {
      const employeeType = await db.employeeType.findUnique({
        where: { employeeTypeId },
        select: { employeeTypeId: true },
      });
      if (!employeeType) {
        return { success: false, error: "Employee type not found" };
      }
    }

    const updated = await db.employee.update({
      where: { employeeId },
      data: {
        employeeTypeId,
        updatedAt: new Date(),
      },
      select: {
        employeeId: true,
        employeeTypeId: true,
        updatedAt: true,
        employeeType: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        employeeId: updated.employeeId,
        employeeTypeId: updated.employeeTypeId,
        employeeTypeName: updated.employeeType?.name ?? null,
        updatedAt: toIso(updated.updatedAt),
      },
    };
  } catch (error) {
    console.error("Error assigning employee type:", error);
    return { success: false, error: "Failed to assign employee type." };
  }
}
