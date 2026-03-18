"use server";

import { revalidatePath } from "next/cache";
import {
  ATTENDANCE_STATUS,
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  PayrollDeductionType,
  PayrollEmployeeStatus,
  PayrollEarningType,
  PayrollLineSource,
  PayrollReferenceType,
  PayrollReviewDecision,
  PayrollStatus,
  PayrollType,
  Roles,
  type Prisma,
} from "@prisma/client";
import {
  computePayableAmountFromNetMinutes,
  computeRatePerMinute,
  computeScheduledPaidMinutes,
} from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isDateKeyInRange,
  parseIsoDateAtNoonUtc,
  roundCurrency,
  roundSixDecimals,
  shiftDateByDays,
  toDateKeyInTz,
  toIsoString,
  toNumber,
  toNumberOrNull,
  toPercent,
} from "@/lib/payroll/helpers";
import type {
  GeneratePayrollInput,
  PayrollEligibleEmployeeOption,
  PayrollGenerationReadiness,
  PayrollEmployeeAttendanceRow,
  PayrollDeductionLine,
  PayrollEarningLine,
  PayrollPayslipDetail,
  PayrollPayslipSummary,
  PayrollRunDetail,
  PayrollRunSummary,
  ReviewPayrollInput,
} from "@/types/payroll";

const OVERTIME_RATE_MULTIPLIER = 1.25;

const PAYROLL_ROUTE_PREFIXES = [
  "/admin/payroll",
  "/manager/payroll",
  "/generalManager/payroll",
  "/clerk/payroll",
  "/employee/payroll",
] as const;

const parseDateKey = (value: string) => {
  const parsed = parseIsoDateAtNoonUtc(value);
  if (!parsed) return null;
  return value;
};

const parseDateKeyParts = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const isStandardFirstHalfBimonthlyRun = (input: {
  payrollType: PayrollType;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  isScopedRun: boolean;
}) => {
  if (input.payrollType !== PayrollType.BIMONTHLY || input.isScopedRun) {
    return false;
  }

  const start = parseDateKeyParts(input.payrollPeriodStart);
  const end = parseDateKeyParts(input.payrollPeriodEnd);
  if (!start || !end) return false;

  // Contribution Deduction is only applied in the first half of the month
  return (
    start.year === end.year &&
    start.month === end.month &&
    start.day === 1 &&
    end.day === 15
  );
};

