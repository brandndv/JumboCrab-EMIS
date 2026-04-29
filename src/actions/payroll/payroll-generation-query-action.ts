"use server";

import type { Prisma } from "@prisma/client";
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
    const activeEmployeeWhere: Prisma.EmployeeWhereInput = {
      isArchived: false,
      currentStatus: {
        notIn: ["INACTIVE", "ENDED"],
      },
      ...(scopedEmployeeIds.length > 0
        ? { employeeId: { in: scopedEmployeeIds } }
        : {}),
    };

    const safeLimit =
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.max(1, Math.min(Math.floor(input.limit), 200))
        : 20;

    const attendanceWhere = {
      payrollPeriodId: null,
      workDate: { gte: period.startAt, lte: period.endAt },
      employee: activeEmployeeWhere,
      ...(scopedEmployeeIds.length > 0
        ? { employeeId: { in: scopedEmployeeIds } }
        : {}),
    } as const;

    const [activeEmployeeCount, groupedRows, groupedUnlockedRows] =
      await Promise.all([
        db.employee.count({
          where: activeEmployeeWhere,
        }),
        db.attendance.groupBy({
          by: ["employeeId"],
          where: attendanceWhere,
          _count: {
            _all: true,
          },
        }),
        db.attendance.groupBy({
          by: ["employeeId"],
          where: {
            ...attendanceWhere,
            isLocked: false,
          },
          _count: {
            _all: true,
          },
          _min: {
            workDate: true,
          },
          _max: {
            workDate: true,
          },
        }),
      ]);

    if (activeEmployeeCount === 0) {
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

    const unlockedEmployeeIds = groupedUnlockedRows.map((row) => row.employeeId);
    const unlockedEmployeesById = unlockedEmployeeIds.length
      ? new Map(
          (
            await db.employee.findMany({
              where: {
                employeeId: { in: unlockedEmployeeIds },
              },
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            })
          ).map((employee) => [employee.employeeId, employee]),
        )
      : new Map();

    const unlockedEmployees = groupedUnlockedRows
      .map((row) => {
        const employee = unlockedEmployeesById.get(row.employeeId);
        return {
          employeeId: row.employeeId,
          employeeCode: employee?.employeeCode ?? "—",
          employeeName: employee ? formatEmployeeName(employee) : "Unknown employee",
          unlockedRows: row._count._all,
          firstUnlockedDate: row._min.workDate
            ? toDateKeyInTz(row._min.workDate)
            : period.startKey,
          lastUnlockedDate: row._max.workDate
            ? toDateKeyInTz(row._max.workDate)
            : period.endKey,
        };
      })
      .sort((a, b) => {
        if (b.unlockedRows !== a.unlockedRows) {
          return b.unlockedRows - a.unlockedRows;
        }
        return a.employeeName.localeCompare(b.employeeName);
      })
      .slice(0, safeLimit);

    const totalRows = groupedRows.reduce((sum, row) => sum + row._count._all, 0);
    const unlockedRows = groupedUnlockedRows.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );

    return {
      success: true,
      data: {
        payrollPeriodStart: period.startKey,
        payrollPeriodEnd: period.endKey,
        activeEmployees: activeEmployeeCount,
        employeesWithRows: groupedRows.length,
        employeesWithUnlockedRows: groupedUnlockedRows.length,
        totalRows,
        lockedRows: Math.max(0, totalRows - unlockedRows),
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
