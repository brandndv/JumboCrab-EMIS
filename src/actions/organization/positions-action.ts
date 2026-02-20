"use server";

import { db } from "@/lib/db";

export type PositionDetail = {
  positionId: string;
  name: string;
  description?: string | null;
  departmentId: string;
  department?: { departmentId: string; name: string } | null;
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
  }[];
};

export async function listPositions(): Promise<{
  success: boolean;
  data?: PositionDetail[];
  error?: string;
}> {
  try {
    const positions = await db.position.findMany({
      where: { isActive: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
        employees: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    return { success: true, data: positions };
  } catch (error) {
    console.error("Failed to fetch positions", error);
    return { success: false, error: "Failed to load positions" };
  }
}

export async function createPosition(input: {
  name: string;
  description?: string | null;
  departmentId: string;
}): Promise<{
  success: boolean;
  data?: {
    positionId: string;
    name: string;
    description?: string | null;
    departmentId: string;
    department?: { departmentId: string; name: string };
  };
  error?: string;
}> {
  try {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;
    const departmentId =
      typeof input.departmentId === "string"
        ? input.departmentId.trim()
        : "";

    if (!name) {
      return { success: false, error: "Name is required" };
    }
    if (!departmentId) {
      return { success: false, error: "Department is required" };
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const existing = await db.position.findFirst({
      where: { name, departmentId, isActive: true },
      select: { positionId: true },
    });
    if (existing) {
      return {
        success: false,
        error: "Position already exists in this department",
      };
    }

    const position = await db.position.create({
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return { success: true, data: position };
  } catch (error) {
    console.error("Failed to create position", error);
    return { success: false, error: "Failed to create position" };
  }
}

export async function updatePosition(input: {
  positionId: string;
  name: string;
  description?: string | null;
  departmentId: string;
}): Promise<{
  success: boolean;
  data?: {
    positionId: string;
    name: string;
    description?: string | null;
    departmentId: string;
    department?: { departmentId: string; name: string };
  };
  error?: string;
}> {
  try {
    const positionId =
      typeof input.positionId === "string" ? input.positionId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;
    const departmentId =
      typeof input.departmentId === "string"
        ? input.departmentId.trim()
        : "";

    if (!positionId) {
      return { success: false, error: "Position ID is required" };
    }
    if (!name) {
      return { success: false, error: "Name is required" };
    }
    if (!departmentId) {
      return { success: false, error: "Department is required" };
    }

    const position = await db.position.findUnique({
      where: { positionId },
      select: { positionId: true },
    });
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const conflict = await db.position.findFirst({
      where: {
        positionId: { not: positionId },
        name,
        departmentId,
        isActive: true,
      },
      select: { positionId: true },
    });
    if (conflict) {
      return {
        success: false,
        error: "Another position in this department uses this name",
      };
    }

    const updated = await db.position.update({
      where: { positionId },
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error("Failed to update position", error);
    return { success: false, error: "Failed to update position" };
  }
}

export async function deletePosition(positionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const id = typeof positionId === "string" ? positionId.trim() : "";
    if (!id) {
      return { success: false, error: "Position ID is required" };
    }

    const existing = await db.position.findUnique({
      where: { positionId: id },
      select: { positionId: true, name: true },
    });
    if (!existing) {
      return { success: false, error: "Position not found" };
    }

    await db.position.update({
      where: { positionId: id },
      data: {
        isActive: false,
        name: `${existing.name}__deleted__${existing.positionId}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to delete position", error);
    return { success: false, error: "Failed to delete position" };
  }
}