const normalizeEmployeeIds = (employeeIds?: string[]) =>
  Array.from(
    new Set(
      (employeeIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  );

const toPeriodDateKey = (value: Date) => toDateKeyInTz(value);

const canGeneratePayroll = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Clerk;

const canReviewAsManager = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

const canReviewAsGeneralManager = (role?: Roles) =>
  role === Roles.Admin || role === Roles.GeneralManager;

const canViewPayrollRuns = (role?: Roles) =>
  role === Roles.Admin ||
  role === Roles.Clerk ||
  role === Roles.Manager ||
  role === Roles.GeneralManager;

const canViewPayslips = (role?: Roles) =>
  role === Roles.Admin ||
  role === Roles.Clerk ||
  role === Roles.Manager ||
  role === Roles.GeneralManager ||
  role === Roles.Employee;

const formatUsername = (
  user?: {
    username: string;
  } | null,
) => user?.username ?? null;

const sumCurrencyFromValues = (values: Array<unknown>) =>
  roundCurrency(
    values.reduce<number>((acc, value) => acc + toNumber(value, 0), 0),
  );

const serializeEarningLine = (line: {
  id: string;
  earningType: PayrollEarningType;
  amount: unknown;
  minutes: number | null;
  rateSnapshot: unknown;
  source: PayrollLineSource;
  isManual: boolean;
  referenceType: PayrollReferenceType | null;
  referenceId: string | null;
  remarks: string | null;
  isVoided: boolean;
}): PayrollEarningLine => ({
  id: line.id,
  earningType: line.earningType,
  amount: toNumber(line.amount, 0),
  minutes: line.minutes ?? null,
  rateSnapshot: toNumberOrNull(line.rateSnapshot),
  source: line.source,
  isManual: line.isManual,
  referenceType: line.referenceType,
  referenceId: line.referenceId,
  remarks: line.remarks,
  isVoided: line.isVoided,
});

const serializeDeductionLine = (line: {
  id: string;
  deductionType: PayrollDeductionType;
  deductionTypeId: string | null;
  deductionCodeSnapshot: string | null;
  deductionNameSnapshot: string | null;
  assignmentId: string | null;
  amount: unknown;
  minutes: number | null;
  rateSnapshot: unknown;
  source: PayrollLineSource;
  isManual: boolean;
  referenceType: PayrollReferenceType | null;
  referenceId: string | null;
  remarks: string | null;
  isVoided: boolean;
}): PayrollDeductionLine => ({
  id: line.id,
  deductionType: line.deductionType,
  deductionTypeId: line.deductionTypeId,
  deductionCodeSnapshot: line.deductionCodeSnapshot,
  deductionNameSnapshot: line.deductionNameSnapshot,
  assignmentId: line.assignmentId,
  amount: toNumber(line.amount, 0),
  minutes: line.minutes ?? null,
  rateSnapshot: toNumberOrNull(line.rateSnapshot),
  source: line.source,
  isManual: line.isManual,
  referenceType: line.referenceType,
  referenceId: line.referenceId,
  remarks: line.remarks,
  isVoided: line.isVoided,
});

const serializePayrollRunSummary = (run: {
  payrollId: string;
  payrollPeriodStart: Date;
  payrollPeriodEnd: Date;
  payrollType: PayrollType;
  status: PayrollStatus;
  managerDecision: PayrollReviewDecision;
  gmDecision: PayrollReviewDecision;
  generatedAt: Date;
  managerReviewedAt: Date | null;
  gmReviewedAt: Date | null;
  releasedAt: Date | null;
  managerReviewRemarks: string | null;
  gmReviewRemarks: string | null;
  notes: string | null;
  createdBy: { username: string } | null;
  managerReviewedBy: { username: string } | null;
  gmReviewedBy: { username: string } | null;
  releasedBy: { username: string } | null;
  payrollEmployees: Array<{
    grossPay: unknown;
    totalDeductions: unknown;
    netPay: unknown;
  }>;
}): PayrollRunSummary => {
  const grossTotal = sumCurrencyFromValues(
    run.payrollEmployees.map((row) => row.grossPay),
  );
  const deductionsTotal = sumCurrencyFromValues(
    run.payrollEmployees.map((row) => row.totalDeductions),
  );
  const netTotal = sumCurrencyFromValues(
    run.payrollEmployees.map((row) => row.netPay),
  );

  return {
    payrollId: run.payrollId,
    payrollPeriodStart: run.payrollPeriodStart.toISOString(),
    payrollPeriodEnd: run.payrollPeriodEnd.toISOString(),
    payrollType: run.payrollType,
    status: run.status,
    managerDecision: run.managerDecision,
    gmDecision: run.gmDecision,
    generatedAt: run.generatedAt.toISOString(),
    managerReviewedAt: toIsoString(run.managerReviewedAt),
    gmReviewedAt: toIsoString(run.gmReviewedAt),
    releasedAt: toIsoString(run.releasedAt),
    managerReviewRemarks: run.managerReviewRemarks ?? null,
    gmReviewRemarks: run.gmReviewRemarks ?? null,
    notes: run.notes ?? null,
    createdByName: formatUsername(run.createdBy),
    managerReviewedByName: formatUsername(run.managerReviewedBy),
    gmReviewedByName: formatUsername(run.gmReviewedBy),
    releasedByName: formatUsername(run.releasedBy),
    employeeCount: run.payrollEmployees.length,
    grossTotal,
    deductionsTotal,
    netTotal,
  };
};

const revalidatePayrollPages = () => {
  PAYROLL_ROUTE_PREFIXES.forEach((prefix) => {
    revalidatePath(prefix);
    revalidatePath(`${prefix}/review-payroll`);
    revalidatePath(`${prefix}/generate-payroll`);
    revalidatePath(`${prefix}/payroll-history`);
    revalidatePath(`${prefix}/payslips`);
  });
};

export async function listPayrollRuns(input?: {
  status?: Array<PayrollStatus>;
  payrollType?: PayrollType;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: PayrollRunSummary[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canViewPayrollRuns(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const rows = await db.payroll.findMany({
      where: {
        status: input?.status?.length ? { in: input.status } : undefined,
        payrollType: input?.payrollType ?? undefined,
      },
      include: {
        createdBy: { select: { username: true } },
        managerReviewedBy: { select: { username: true } },
        gmReviewedBy: { select: { username: true } },
        releasedBy: { select: { username: true } },
        payrollEmployees: {
          select: {
            grossPay: true,
            totalDeductions: true,
            netPay: true,
          },
        },
      },
      orderBy: [{ payrollPeriodStart: "desc" }, { createdAt: "desc" }],
      take: input?.limit && input.limit > 0 ? input.limit : undefined,
    });

    return {
      success: true,
      data: rows.map(serializePayrollRunSummary),
    };
  } catch (error) {
    console.error("Error listing payroll runs:", error);
    return { success: false, error: "Failed to load payroll runs" };
  }
}

export async function getPayrollRunDetails(payrollId: string): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canViewPayrollRuns(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollId) return { success: false, error: "Payroll ID is required" };

    const row = await db.payroll.findUnique({
      where: { payrollId },
      include: {
        createdBy: { select: { username: true } },
        managerReviewedBy: { select: { username: true } },
        gmReviewedBy: { select: { username: true } },
        releasedBy: { select: { username: true } },
        payrollEmployees: {
          include: {
            employee: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
            earnings: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                earningType: true,
                amount: true,
                minutes: true,
                rateSnapshot: true,
                source: true,
                isManual: true,
                referenceType: true,
                referenceId: true,
                remarks: true,
                isVoided: true,
              },
            },
            deductions: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                deductionType: true,
                deductionTypeId: true,
                deductionCodeSnapshot: true,
                deductionNameSnapshot: true,
                assignmentId: true,
                amount: true,
                minutes: true,
                rateSnapshot: true,
                source: true,
                isManual: true,
                referenceType: true,
                referenceId: true,
                remarks: true,
                isVoided: true,
              },
            },
          },
          orderBy: [
            { employee: { lastName: "asc" } },
            { employee: { firstName: "asc" } },
          ],
        },
      },
    });

    if (!row) return { success: false, error: "Payroll run not found" };

    const summary = serializePayrollRunSummary(row);
    const employees = row.payrollEmployees.map((employeeRow) => {
      const employeeName = [
        employeeRow.employee.firstName,
        employeeRow.employee.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: employeeRow.id,
        employeeId: employeeRow.employeeId,
        employeeCode: employeeRow.employee.employeeCode,
        employeeName,
        status: employeeRow.status,
        attendanceStart: employeeRow.attendanceStart.toISOString(),
        attendanceEnd: employeeRow.attendanceEnd.toISOString(),
        daysPresent: employeeRow.daysPresent,
        daysAbsent: employeeRow.daysAbsent,
        daysLate: employeeRow.daysLate,
        minutesWorked: employeeRow.minutesWorked,
        minutesNetWorked: employeeRow.minutesNetWorked,
        minutesOvertime: employeeRow.minutesOvertime,
        minutesUndertime: employeeRow.minutesUndertime,
        dailyRateSnapshot: toNumberOrNull(employeeRow.dailyRateSnapshot),
        ratePerMinuteSnapshot: toNumberOrNull(
          employeeRow.ratePerMinuteSnapshot,
        ),
        grossPay: toNumber(employeeRow.grossPay, 0),
        totalEarnings: toNumber(employeeRow.totalEarnings, 0),
        totalDeductions: toNumber(employeeRow.totalDeductions, 0),
        netPay: toNumber(employeeRow.netPay, 0),
        notes: employeeRow.notes ?? null,
        earnings: employeeRow.earnings.map(serializeEarningLine),
        deductions: employeeRow.deductions.map(serializeDeductionLine),
      };
    });

    return {
      success: true,
      data: {
        ...summary,
        employees,
      },
    };
  } catch (error) {
    console.error("Error fetching payroll run details:", error);
    return { success: false, error: "Failed to load payroll run details" };
  }
}

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
        employeeName: [row.firstName, row.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
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

    const startKey = parseDateKey(input.payrollPeriodStart);
    const endKey = parseDateKey(input.payrollPeriodEnd);
    if (!startKey || !endKey) {
      return { success: false, error: "Invalid payroll period dates" };
    }
    if (startKey > endKey) {
      return {
        success: false,
        error: "Payroll period start must be before period end",
      };
    }

    const startAt = parseIsoDateAtNoonUtc(startKey);
    const endAt = parseIsoDateAtNoonUtc(endKey);
    if (!startAt || !endAt) {
      return { success: false, error: "Invalid payroll period dates" };
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
          payrollPeriodStart: startKey,
          payrollPeriodEnd: endKey,
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
        workDate: { gte: startAt, lte: endAt },
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
        const employeeName = [employee?.firstName, employee?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          employeeId,
          employeeCode: employee?.employeeCode ?? "—",
          employeeName: employeeName || "Unknown employee",
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
        payrollPeriodStart: startKey,
        payrollPeriodEnd: endKey,
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

export async function generatePayrollRun(input: GeneratePayrollInput): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canGeneratePayroll(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const startKey = parseDateKey(input.payrollPeriodStart);
    const endKey = parseDateKey(input.payrollPeriodEnd);
    if (!startKey || !endKey) {
      return { success: false, error: "Invalid payroll period dates" };
    }
    if (startKey > endKey) {
      return {
        success: false,
        error: "Payroll period start must be before period end",
      };
    }

    const startAt = parseIsoDateAtNoonUtc(startKey);
    const endAt = parseIsoDateAtNoonUtc(endKey);
    if (!startAt || !endAt) {
      return { success: false, error: "Invalid payroll period dates" };
    }

    const scopedEmployeeIds = normalizeEmployeeIds(input.employeeIds);
    if (
      input.employeeIds &&
      input.employeeIds.length > 0 &&
      scopedEmployeeIds.length === 0
    ) {
      return { success: false, error: "No valid employee IDs were provided." };
    }
    const applyGovernmentContributions = isStandardFirstHalfBimonthlyRun({
      payrollType: input.payrollType,
      payrollPeriodStart: startKey,
      payrollPeriodEnd: endKey,
      isScopedRun: scopedEmployeeIds.length > 0,
    });

    const created = await db.$transaction(
      async (tx) => {
        const payroll = await tx.payroll.create({
          data: {
            payrollPeriodStart: startAt,
            payrollPeriodEnd: endAt,
            payrollType: input.payrollType,
            status: PayrollStatus.DRAFT,
            managerDecision: PayrollReviewDecision.PENDING,
            gmDecision: PayrollReviewDecision.PENDING,
            notes: input.notes?.trim() || null,
            createdByUserId: session.userId ?? null,
          },
        });

        const employees = await tx.employee.findMany({
          where: {
            isArchived: false,
            currentStatus: {
              notIn: ["INACTIVE", "ENDED"],
            },
            ...(scopedEmployeeIds.length > 0
              ? { employeeId: { in: scopedEmployeeIds } }
              : {}),
          },
          include: {
            contribution: true,
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        if (scopedEmployeeIds.length > 0) {
          const foundEmployeeIds = new Set(
            employees.map((employee) => employee.employeeId),
          );
          const missing = scopedEmployeeIds.filter(
            (id) => !foundEmployeeIds.has(id),
          );
          if (missing.length > 0) {
            throw new Error(
              `Some selected employees are unavailable or inactive (${missing.length}). Refresh selection and retry.`,
            );
          }
        }

        const employeeIds = employees.map((employee) => employee.employeeId);
        if (employeeIds.length === 0) {
          return payroll.payrollId;
        }

        const periodWhere: Prisma.AttendanceWhereInput = {
          employeeId: { in: employeeIds },
          workDate: { gte: startAt, lte: endAt },
          payrollPeriodId: null,
        };

        const unlockedUnpaidCount = await tx.attendance.count({
          where: {
            ...periodWhere,
            isLocked: false,
          },
        });
        if (unlockedUnpaidCount > 0) {
          const unlockedSample = await tx.attendance.findMany({
            where: {
              ...periodWhere,
              isLocked: false,
            },
            orderBy: [{ workDate: "asc" }],
            take: 10,
            select: {
              employeeId: true,
              workDate: true,
            },
          });

          const nameByEmployeeId = new Map(
            employees.map((employee) => {
              const name = [employee.firstName, employee.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
              return [employee.employeeId, name || employee.employeeCode];
            }),
          );

          const preview = unlockedSample
            .map((row) => {
              const employeeName =
                nameByEmployeeId.get(row.employeeId) ?? row.employeeId;
              return `${employeeName} (${toDateKeyInTz(row.workDate)})`;
            })
            .join(", ");

          throw new Error(
            `Cannot generate payroll. Found ${unlockedUnpaidCount} unlocked unpaid attendance row(s) in this period. Lock attendance first.${preview ? ` Sample: ${preview}` : ""}`,
          );
        }

        const broadStart = shiftDateByDays(startAt, -2);
        const broadEnd = shiftDateByDays(endAt, 2);

        const attendanceRows = await tx.attendance.findMany({
          where: {
            employeeId: { in: employeeIds },
            workDate: { gte: broadStart, lte: broadEnd },
            payrollPeriodId: null,
            isLocked: true,
          },
          orderBy: [{ workDate: "asc" }],
          select: {
            id: true,
            employeeId: true,
            workDate: true,
            status: true,
            paidHoursPerDay: true,
            scheduledStartMinutes: true,
            scheduledEndMinutes: true,
            workedMinutes: true,
            netWorkedMinutes: true,
            lateMinutes: true,
            undertimeMinutes: true,
            overtimeMinutesRaw: true,
            overtimeMinutesApproved: true,
          },
        });

        const attendanceByEmployee = new Map<string, typeof attendanceRows>();
        attendanceRows.forEach((row) => {
          const key = toDateKeyInTz(row.workDate);
          if (!isDateKeyInRange(key, startKey, endKey)) return;
          if (!attendanceByEmployee.has(row.employeeId)) {
            attendanceByEmployee.set(row.employeeId, []);
          }
          attendanceByEmployee.get(row.employeeId)!.push(row);
        });

        const assignments = await tx.employeeDeductionAssignment.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: EmployeeDeductionAssignmentStatus.ACTIVE,
            deductionType: { isActive: true },
          },
          include: {
            deductionType: true,
          },
        });

        const activeAssignments = assignments.filter((assignment) => {
          const fromKey = toDateKeyInTz(assignment.effectiveFrom);
          const toKey = assignment.effectiveTo
            ? toDateKeyInTz(assignment.effectiveTo)
            : null;
          return fromKey <= endKey && (!toKey || toKey >= startKey);
        });

        const assignmentByEmployee = new Map<
          string,
          typeof activeAssignments
        >();
        activeAssignments.forEach((assignment) => {
          if (!assignmentByEmployee.has(assignment.employeeId)) {
            assignmentByEmployee.set(assignment.employeeId, []);
          }
          assignmentByEmployee.get(assignment.employeeId)!.push(assignment);
        });

        const oneTimeAssignmentIds = activeAssignments
          .filter(
            (assignment) =>
              assignment.deductionType.frequency ===
              DeductionFrequency.ONE_TIME,
          )
          .map((assignment) => assignment.id);

        const existingOneTimeAssignments = oneTimeAssignmentIds.length
          ? await tx.payrollDeduction.findMany({
              where: {
                assignmentId: { in: oneTimeAssignmentIds },
                isVoided: false,
              },
              select: { assignmentId: true },
            })
          : [];

        const oneTimeAlreadyApplied = new Set(
          existingOneTimeAssignments
            .map((row) => row.assignmentId)
            .filter((value): value is string => Boolean(value)),
        );

        for (const employee of employees) {
          const employeeRows =
            attendanceByEmployee.get(employee.employeeId) ?? [];
          const dailyRate = toNumberOrNull(employee.dailyRate);

          let daysPresent = 0;
          let daysAbsent = 0;
          let daysLate = 0;
          for (const row of employeeRows) {
            if (row.status === ATTENDANCE_STATUS.ABSENT) {
              daysAbsent += 1;
            } else if (
              row.status === ATTENDANCE_STATUS.PRESENT ||
              row.status === ATTENDANCE_STATUS.LATE
            ) {
              daysPresent += 1;
            }
            if (
              row.status === ATTENDANCE_STATUS.LATE ||
              (row.lateMinutes ?? 0) > 0
            ) {
              daysLate += 1;
            }
          }

          const baselinePaidMinutes =
            employeeRows
              .map((row) =>
                computeScheduledPaidMinutes({
                  paidHoursPerDay: row.paidHoursPerDay,
                  scheduledStartMinutes: row.scheduledStartMinutes,
                  scheduledEndMinutes: row.scheduledEndMinutes,
                  scheduledBreakMinutes: null,
                }),
              )
              .find(
                (minutes): minutes is number =>
                  typeof minutes === "number" && minutes > 0,
              ) ?? 8 * 60;

          const ratePerMinuteSnapshot =
            dailyRate == null
              ? null
              : roundSixDecimals(dailyRate / Math.max(1, baselinePaidMinutes));

          const rowPayrollMetrics = employeeRows.map((row) => {
            const scheduledPaidMinutesRaw = computeScheduledPaidMinutes({
              paidHoursPerDay: row.paidHoursPerDay,
              scheduledStartMinutes: row.scheduledStartMinutes,
              scheduledEndMinutes: row.scheduledEndMinutes,
              scheduledBreakMinutes: null,
            });
            const scheduledPaidMinutes =
              typeof scheduledPaidMinutesRaw === "number" &&
              Number.isFinite(scheduledPaidMinutesRaw)
                ? Math.max(0, Math.round(scheduledPaidMinutesRaw))
                : null;

            const netWorkedMinutes =
              typeof row.netWorkedMinutes === "number" &&
              Number.isFinite(row.netWorkedMinutes)
                ? Math.max(0, Math.round(row.netWorkedMinutes))
                : 0;

            let undertimeMinutes =
              typeof row.undertimeMinutes === "number" &&
              Number.isFinite(row.undertimeMinutes)
                ? Math.max(0, Math.round(row.undertimeMinutes))
                : 0;

            // If attendance has no computed net (ex: absent/incomplete), treat
            // scheduled minutes as full undertime for payroll computation.
            if (scheduledPaidMinutes != null) {
              if (row.netWorkedMinutes == null) {
                undertimeMinutes = scheduledPaidMinutes;
              }
              undertimeMinutes = Math.min(
                undertimeMinutes,
                scheduledPaidMinutes,
              );
            }

            const payableWorkedMinutes =
              scheduledPaidMinutes != null
                ? Math.max(0, scheduledPaidMinutes - undertimeMinutes)
                : netWorkedMinutes;

            const isZeroWorkRow =
              (row.status === ATTENDANCE_STATUS.ABSENT ||
                row.status === ATTENDANCE_STATUS.INCOMPLETE) &&
              Math.max(0, row.workedMinutes ?? 0) === 0 &&
              Math.max(0, row.netWorkedMinutes ?? 0) === 0;

            // Keep base earning and undertime deduction balanced:
            // scheduled base for scheduled rows, payable net for unscheduled rows.
            const baseEarningMinutes =
              isZeroWorkRow
                ? 0
                : scheduledPaidMinutes != null
                ? scheduledPaidMinutes
                : payableWorkedMinutes;

            const ratePerMinute = computeRatePerMinute({
              dailyRate,
              scheduledPaidMinutes: scheduledPaidMinutes ?? baselinePaidMinutes,
            });

            const basePayAmount =
              isZeroWorkRow
                ? 0
                : (computePayableAmountFromNetMinutes({
                    netWorkedMinutes: baseEarningMinutes,
                    ratePerMinute,
                  }) ?? 0);

            const undertimeDeductionAmount =
              isZeroWorkRow || scheduledPaidMinutes == null
                ? 0
                : (computePayableAmountFromNetMinutes({
                    netWorkedMinutes: undertimeMinutes,
                    ratePerMinute,
                  }) ?? 0);

            const approvedOvertime = Math.max(
              0,
              row.overtimeMinutesApproved ?? 0,
            );
            const rawOvertime = Math.max(0, row.overtimeMinutesRaw ?? 0);
            const overtimeMinutes =
              approvedOvertime > 0 ? approvedOvertime : rawOvertime;
            const overtimePayAmount =
              ratePerMinute == null
                ? 0
                : overtimeMinutes * ratePerMinute * OVERTIME_RATE_MULTIPLIER;

            return {
              baseEarningMinutes,
              basePayAmount,
              netWorkedMinutes,
              overtimeMinutes,
              overtimePayAmount,
              undertimeMinutes,
              undertimeDeductionAmount,
            };
          });

          const minutesWorked = employeeRows.reduce(
            (sum, row) => sum + Math.max(0, row.workedMinutes ?? 0),
            0,
          );
          const minutesNetWorked = rowPayrollMetrics.reduce(
            (sum, row) => sum + row.netWorkedMinutes,
            0,
          );
          const minutesBasePay = rowPayrollMetrics.reduce(
            (sum, row) => sum + row.baseEarningMinutes,
            0,
          );
          const minutesOvertime = rowPayrollMetrics.reduce(
            (sum, row) => sum + row.overtimeMinutes,
            0,
          );
          const minutesUndertime = rowPayrollMetrics.reduce(
            (sum, row) => sum + row.undertimeMinutes,
            0,
          );

          const basePay = roundCurrency(
            rowPayrollMetrics.reduce((sum, row) => sum + row.basePayAmount, 0),
          );
          const overtimePay = roundCurrency(
            rowPayrollMetrics.reduce(
              (sum, row) => sum + row.overtimePayAmount,
              0,
            ),
          );
          const undertimeDeduction = roundCurrency(
            rowPayrollMetrics.reduce(
              (sum, row) => sum + row.undertimeDeductionAmount,
              0,
            ),
          );

          const earnings: Array<{
            earningType: PayrollEarningType;
            amount: number;
            minutes?: number;
            rateSnapshot?: number;
            source: PayrollLineSource;
            isManual: boolean;
            referenceType?: PayrollReferenceType;
            referenceId?: string;
            remarks?: string;
          }> = [];

          if (basePay > 0) {
            earnings.push({
              earningType: PayrollEarningType.BASE_PAY,
              amount: basePay,
              minutes: minutesBasePay,
              rateSnapshot: ratePerMinuteSnapshot ?? undefined,
              source: PayrollLineSource.SYSTEM,
              isManual: false,
              referenceType: PayrollReferenceType.ATTENDANCE,
              referenceId: payroll.payrollId,
              remarks:
                "Computed from payable base minutes (grace-aware, capped by schedule)",
            });
          }

          if (overtimePay > 0) {
            earnings.push({
              earningType: PayrollEarningType.OVERTIME_PAY,
              amount: overtimePay,
              minutes: minutesOvertime,
              rateSnapshot: ratePerMinuteSnapshot ?? undefined,
              source: PayrollLineSource.SYSTEM,
              isManual: false,
              referenceType: PayrollReferenceType.ATTENDANCE,
              referenceId: payroll.payrollId,
              remarks: `Overtime multiplier applied (${OVERTIME_RATE_MULTIPLIER}x)`,
            });
          }

          const deductions: Array<{
            deductionType: PayrollDeductionType;
            deductionTypeId?: string;
            assignmentId?: string;
            deductionCodeSnapshot?: string;
            deductionNameSnapshot?: string;
            amount: number;
            minutes?: number;
            rateSnapshot?: number;
            source: PayrollLineSource;
            isManual: boolean;
            referenceType?: PayrollReferenceType;
            referenceId?: string;
            remarks?: string;
          }> = [];

          if (undertimeDeduction > 0) {
            deductions.push({
              deductionType: PayrollDeductionType.UNDERTIME_DEDUCTION,
              amount: undertimeDeduction,
              minutes: minutesUndertime,
              rateSnapshot: ratePerMinuteSnapshot ?? undefined,
              source: PayrollLineSource.SYSTEM,
              isManual: false,
              referenceType: PayrollReferenceType.ATTENDANCE,
              referenceId: payroll.payrollId,
              remarks:
                "Computed from attendance undertime minutes (grace-aware)",
            });
          }

          //! PAYROLL CONTRIBUTION DEDUCTION LOGIC //
          const contribution = employee.contribution;
          if (applyGovernmentContributions && contribution) {
            const sss = toNumber(contribution.sssEe, 0);
            const philHealth = toNumber(contribution.philHealthEe, 0);
            const pagIbig = toNumber(contribution.pagIbigEe, 0);
            const withholding = toNumber(contribution.withholdingEe, 0);

            if (contribution.isSssActive && sss > 0) {
              deductions.push({
                deductionType: PayrollDeductionType.CONTRIBUTION_SSS,
                amount: roundCurrency(sss),
                source: PayrollLineSource.CONTRIBUTION_ENGINE,
                isManual: false,
                referenceType: PayrollReferenceType.CONTRIBUTION,
                referenceId: contribution.id,
                remarks: "Employee SSS contribution",
              });
            }
            if (contribution.isPhilHealthActive && philHealth > 0) {
              deductions.push({
                deductionType: PayrollDeductionType.CONTRIBUTION_PHILHEALTH,
                amount: roundCurrency(philHealth),
                source: PayrollLineSource.CONTRIBUTION_ENGINE,
                isManual: false,
                referenceType: PayrollReferenceType.CONTRIBUTION,
                referenceId: contribution.id,
                remarks: "Employee PhilHealth contribution",
              });
            }
            if (contribution.isPagIbigActive && pagIbig > 0) {
              deductions.push({
                deductionType: PayrollDeductionType.CONTRIBUTION_PAGIBIG,
                amount: roundCurrency(pagIbig),
                source: PayrollLineSource.CONTRIBUTION_ENGINE,
                isManual: false,
                referenceType: PayrollReferenceType.CONTRIBUTION,
                referenceId: contribution.id,
                remarks: "Employee Pag-IBIG contribution",
              });
            }
            if (contribution.isWithholdingActive && withholding > 0) {
              deductions.push({
                deductionType: PayrollDeductionType.WITHHOLDING_TAX,
                amount: roundCurrency(withholding),
                source: PayrollLineSource.CONTRIBUTION_ENGINE,
                isManual: false,
                referenceType: PayrollReferenceType.CONTRIBUTION,
                referenceId: contribution.id,
                remarks: "Employee withholding tax",
              });
            }
          }

          const earningsSubtotal = roundCurrency(
            earnings.reduce((sum, line) => sum + line.amount, 0),
          );

          const assignmentUpdates: Array<{
            id: string;
            remainingBalance: number | null;
            status: EmployeeDeductionAssignmentStatus;
          }> = [];
          const employeeAssignments =
            assignmentByEmployee.get(employee.employeeId) ?? [];

          for (const assignment of employeeAssignments) {
            if (
              assignment.deductionType.frequency === DeductionFrequency.ONE_TIME
            ) {
              if (oneTimeAlreadyApplied.has(assignment.id)) {
                continue;
              }
            }

            const configuredAmount = toNumber(
              assignment.amountOverride ??
                assignment.deductionType.defaultAmount,
              0,
            );
            const configuredPercent = toNumber(
              assignment.percentOverride ??
                assignment.deductionType.defaultPercent,
              0,
            );

            let amount = 0;
            if (
              assignment.deductionType.amountMode === DeductionAmountMode.FIXED
            ) {
              amount = configuredAmount;
            } else {
              amount = roundCurrency(
                earningsSubtotal * toPercent(configuredPercent),
              );
            }

            if (
              assignment.deductionType.frequency ===
              DeductionFrequency.INSTALLMENT
            ) {
              const balanceSeed = toNumber(
                assignment.remainingBalance ?? assignment.installmentTotal,
                0,
              );
              const installmentValue = toNumber(
                assignment.installmentPerPayroll,
                amount,
              );
              const effectiveInstallment = Math.max(
                0,
                installmentValue > 0 ? installmentValue : amount,
              );
              const safeBalance = Math.max(0, balanceSeed);
              if (safeBalance <= 0 || effectiveInstallment <= 0) {
                continue;
              }
              amount = roundCurrency(
                Math.min(safeBalance, effectiveInstallment),
              );

              const remainingBalance = roundCurrency(
                Math.max(0, safeBalance - amount),
              );
              assignmentUpdates.push({
                id: assignment.id,
                remainingBalance,
                status:
                  remainingBalance <= 0
                    ? EmployeeDeductionAssignmentStatus.COMPLETED
                    : EmployeeDeductionAssignmentStatus.ACTIVE,
              });
            }

            amount = roundCurrency(Math.max(0, amount));
            if (amount <= 0) continue;

            deductions.push({
              deductionType: PayrollDeductionType.OTHER,
              deductionTypeId: assignment.deductionTypeId,
              assignmentId: assignment.id,
              deductionCodeSnapshot: assignment.deductionType.code,
              deductionNameSnapshot: assignment.deductionType.name,
              amount,
              source: PayrollLineSource.SYSTEM,
              isManual: false,
              referenceType: PayrollReferenceType.MANUAL,
              referenceId: assignment.id,
              remarks:
                assignment.reason ??
                `Applied from deduction assignment (${assignment.deductionType.name})`,
            });

            if (
              assignment.deductionType.frequency === DeductionFrequency.ONE_TIME
            ) {
              oneTimeAlreadyApplied.add(assignment.id);
            }
          }

          const totalEarnings = roundCurrency(
            earnings.reduce((sum, line) => sum + line.amount, 0),
          );
          const totalDeductions = roundCurrency(
            deductions.reduce((sum, line) => sum + line.amount, 0),
          );
          const grossPay = totalEarnings;
          const netPay = roundCurrency(totalEarnings - totalDeductions);

          const payrollEmployee = await tx.payrollEmployee.create({
            data: {
              payrollId: payroll.payrollId,
              employeeId: employee.employeeId,
              attendanceStart: startAt,
              attendanceEnd: endAt,
              daysPresent,
              daysAbsent,
              daysLate,
              minutesWorked,
              minutesNetWorked,
              minutesOvertime,
              minutesUndertime,
              dailyRateSnapshot: dailyRate,
              ratePerMinuteSnapshot,
              grossPay,
              totalEarnings,
              totalDeductions,
              netPay,
              status: PayrollEmployeeStatus.DRAFT,
              createdByUserId: session.userId ?? null,
              updatedByUserId: session.userId ?? null,
            },
          });

          if (employeeRows.length > 0) {
            await tx.attendance.updateMany({
              where: {
                id: { in: employeeRows.map((row) => row.id) },
                payrollPeriodId: null,
                isLocked: true,
              },
              data: {
                payrollPeriodId: payroll.payrollId,
                payrollEmployeeId: payrollEmployee.id,
              },
            });
          }

          if (earnings.length > 0) {
            await tx.payrollEarning.createMany({
              data: earnings.map((line) => ({
                payrollEmployeeId: payrollEmployee.id,
                earningType: line.earningType,
                amount: line.amount,
                minutes: line.minutes ?? null,
                rateSnapshot: line.rateSnapshot ?? null,
                source: line.source,
                isManual: line.isManual,
                referenceType: line.referenceType ?? null,
                referenceId: line.referenceId ?? null,
                remarks: line.remarks ?? null,
                createdByUserId: session.userId ?? null,
              })),
            });
          }

          if (deductions.length > 0) {
            await tx.payrollDeduction.createMany({
              data: deductions.map((line) => ({
                payrollEmployeeId: payrollEmployee.id,
                deductionType: line.deductionType,
                deductionTypeId: line.deductionTypeId ?? null,
                assignmentId: line.assignmentId ?? null,
                deductionCodeSnapshot: line.deductionCodeSnapshot ?? null,
                deductionNameSnapshot: line.deductionNameSnapshot ?? null,
                amount: line.amount,
                minutes: line.minutes ?? null,
                rateSnapshot: line.rateSnapshot ?? null,
                source: line.source,
                isManual: line.isManual,
                referenceType: line.referenceType ?? null,
                referenceId: line.referenceId ?? null,
                remarks: line.remarks ?? null,
                createdByUserId: session.userId ?? null,
              })),
            });
          }

          for (const update of assignmentUpdates) {
            await tx.employeeDeductionAssignment.update({
              where: { id: update.id },
              data: {
                remainingBalance: update.remainingBalance,
                status: update.status,
                updatedByUserId: session.userId ?? null,
              },
            });
          }
        }

        return payroll.payrollId;
      },
      {
        // Payroll generation performs many per-employee writes (attendance linking,
        // earning/deduction inserts, assignment balance updates). The default
        // interactive transaction timeout (5s) is too short for medium datasets.
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    revalidatePayrollPages();
    return await getPayrollRunDetails(created);
  } catch (error) {
    console.error("Error generating payroll run:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return {
        success: false,
        error:
          "Payroll already exists for this period and payroll type. Open the existing run instead.",
      };
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate payroll run",
    };
  }
}

export async function regenerateRejectedPayrollRun(payrollId: string): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canGeneratePayroll(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollId) return { success: false, error: "Payroll ID is required" };

    const existing = await db.payroll.findUnique({
      where: { payrollId },
      select: {
        payrollId: true,
        payrollPeriodStart: true,
        payrollPeriodEnd: true,
        payrollType: true,
        status: true,
        managerDecision: true,
        gmDecision: true,
        notes: true,
        payrollEmployees: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Payroll run not found" };
    }

    if (
      existing.status === PayrollStatus.RELEASED ||
      existing.status === PayrollStatus.FINALIZED ||
      existing.status === PayrollStatus.VOIDED
    ) {
      return {
        success: false,
        error: "Released/finalized/voided payroll cannot be regenerated",
      };
    }

    if (
      existing.managerDecision !== PayrollReviewDecision.REJECTED &&
      existing.gmDecision !== PayrollReviewDecision.REJECTED
    ) {
      return {
        success: false,
        error:
          "Only rejected payroll runs can be regenerated from this action.",
      };
    }

    await db.payroll.delete({ where: { payrollId } });

    const regenerated = await generatePayrollRun({
      payrollPeriodStart: toPeriodDateKey(existing.payrollPeriodStart),
      payrollPeriodEnd: toPeriodDateKey(existing.payrollPeriodEnd),
      payrollType: existing.payrollType,
      notes: existing.notes ?? undefined,
      employeeIds: existing.payrollEmployees.map((row) => row.employeeId),
    });

    if (!regenerated.success) {
      throw new Error(regenerated.error || "Failed to regenerate payroll");
    }

    return regenerated;
  } catch (error) {
    console.error("Error regenerating rejected payroll run:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to regenerate rejected payroll run",
    };
  }
}

export async function reviewPayrollRun(input: ReviewPayrollInput): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!input?.payrollId) {
      return { success: false, error: "Payroll ID is required" };
    }
    if (!input.level || !input.decision) {
      return {
        success: false,
        error: "Review level and decision are required",
      };
    }

    if (input.level === "MANAGER" && !canReviewAsManager(session.role)) {
      return { success: false, error: "Unauthorized manager review action" };
    }
    if (
      input.level === "GENERAL_MANAGER" &&
      !canReviewAsGeneralManager(session.role)
    ) {
      return {
        success: false,
        error: "Unauthorized general manager review action",
      };
    }

    const remarks = input.remarks?.trim() || null;
    if (input.decision === "REJECTED" && !remarks) {
      return { success: false, error: "Remarks are required when rejecting" };
    }

    await db.$transaction(async (tx) => {
      const run = await tx.payroll.findUnique({
        where: { payrollId: input.payrollId },
        select: {
          payrollId: true,
          status: true,
          managerDecision: true,
          gmDecision: true,
        },
      });

      if (!run) {
        throw new Error("Payroll run not found");
      }
      if (
        run.status === PayrollStatus.RELEASED ||
        run.status === PayrollStatus.FINALIZED ||
        run.status === PayrollStatus.VOIDED
      ) {
        throw new Error("Released/finalized payroll cannot be reviewed");
      }

      const now = new Date();
      if (input.level === "MANAGER") {
        const decision =
          input.decision === "APPROVED"
            ? PayrollReviewDecision.APPROVED
            : PayrollReviewDecision.REJECTED;
        const updateData: Prisma.PayrollUncheckedUpdateInput = {
          managerDecision: decision,
          managerReviewedAt: now,
          managerReviewedByUserId: session.userId ?? null,
          managerReviewRemarks: remarks,
          status:
            input.decision === "REJECTED"
              ? PayrollStatus.DRAFT
              : PayrollStatus.REVIEWED,
        };
        if (input.decision === "REJECTED") {
          updateData.gmDecision = PayrollReviewDecision.PENDING;
          updateData.gmReviewedAt = null;
          updateData.gmReviewedByUserId = null;
          updateData.gmReviewRemarks = null;
          updateData.releasedAt = null;
          updateData.releasedByUserId = null;
        }

        await tx.payroll.update({
          where: { payrollId: run.payrollId },
          data: updateData,
        });
      } else {
        if (run.managerDecision !== PayrollReviewDecision.APPROVED) {
          throw new Error(
            "General Manager review requires Manager approval first",
          );
        }

        const decision =
          input.decision === "APPROVED"
            ? PayrollReviewDecision.APPROVED
            : PayrollReviewDecision.REJECTED;
        const updateData: Prisma.PayrollUncheckedUpdateInput = {
          gmDecision: decision,
          gmReviewedAt: now,
          gmReviewedByUserId: session.userId ?? null,
          gmReviewRemarks: remarks,
          status:
            input.decision === "REJECTED"
              ? PayrollStatus.DRAFT
              : PayrollStatus.REVIEWED,
          releasedAt: null,
          releasedByUserId: null,
        };

        await tx.payroll.update({
          where: { payrollId: run.payrollId },
          data: updateData,
        });
      }

      await tx.payrollEmployee.updateMany({
        where: { payrollId: input.payrollId },
        data: {
          status:
            input.decision === "REJECTED"
              ? PayrollEmployeeStatus.DRAFT
              : PayrollEmployeeStatus.REVIEWED,
          updatedByUserId: session.userId ?? null,
        },
      });
    });

    revalidatePayrollPages();
    return await getPayrollRunDetails(input.payrollId);
  } catch (error) {
    console.error("Error reviewing payroll run:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to review payroll run",
    };
  }
}

export async function releasePayrollRun(payrollId: string): Promise<{
  success: boolean;
  data?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canReviewAsGeneralManager(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollId) return { success: false, error: "Payroll ID is required" };

    await db.$transaction(async (tx) => {
      const run = await tx.payroll.findUnique({
        where: { payrollId },
        select: {
          payrollId: true,
          status: true,
          managerDecision: true,
          gmDecision: true,
        },
      });
      if (!run) throw new Error("Payroll run not found");
      if (run.status === PayrollStatus.RELEASED) {
        throw new Error("Payroll run is already released");
      }
      if (run.managerDecision !== PayrollReviewDecision.APPROVED) {
        throw new Error("Manager approval is required before release");
      }
      if (run.gmDecision !== PayrollReviewDecision.APPROVED) {
        throw new Error("General Manager approval is required before release");
      }

      await tx.payroll.update({
        where: { payrollId },
        data: {
          status: PayrollStatus.RELEASED,
          releasedAt: new Date(),
          releasedByUserId: session.userId ?? null,
        },
      });

      await tx.payrollEmployee.updateMany({
        where: { payrollId },
        data: {
          status: PayrollEmployeeStatus.RELEASED,
          updatedByUserId: session.userId ?? null,
        },
      });
    });

    revalidatePayrollPages();
    return await getPayrollRunDetails(payrollId);
  } catch (error) {
    console.error("Error releasing payroll run:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to release payroll run",
    };
  }
}

