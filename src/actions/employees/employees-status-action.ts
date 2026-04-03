"use server";

import { db } from "@/lib/db";
import { revalidateEmployeePages } from "./employees-shared";

export async function setEmployeeArchiveStatus(
  employeeId: string,
  isArchived: boolean,
): Promise<{
  success: boolean;
  data?: { employeeId: string; isArchived: boolean; userUpdated: boolean };
  error?: string;
}> {
  try {
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const existing = await db.employee.findUnique({
      where: { employeeId },
      include: { user: true },
    });

    if (!existing) {
      return {
        success: false,
        error: `Employee with ID ${employeeId} not found`,
      };
    }

    const employee = await db.employee.update({
      where: { employeeId },
      data: {
        isArchived: Boolean(isArchived),
        updatedAt: new Date(),
      },
    });

    let userUpdated = false;
    if (existing.user) {
      await db.user.update({
        where: { userId: existing.user.userId },
        data: { isDisabled: Boolean(isArchived) },
      });
      userUpdated = true;
    }

    revalidateEmployeePages(employee.employeeId);
    return {
      success: true,
      data: {
        employeeId: employee.employeeId,
        isArchived: employee.isArchived,
        userUpdated,
      },
    };
  } catch (error) {
    console.error(`Failed to update employee ${employeeId}:`, error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update employee status";
    return { success: false, error: message };
  }
}

export async function deleteEmployee(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!id) {
      return { success: false, error: "Employee ID is required" };
    }

    const existing = await db.employee.findUnique({
      where: { employeeId: id },
      select: { employeeId: true, userId: true },
    });
    if (!existing) {
      return { success: false, error: `Employee with ID ${id} not found` };
    }

    await db.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.employee.update({
          where: { employeeId: id },
          data: { userId: null },
        });
      }
      await tx.employee.delete({ where: { employeeId: id } });
    });

    revalidateEmployeePages(id);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting employee with ID ${id}:`, error);
    return {
      success: false,
      error: `Failed to delete employee: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
