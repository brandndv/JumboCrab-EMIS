"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateKeyInTz } from "@/lib/payroll/helpers";
import {
  canGeneratePayroll,
  formatEmployeeName,
  normalizeEmployeeIds,
  resolvePayrollPeriod,
} from "./payroll-shared";
import type {
  PayrollEligibleEmployeeOption,
  PayrollGenerationReadiness,
} from "@/types/payroll";

export async function listPayrollEligibleEmployees(input?: {
  query?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: PayrollEligibleEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canGeneratePayroll(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const safeLimit =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.max(1, Math.min(Math.floor(input.limit), 500))
        : 300;
    const query = input?.query?.trim() ?? "";

    const rows = await db.employee.findMany({
      where: {
        isArchived: false,
        currentStatus: {
          notIn: ["INACTIVE", "ENDED"],
        },
        ...(query
          ? {
              OR: [
                { employeeCode: { contains: query, mode: "insensitive" } },
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: safeLimit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: formatEmployeeName(row),
      })),
    };
  } catch (error) {
    console.error("Error loading payroll-eligible employees:", error);
    return { success: false, error: "Failed to load eligible employees" };
  }
}

export async function getPayrollGenerationReadiness(input: {
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  employeeIds?: string[];
  limit?: number;
}): Promise<{
  success: boolean;
  data?: PayrollGenerationReadiness;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canGeneratePayroll(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const period = resolvePayrollPeriod({
      payrollPeriodStart: input.payrollPeriodStart,
      payrollPeriodEnd: input.payrollPeriodEnd,
    });
    if (!period.success) {
      return { success: false, error: period.error };
    }

    const scopedEmployeeIds = normalizeEmployeeIds(input.employeeIds);

    const activeEmployees = await db.employee.findMany({
      where: {
        isArchived: false,
        currentStatus: {
          notIn: ["INACTIVE", "ENDED"],
        },
        ...(scopedEmployeeIds.length > 0
          ? { employeeId: { in: scopedEmployeeIds } }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const employeeIds = activeEmployees.map((employee) => employee.employeeId);
    const safeLimit =
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.max(1, Math.min(Math.floor(input.limit), 200))
        : 20;

    if (employeeIds.length === 0) {
      return {
        success: true,
        data: {
          payrollPeriodStart: period.startKey,
          payrollPeriodEnd: period.endKey,
          activeEmployees: 0,
          employeesWithRows: 0,
          employeesWithUnlockedRows: 0,
          totalRows: 0,
          lockedRows: 0,
          unlockedRows: 0,
          allLocked: true,
          unlockedEmployees: [],
        },
      };
    }

    const rows = await db.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: period.startAt, lte: period.endAt },
        payrollPeriodId: null,
      },
      select: {
        employeeId: true,
        workDate: true,
        isLocked: true,
      },
    });

    let lockedRows = 0;
    const rowsPerEmployee = new Map<string, number>();
    const unlockedPerEmployee = new Map<
      string,
      { count: number; first: string; last: string }
    >();

    rows.forEach((row) => {
      rowsPerEmployee.set(
        row.employeeId,
        (rowsPerEmployee.get(row.employeeId) ?? 0) + 1,
      );

      if (row.isLocked) {
        lockedRows += 1;
        return;
      }

      const dateKey = toDateKeyInTz(row.workDate);
      const current = unlockedPerEmployee.get(row.employeeId);
      if (!current) {
        unlockedPerEmployee.set(row.employeeId, {
          count: 1,
          first: dateKey,
          last: dateKey,
        });
        return;
      }

      current.count += 1;
      if (dateKey < current.first) current.first = dateKey;
      if (dateKey > current.last) current.last = dateKey;
    });

    const byEmployee = new Map(
      activeEmployees.map((employee) => [employee.employeeId, employee]),
    );

    const unlockedEmployees = Array.from(unlockedPerEmployee.entries())
      .map(([employeeId, lock]) => {
        const employee = byEmployee.get(employeeId);
        return {
          employeeId,
          employeeCode: employee?.employeeCode ?? "—",
          employeeName: employee ? formatEmployeeName(employee) : "Unknown employee",
          unlockedRows: lock.count,
          firstUnlockedDate: lock.first,
          lastUnlockedDate: lock.last,
        };
      })
      .sort((a, b) => {
        if (b.unlockedRows !== a.unlockedRows) {
          return b.unlockedRows - a.unlockedRows;
        }
        return a.employeeName.localeCompare(b.employeeName);
      })
      .slice(0, safeLimit);

    const totalRows = rows.length;
    const unlockedRows = Math.max(0, totalRows - lockedRows);

    return {
      success: true,
      data: {
        payrollPeriodStart: period.startKey,
        payrollPeriodEnd: period.endKey,
        activeEmployees: activeEmployees.length,
        employeesWithRows: rowsPerEmployee.size,
        employeesWithUnlockedRows: unlockedPerEmployee.size,
        totalRows,
        lockedRows,
        unlockedRows,
        allLocked: unlockedRows === 0,
        unlockedEmployees,
      },
    };
  } catch (error) {
    console.error("Error loading payroll generation readiness:", error);
    return { success: false, error: "Failed to load payroll readiness" };
  }
}
