"use server";

import { db } from "@/lib/db";

export type DepartmentOption = {
  departmentId: string;
  name: string;
};

export type DepartmentDetail = {
  departmentId: string;
  name: string;
  description?: string | null;
  positions: {
    positionId: string;
    name: string;
    employees: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    }[];
  }[];
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    position?: { name: string | null; positionId: string | null } | null;
  }[];
};

export async function listDepartments(): Promise<{
  success: boolean;
  data?: DepartmentDetail[];
  error?: string;
}> {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        departmentId: true,
        name: true,
        description: true,
        positions: {
          select: {
            positionId: true,
            name: true,
            employees: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        employees: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: { select: { name: true, positionId: true } },
          },
        },
      },
    });

    return { success: true, data: departments };
  } catch (error) {
    console.error("Failed to fetch departments", error);
    return { success: false, error: "Failed to load departments" };
  }
}

export async function listDepartmentOptions(): Promise<{
  success: boolean;
  data?: DepartmentOption[];
  error?: string;
}> {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      select: { departmentId: true, name: true },
      orderBy: { name: "asc" },
    });

    return { success: true, data: departments };
  } catch (error) {
    console.error("Failed to fetch department options", error);
    return { success: false, error: "Failed to load departments" };
  }
}

export async function createDepartment(input: {
  name: string;
  description?: string | null;
}): Promise<{
  success: boolean;
  data?: { departmentId: string; name: string; description?: string | null };
  error?: string;
}> {
  try {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;

    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db.department.findFirst({
      where: { name, isActive: true },
      select: { departmentId: true },
    });
    if (existing) {
      return { success: false, error: "Department already exists" };
    }

    const department = await db.department.create({
      data: { name, description },
      select: { departmentId: true, name: true, description: true },
    });

    return { success: true, data: department };
  } catch (error) {
    console.error("Failed to create department", error);
    return { success: false, error: "Failed to create department" };
  }
}

export async function updateDepartment(input: {
  departmentId: string;
  name: string;
  description?: string | null;
}): Promise<{
  success: boolean;
  data?: { departmentId: string; name: string; description?: string | null };
  error?: string;
}> {
  try {
    const departmentId =
      typeof input.departmentId === "string" ? input.departmentId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;

    if (!departmentId) {
      return { success: false, error: "Department ID is required" };
    }
    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const existingDept = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!existingDept) {
      return { success: false, error: "Department not found" };
    }

    const conflict = await db.department.findFirst({
      where: {
        departmentId: { not: departmentId },
        name,
        isActive: true,
      },
      select: { departmentId: true },
    });
    if (conflict) {
      return {
        success: false,
        error: "Another department already uses this name",
      };
    }

    const department = await db.department.update({
      where: { departmentId },
      data: { name, description },
      select: { departmentId: true, name: true, description: true },
    });

    return { success: true, data: department };
  } catch (error) {
    console.error("Failed to update department", error);
    return { success: false, error: "Failed to update department" };
  }
}
