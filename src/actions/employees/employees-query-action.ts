"use server";

import { db } from "@/lib/db";
import { generateUniqueEmployeeCode } from "@/lib/employees/employee-code";
import {
  employeeLookupInclude,
  getFallbackRateHistory,
  isMissingRateHistoryTableError,
  serializeEmployeeRecord,
  serializeEmployeeWithLookups,
  toRateNumber,
} from "./employees-shared";
import type { EmployeeActionRecord, EmployeeRateHistoryItem } from "./types";

export async function getEmployees(): Promise<{
  success: boolean;
  data?: EmployeeActionRecord[];
  error?: string;
}> {
  try {
    console.log("Fetching employees...");
    const employees = await db.employee.findMany({
      orderBy: { employeeCode: "asc" },
      include: employeeLookupInclude,
    });
    const normalized = employees.map(serializeEmployeeWithLookups);
    console.log(`Fetched ${employees.length} employees`);
    return { success: true, data: normalized };
  } catch (error) {
    console.error("Error in getEmployees:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: "Failed to fetch employees. Check server logs for details.",
    };
  }
}

export async function getEmployeeById(id: string | undefined): Promise<{
  success: boolean;
  data?: EmployeeActionRecord | null;
  error?: string;
}> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Employee ID is required",
      };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId: id },
      include: employeeLookupInclude,
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with ID ${id} not found`,
      };
    }

    return { success: true, data: serializeEmployeeWithLookups(employee) };
  } catch (error) {
    console.error(`Error fetching employee with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

export async function getEmployeeRateHistory(
  employeeId: string | undefined,
): Promise<{
  success: boolean;
  data?: EmployeeRateHistoryItem[];
  warning?: string;
  error?: string;
}> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  try {
    const rows = await db.employeeRateHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true,
        employeeId: true,
        dailyRate: true,
        hourlyRate: true,
        monthlyRate: true,
        payrollFrequency: true,
        effectiveFrom: true,
        reason: true,
        createdAt: true,
      },
    });

    if (rows.length === 0) {
      return {
        success: true,
        data: await getFallbackRateHistory(employeeId, "Current employee rate"),
      };
    }

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        dailyRate: toRateNumber(row.dailyRate),
        hourlyRate: toRateNumber(row.hourlyRate),
        monthlyRate: toRateNumber(row.monthlyRate),
        payrollFrequency: row.payrollFrequency,
        effectiveFrom: row.effectiveFrom.toISOString(),
        reason: row.reason ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (isMissingRateHistoryTableError(error)) {
      console.warn(
        "EmployeeRateHistory table is not available yet. Returning empty history.",
      );
      const fallback = await getFallbackRateHistory(
        employeeId,
        "Current employee rate (history table not yet migrated)",
      );
      return {
        success: true,
        data: fallback,
        warning: "Rate history table not found. Run database migration.",
      };
    }
    console.error(
      `Error fetching rate history for employee ${employeeId}:`,
      error,
    );
    return {
      success: false,
      error: "An error occurred while fetching employee rate history",
    };
  }
}

export async function getGeneratedEmployeeCode(): Promise<{
  success: boolean;
  employeeCode?: string;
  error?: string;
}> {
  try {
    const employeeCode = await generateUniqueEmployeeCode();
    return { success: true, employeeCode };
  } catch (error) {
    console.error("Failed to generate employee code:", error);
    return { success: false, error: "Failed to generate employee code" };
  }
}

export async function getEmployeeByCode(code: string): Promise<{
  success: boolean;
  data?: EmployeeActionRecord | null;
  error?: string;
}> {
  try {
    const employee = await db.employee.findUnique({
      where: { employeeCode: code },
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with code ${code} not found`,
      };
    }

    return { success: true, data: serializeEmployeeRecord(employee) };
  } catch (error) {
    console.error(`Error fetching employee with code ${code}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

export async function getEmployeeByUserId(userId: string): Promise<{
  success: boolean;
  data?: EmployeeActionRecord | null;
  error?: string;
}> {
  try {
    const employee = await db.employee.findFirst({
      where: { userId },
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with user ID ${userId} not found`,
      };
    }

    return { success: true, data: serializeEmployeeRecord(employee) };
  } catch (error) {
    console.error(`Error fetching employee with user ID ${userId}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

export async function getEmployeesWithoutUser() {
  try {
    const employees = await db.employee.findMany({
      where: {
        user: null,
      },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
        img: true,
      },
      orderBy: {
        employeeCode: "asc",
      },
    });

    return {
      success: true,
      data: employees,
    };
  } catch (error) {
    console.error("Error fetching employees without user accounts:", error);
    return {
      success: false,
      error: "Failed to fetch employees without user accounts",
    };
  }
}

export async function getDepartments(): Promise<{
  success: boolean;
  data?: { departmentId: string; name: string }[];
  error?: string;
}> {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      select: { departmentId: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: departments,
    };
  } catch (error) {
    console.error("Error fetching departments:", error);
    return {
      success: false,
      error: "Failed to fetch departments. Please try again later.",
    };
  }
}
