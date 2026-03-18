"use server";

import { db } from "@/lib/db";

export type DepartmentOption = {
  departmentId: string;
  name: string;
};

export type DepartmentDetail = {
  departmentId: string;
  name: string;
  isActive: boolean;
  description?: string | null;
  positions: {
    positionId: string;
    name: string;
    isActive: boolean;
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
    position?: {
      name: string | null;
      positionId: string | null;
      isActive: boolean | null;
    } | null;
  }[];
};

const toPositionLabel = (position: {
  name: string;
  isActive: boolean;
}) => {
  const hasArchivedToken =
    position.name.includes("__deleted__") ||
    position.name.includes("__archived__");
  return !position.isActive || hasArchivedToken
    ? "Archived position"
    : position.name;
};

const toDepartmentLabel = (name: string, isActive: boolean) => {
  if (isActive) return name;
  return (
    name
      .split("__archived__")[0]
      .split("__deleted__")[0]
      .trim() || "Archived department"
  );
};

export async function listDepartments(): Promise<{
  success: boolean;
  data?: DepartmentDetail[];
  error?: string;
}> {
  return listDepartmentsWithOptions();
}

export async function listDepartmentsWithOptions(input?: {
  includeArchived?: boolean;
}): Promise<{
  success: boolean;
  data?: DepartmentDetail[];
  error?: string;
}> {
  try {
    const includeArchived = Boolean(input?.includeArchived);
    const departments = await db.department.findMany({
      where: includeArchived ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      select: {
        departmentId: true,
        name: true,
        isActive: true,
        description: true,
        positions: {
          where: { isActive: true },
          select: {
            positionId: true,
            name: true,
            isActive: true,
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
            position: { select: { name: true, positionId: true, isActive: true } },
          },
        },
      },
    });
    const data: DepartmentDetail[] = departments.map((department) => ({
      ...department,
      name: toDepartmentLabel(department.name, department.isActive),
      employees: department.employees.map((employee) => ({
        ...employee,
        position: employee.position
          ? {
              positionId: employee.position.positionId,
              name: toPositionLabel(employee.position),
              isActive: employee.position.isActive,
            }
          : null,
      })),
    }));

    return { success: true, data };
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

const isArchivedTokenName = (value: string) =>
  value.includes("__deleted__") || value.includes("__archived__");

const extractBaseName = (value: string) =>
  value
    .split("__archived__")[0]
    .split("__deleted__")[0]
    .trim();

const resolveDepartmentRestoreName = async (
  departmentId: string,
  baseName: string,
) => {
  const normalizedBase = baseName.trim() || "Department";
  const directConflict = await db.department.findFirst({
    where: {
      departmentId: { not: departmentId },
      isActive: true,
      name: normalizedBase,
    },
    select: { departmentId: true },
  });
  if (!directConflict) return normalizedBase;

  let counter = 1;
  while (counter <= 999) {
    const candidate =
      counter === 1
        ? `${normalizedBase} (Restored)`
        : `${normalizedBase} (Restored ${counter})`;
    const conflict = await db.department.findFirst({
      where: {
        departmentId: { not: departmentId },
        isActive: true,
        name: candidate,
      },
      select: { departmentId: true },
    });
    if (!conflict) return candidate;
    counter += 1;
  }

  return `${normalizedBase} (${Date.now()})`;
};

export async function archiveDepartment(departmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const id = typeof departmentId === "string" ? departmentId.trim() : "";
    if (!id) {
      return { success: false, error: "Department ID is required" };
    }

    const existing = await db.department.findUnique({
      where: { departmentId: id },
      select: { departmentId: true, name: true },
    });
    if (!existing) {
      return { success: false, error: "Department not found" };
    }

    await db.$transaction(async (tx) => {
      const nextName = isArchivedTokenName(existing.name)
        ? existing.name
        : `${existing.name}__archived__${existing.departmentId}`;

      await tx.department.update({
        where: { departmentId: id },
        data: {
          isActive: false,
          name: nextName,
        },
      });

      await tx.position.updateMany({
        where: { departmentId: id },
        data: { isActive: false },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to archive department", error);
    return { success: false, error: "Failed to archive department" };
  }
}

export async function unarchiveDepartment(departmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const id = typeof departmentId === "string" ? departmentId.trim() : "";
    if (!id) {
      return { success: false, error: "Department ID is required" };
    }

    const existing = await db.department.findUnique({
      where: { departmentId: id },
      select: { departmentId: true, name: true, isActive: true },
    });
    if (!existing) {
      return { success: false, error: "Department not found" };
    }
    if (existing.isActive) {
      return { success: true };
    }

    const baseName = extractBaseName(existing.name);
    const restoredName = await resolveDepartmentRestoreName(id, baseName);

    await db.department.update({
      where: { departmentId: id },
      data: {
        isActive: true,
        name: restoredName,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to unarchive department", error);
    return { success: false, error: "Failed to unarchive department" };
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
