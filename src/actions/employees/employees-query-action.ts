"use server";

import { db } from "@/lib/db";
import { generateUniqueEmployeeCode } from "@/lib/employees/employee-code";
import {
  employeeLookupInclude,
  DEFAULT_CURRENCY_CODE,
  deriveCompensationRates,
  serializeJsonObject,
  serializeEmployeeRecord,
  serializeEmployeeWithLookups,
  toRateNumber,
} from "./employees-shared";
import type {
  EmployeeActionRecord,
  EmployeeCompensationHistoryItem,
  EmployeeDirectoryRecord,
  EmployeePositionHistoryItem,
} from "./types";

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

export async function getEmployeesDirectory(): Promise<{
  success: boolean;
  data?: EmployeeDirectoryRecord[];
  error?: string;
}> {
  try {
    const employees = await db.employee.findMany({
      orderBy: { employeeCode: "asc" },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        img: true,
        email: true,
        startDate: true,
        endDate: true,
        currentStatus: true,
        description: true,
        isArchived: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: employees.map((employee) => ({
        employeeId: employee.employeeId,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        img: employee.img ?? null,
        department: employee.department?.name ?? null,
        position: employee.position?.name ?? null,
        email: employee.email ?? null,
        startDate: employee.startDate?.toISOString() ?? null,
        endDate: employee.endDate?.toISOString() ?? null,
        currentStatus: employee.currentStatus ?? null,
        description: employee.description ?? null,
        isArchived: Boolean(employee.isArchived),
      })),
    };
  } catch (error) {
    console.error("Error in getEmployeesDirectory:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: "Failed to fetch employees directory. Check server logs for details.",
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

export async function getEmployeePositionHistory(
  employeeId: string | undefined,
): Promise<{
  success: boolean;
  data?: EmployeePositionHistoryItem[];
  error?: string;
}> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  try {
    const rows = await db.employeePositionHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true,
        employeeId: true,
        departmentId: true,
        positionId: true,
        effectiveFrom: true,
        effectiveTo: true,
        reason: true,
        metadata: true,
        createdByUserId: true,
        createdAt: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        departmentId: row.departmentId ?? null,
        departmentName: row.department?.name ?? null,
        positionId: row.positionId ?? null,
        positionName: row.position?.name ?? null,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo?.toISOString() ?? null,
        reason: row.reason ?? null,
        metadata: serializeJsonObject(row.metadata),
        createdByUserId: row.createdByUserId ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      `Error fetching position history for employee ${employeeId}:`,
      error,
    );
    return {
      success: false,
      error: "An error occurred while fetching employee position history",
    };
  }
}

const rangesOverlap = (
  leftStart: Date,
  leftEnd: Date | null,
  rightStart: Date,
  rightEnd: Date | null,
) => {
  const leftEndMs = leftEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEndMs = rightEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftStart.getTime() <= rightEndMs && rightStart.getTime() <= leftEndMs;
};

export async function getEmployeeCompensationHistory(
  employeeId: string | undefined,
): Promise<{
  success: boolean;
  data?: EmployeeCompensationHistoryItem[];
  error?: string;
}> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  try {
    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        startDate: true,
        positionId: true,
        position: {
          select: {
            positionId: true,
            name: true,
            dailyRate: true,
            hourlyRate: true,
            monthlyRate: true,
            currencyCode: true,
          },
        },
        positionHistory: {
          orderBy: { effectiveFrom: "desc" },
          select: {
            positionId: true,
            effectiveFrom: true,
            effectiveTo: true,
            position: { select: { name: true } },
          },
        },
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const assignments = employee.positionHistory
      .filter((row) => Boolean(row.positionId))
      .map((row) => ({
        positionId: row.positionId!,
        positionName: row.position?.name ?? "Unassigned position",
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo ?? null,
      }));

    if (assignments.length === 0 && employee.positionId && employee.position) {
      assignments.push({
        positionId: employee.positionId,
        positionName: employee.position.name,
        effectiveFrom: employee.startDate,
        effectiveTo: null,
      });
    }

    const positionIds = [...new Set(assignments.map((row) => row.positionId))];
    if (positionIds.length === 0) {
      return { success: true, data: [] };
    }

    const rows = await db.positionRateHistory.findMany({
      where: {
        positionId: { in: positionIds },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        positionId: true,
        dailyRate: true,
        hourlyRate: true,
        monthlyRate: true,
        currencyCode: true,
        effectiveFrom: true,
        effectiveTo: true,
        reason: true,
        metadata: true,
        createdByUserId: true,
        createdAt: true,
        position: { select: { name: true } },
      },
    });

    const filteredRows = rows.filter((row) =>
      assignments.some(
        (assignment) =>
          assignment.positionId === row.positionId &&
          rangesOverlap(
            assignment.effectiveFrom,
            assignment.effectiveTo,
            row.effectiveFrom,
            row.effectiveTo ?? null,
          ),
      ),
    );

    if (filteredRows.length === 0 && employee.position) {
      const fallbackRates = deriveCompensationRates(
        toRateNumber(employee.position.dailyRate),
      );
      return {
        success: true,
        data: [
          {
            id: `fallback-${employee.position.positionId}`,
            positionId: employee.position.positionId,
            positionName: employee.position.name,
            dailyRate: fallbackRates.dailyRate,
            hourlyRate:
              toRateNumber(employee.position.hourlyRate) ?? fallbackRates.hourlyRate,
            monthlyRate:
              toRateNumber(employee.position.monthlyRate) ?? fallbackRates.monthlyRate,
            currencyCode: employee.position.currencyCode ?? DEFAULT_CURRENCY_CODE,
            effectiveFrom: employee.startDate.toISOString(),
            effectiveTo: null,
            reason: "Current position rate",
            metadata: null,
            createdByUserId: null,
            createdAt: employee.startDate.toISOString(),
          },
        ],
      };
    }

    return {
      success: true,
      data: filteredRows.map((row) => ({
        id: row.id,
        positionId: row.positionId,
        positionName: row.position?.name ?? "Unknown position",
        dailyRate: toRateNumber(row.dailyRate),
        hourlyRate: toRateNumber(row.hourlyRate),
        monthlyRate: toRateNumber(row.monthlyRate),
        currencyCode: row.currencyCode ?? DEFAULT_CURRENCY_CODE,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo?.toISOString() ?? null,
        reason: row.reason ?? null,
        metadata: serializeJsonObject(row.metadata),
        createdByUserId: row.createdByUserId ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      `Error fetching compensation history for employee ${employeeId}:`,
      error,
    );
    return {
      success: false,
      error: "An error occurred while fetching employee compensation history",
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
