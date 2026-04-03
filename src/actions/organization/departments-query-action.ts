"use server";

import { db } from "@/lib/db";
import {
  type DepartmentDetail,
  type DepartmentOption,
  toDepartmentLabel,
  toPositionLabel,
} from "./departments-shared";

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