export async function listPayrollPayslips(input?: {
  employeeId?: string;
}): Promise<{
  success: boolean;
  data?: PayrollPayslipSummary[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canViewPayslips(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const employee =
      session.role === Roles.Employee && session.userId
        ? await db.employee.findUnique({
            where: { userId: session.userId },
            select: { employeeId: true },
          })
        : null;

    if (session.role === Roles.Employee && !employee?.employeeId) {
      return { success: false, error: "Employee profile not found" };
    }

    const targetEmployeeId =
      session.role === Roles.Employee
        ? employee?.employeeId
        : input?.employeeId?.trim() || undefined;

    const rows = await db.payrollEmployee.findMany({
      where: {
        employeeId: targetEmployeeId,
        payroll: {
          status:
            session.role === Roles.Employee
              ? PayrollStatus.RELEASED
              : undefined,
        },
      },
      include: {
        payroll: {
          select: {
            payrollId: true,
            payrollPeriodStart: true,
            payrollPeriodEnd: true,
            payrollType: true,
            status: true,
            generatedAt: true,
            releasedAt: true,
          },
        },
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { payroll: { payrollPeriodStart: "desc" } },
        { employee: { lastName: "asc" } },
      ],
    });

    const data: PayrollPayslipSummary[] = rows.map((row) => ({
      payrollEmployeeId: row.id,
      payrollId: row.payrollId,
      payrollPeriodStart: row.payroll.payrollPeriodStart.toISOString(),
      payrollPeriodEnd: row.payroll.payrollPeriodEnd.toISOString(),
      payrollType: row.payroll.payrollType,
      payrollStatus: row.payroll.status,
      generatedAt: row.payroll.generatedAt.toISOString(),
      releasedAt: toIsoString(row.payroll.releasedAt),
      employeeId: row.employeeId,
      employeeCode: row.employee.employeeCode,
      employeeName: [row.employee.firstName, row.employee.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
      grossPay: toNumber(row.grossPay, 0),
      totalEarnings: toNumber(row.totalEarnings, 0),
      totalDeductions: toNumber(row.totalDeductions, 0),
      netPay: toNumber(row.netPay, 0),
      status: row.status,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error listing payroll payslips:", error);
    return { success: false, error: "Failed to load payslips" };
  }
}

export async function getPayrollEmployeeAttendance(
  payrollEmployeeId: string,
): Promise<{
  success: boolean;
  data?: PayrollEmployeeAttendanceRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canViewPayslips(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollEmployeeId) {
      return { success: false, error: "Payroll employee ID is required" };
    }

    const owner = await db.payrollEmployee.findUnique({
      where: { id: payrollEmployeeId },
      select: {
        id: true,
        employee: {
          select: {
            employeeId: true,
            userId: true,
          },
        },
        payroll: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!owner) {
      return { success: false, error: "Payroll employee row not found" };
    }

    if (session.role === Roles.Employee) {
      if (!session.userId || owner.employee.userId !== session.userId) {
        return { success: false, error: "Unauthorized" };
      }
      if (owner.payroll.status !== PayrollStatus.RELEASED) {
        return {
          success: false,
          error:
            "Attendance breakdown is available after payroll release only.",
        };
      }
    }

    const rows = await db.attendance.findMany({
      where: { payrollEmployeeId },
      include: {
        expectedShift: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ workDate: "asc" }],
    });

    const data: PayrollEmployeeAttendanceRow[] = rows.map((row) => ({
      id: row.id,
      workDate: row.workDate.toISOString(),
      status: row.status,
      expectedShiftName: row.expectedShift?.name ?? null,
      scheduledStartMinutes: row.scheduledStartMinutes ?? null,
      scheduledEndMinutes: row.scheduledEndMinutes ?? null,
      actualInAt: toIsoString(row.actualInAt),
      actualOutAt: toIsoString(row.actualOutAt),
      workedMinutes: row.workedMinutes ?? null,
      netWorkedMinutes: row.netWorkedMinutes ?? null,
      lateMinutes: row.lateMinutes ?? 0,
      undertimeMinutes: row.undertimeMinutes ?? 0,
      overtimeMinutes:
        row.overtimeMinutesApproved > 0
          ? row.overtimeMinutesApproved
          : (row.overtimeMinutesRaw ?? 0),
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error loading payroll employee attendance:", error);
    return {
      success: false,
      error: "Failed to load payroll employee attendance breakdown",
    };
  }
}

export async function getPayrollPayslip(payrollEmployeeId: string): Promise<{
  success: boolean;
  data?: PayrollPayslipDetail;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!canViewPayslips(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!payrollEmployeeId) {
      return { success: false, error: "Payslip ID is required" };
    }

    const row = await db.payrollEmployee.findUnique({
      where: { id: payrollEmployeeId },
      include: {
        payroll: {
          select: {
            payrollId: true,
            payrollPeriodStart: true,
            payrollPeriodEnd: true,
            payrollType: true,
            status: true,
            generatedAt: true,
            releasedAt: true,
          },
        },
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            userId: true,
          },
        },
        earnings: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            earningType: true,
            amount: true,
            minutes: true,
            rateSnapshot: true,
            source: true,
            isManual: true,
            referenceType: true,
            referenceId: true,
            remarks: true,
            isVoided: true,
          },
        },
        deductions: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            deductionType: true,
            deductionTypeId: true,
            deductionCodeSnapshot: true,
            deductionNameSnapshot: true,
            assignmentId: true,
            amount: true,
            minutes: true,
            rateSnapshot: true,
            source: true,
            isManual: true,
            referenceType: true,
            referenceId: true,
            remarks: true,
            isVoided: true,
          },
        },
      },
    });

    if (!row) return { success: false, error: "Payslip not found" };

    if (session.role === Roles.Employee) {
      if (row.employee.userId !== session.userId) {
        return { success: false, error: "Unauthorized" };
      }
      if (row.payroll.status !== PayrollStatus.RELEASED) {
        return {
          success: false,
          error: "Payslip is not yet available. Payroll is not released.",
        };
      }
    }

    const employeeName = [row.employee.firstName, row.employee.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      success: true,
      data: {
        payrollEmployeeId: row.id,
        payrollId: row.payrollId,
        payrollPeriodStart: row.payroll.payrollPeriodStart.toISOString(),
        payrollPeriodEnd: row.payroll.payrollPeriodEnd.toISOString(),
        payrollType: row.payroll.payrollType,
        payrollStatus: row.payroll.status,
        generatedAt: row.payroll.generatedAt.toISOString(),
        releasedAt: toIsoString(row.payroll.releasedAt),
        employeeId: row.employeeId,
        employeeCode: row.employee.employeeCode,
        employeeName,
        grossPay: toNumber(row.grossPay, 0),
        totalEarnings: toNumber(row.totalEarnings, 0),
        totalDeductions: toNumber(row.totalDeductions, 0),
        netPay: toNumber(row.netPay, 0),
        status: row.status,
        attendanceStart: row.attendanceStart.toISOString(),
        attendanceEnd: row.attendanceEnd.toISOString(),
        daysPresent: row.daysPresent,
        daysAbsent: row.daysAbsent,
        daysLate: row.daysLate,
        minutesWorked: row.minutesWorked,
        minutesNetWorked: row.minutesNetWorked,
        minutesOvertime: row.minutesOvertime,
        minutesUndertime: row.minutesUndertime,
        dailyRateSnapshot: toNumberOrNull(row.dailyRateSnapshot),
        ratePerMinuteSnapshot: toNumberOrNull(row.ratePerMinuteSnapshot),
        notes: row.notes ?? null,
        earnings: row.earnings.map(serializeEarningLine),
        deductions: row.deductions.map(serializeDeductionLine),
      },
    };
  } catch (error) {
    console.error("Error loading payroll payslip:", error);
    return { success: false, error: "Failed to load payslip" };
  }
}
