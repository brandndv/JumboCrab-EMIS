import {
  ATTENDANCE_STATUS,
  DeductionAmountMode,
  DeductionFrequency,
  PayrollDeductionType,
  PayrollEarningType,
  PayrollLineSource,
  PayrollReferenceType,
  type Prisma,
} from "@prisma/client";
import {
  computePayableAmountFromNetMinutes,
  computeRatePerMinute,
  computeScheduledPaidMinutes,
} from "@/lib/attendance";
import {
  isDateKeyInRange,
  roundCurrency,
  roundSixDecimals,
  toDateKeyInTz,
  toNumber,
  toNumberOrNull,
  toPercent,
} from "@/lib/payroll/helpers";
import {
  OVERTIME_RATE_MULTIPLIER,
  UNDERTIME_DEDUCTION_MULTIPLIER,
} from "./payroll-shared";

export type PayrollGenerationEmployee = Prisma.EmployeeGetPayload<{
  include: {
    contribution: true;
  };
}>;

export type PayrollGenerationAssignment =
  Prisma.EmployeeDeductionAssignmentGetPayload<{
    include: {
      deductionType: true;
    };
  }>;

export type PayrollGenerationAttendanceRow = {
  id: string;
  employeeId: string;
  workDate: Date;
  status: string;
  isPaidLeave: boolean | null;
  paidHoursPerDay: Prisma.Decimal | number | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
  workedMinutes: number | null;
  netWorkedMinutes: number | null;
  lateMinutes: number | null;
  undertimeMinutes: number | null;
  overtimeMinutesRaw: number | null;
  overtimeMinutesApproved: number | null;
};

export type PayrollEarningDraft = {
  earningType: PayrollEarningType;
  amount: number;
  minutes?: number;
  rateSnapshot?: number;
  source: PayrollLineSource;
  isManual: boolean;
  referenceType?: PayrollReferenceType;
  referenceId?: string;
  remarks?: string;
};

export type PayrollDeductionDraft = {
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
};

export type EmployeePayrollDraft = {
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  minutesWorked: number;
  minutesNetWorked: number;
  minutesOvertime: number;
  minutesUndertime: number;
  dailyRateSnapshot: number | null;
  ratePerMinuteSnapshot: number | null;
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  earnings: PayrollEarningDraft[];
  deductions: PayrollDeductionDraft[];
};

export const groupAttendanceRowsByEmployee = (
  rows: PayrollGenerationAttendanceRow[],
  periodStartKey: string,
  periodEndKey: string,
) => {
  const attendanceByEmployee = new Map<string, PayrollGenerationAttendanceRow[]>();

  rows.forEach((row) => {
    const key = toDateKeyInTz(row.workDate);
    if (!isDateKeyInRange(key, periodStartKey, periodEndKey)) return;
    if (!attendanceByEmployee.has(row.employeeId)) {
      attendanceByEmployee.set(row.employeeId, []);
    }
    attendanceByEmployee.get(row.employeeId)!.push(row);
  });

  return attendanceByEmployee;
};

export const filterActiveAssignmentsForPeriod = (
  assignments: PayrollGenerationAssignment[],
  periodStartKey: string,
  periodEndKey: string,
) =>
  assignments.filter((assignment) => {
    const fromKey = toDateKeyInTz(assignment.effectiveFrom);
    const toKey = assignment.effectiveTo
      ? toDateKeyInTz(assignment.effectiveTo)
      : null;
    return fromKey <= periodEndKey && (!toKey || toKey >= periodStartKey);
  });

export const groupActiveAssignmentsByEmployee = (
  assignments: PayrollGenerationAssignment[],
) => {
  const assignmentByEmployee = new Map<string, PayrollGenerationAssignment[]>();

  assignments.forEach((assignment) => {
    if (!assignmentByEmployee.has(assignment.employeeId)) {
      assignmentByEmployee.set(assignment.employeeId, []);
    }
    assignmentByEmployee.get(assignment.employeeId)!.push(assignment);
  });

  return assignmentByEmployee;
};

export const buildEmployeePayrollDraft = (input: {
  employee: PayrollGenerationEmployee;
  employeeRows: PayrollGenerationAttendanceRow[];
  payrollId: string;
  applyGovernmentContributions: boolean;
  employeeAssignments: PayrollGenerationAssignment[];
  oneTimeAlreadyApplied: Set<string>;
}): EmployeePayrollDraft => {
  const { employee, employeeRows, payrollId } = input;
  const dailyRate = toNumberOrNull(employee.dailyRate);

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  for (const row of employeeRows) {
    const isPaidLeaveRow =
      row.status === ATTENDANCE_STATUS.LEAVE && row.isPaidLeave === true;

    if (
      row.status === ATTENDANCE_STATUS.ABSENT ||
      (row.status === ATTENDANCE_STATUS.LEAVE && !isPaidLeaveRow)
    ) {
      daysAbsent += 1;
    } else if (
      row.status === ATTENDANCE_STATUS.PRESENT ||
      row.status === ATTENDANCE_STATUS.LATE ||
      isPaidLeaveRow
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

    if (scheduledPaidMinutes != null) {
      if (row.netWorkedMinutes == null) {
        undertimeMinutes = scheduledPaidMinutes;
      }
      undertimeMinutes = Math.min(undertimeMinutes, scheduledPaidMinutes);
    }

    const payableWorkedMinutes =
      scheduledPaidMinutes != null
        ? Math.max(0, scheduledPaidMinutes - undertimeMinutes)
        : netWorkedMinutes;

    const isPaidLeaveRow =
      row.status === ATTENDANCE_STATUS.LEAVE && row.isPaidLeave === true;

    const isZeroWorkRow =
      (row.status === ATTENDANCE_STATUS.ABSENT ||
        (row.status === ATTENDANCE_STATUS.LEAVE && !isPaidLeaveRow) ||
        row.status === ATTENDANCE_STATUS.INCOMPLETE) &&
      Math.max(0, row.workedMinutes ?? 0) === 0 &&
      Math.max(0, row.netWorkedMinutes ?? 0) === 0;

    const baseEarningMinutes =
      isPaidLeaveRow
        ? scheduledPaidMinutes ?? 0
        : isZeroWorkRow
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
      isPaidLeaveRow || isZeroWorkRow || scheduledPaidMinutes == null
        ? 0
        : ((computePayableAmountFromNetMinutes({
            netWorkedMinutes: undertimeMinutes,
            ratePerMinute,
          }) ?? 0) *
            UNDERTIME_DEDUCTION_MULTIPLIER);

    const approvedOvertime = Math.max(0, row.overtimeMinutesApproved ?? 0);
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
    rowPayrollMetrics.reduce((sum, row) => sum + row.overtimePayAmount, 0),
  );
  const undertimeDeduction = roundCurrency(
    rowPayrollMetrics.reduce(
      (sum, row) => sum + row.undertimeDeductionAmount,
      0,
    ),
  );

  const earnings: PayrollEarningDraft[] = [];

  if (basePay > 0) {
    earnings.push({
      earningType: PayrollEarningType.BASE_PAY,
      amount: basePay,
      minutes: minutesBasePay,
      rateSnapshot: ratePerMinuteSnapshot ?? undefined,
      source: PayrollLineSource.SYSTEM,
      isManual: false,
      referenceType: PayrollReferenceType.ATTENDANCE,
      referenceId: payrollId,
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
      referenceId: payrollId,
      remarks: `Overtime multiplier applied (${OVERTIME_RATE_MULTIPLIER}x)`,
    });
  }

  const deductions: PayrollDeductionDraft[] = [];

  if (undertimeDeduction > 0) {
    deductions.push({
      deductionType: PayrollDeductionType.UNDERTIME_DEDUCTION,
      amount: undertimeDeduction,
      minutes: minutesUndertime,
      rateSnapshot: ratePerMinuteSnapshot ?? undefined,
      source: PayrollLineSource.SYSTEM,
      isManual: false,
      referenceType: PayrollReferenceType.ATTENDANCE,
      referenceId: payrollId,
      remarks: `Computed from attendance undertime minutes (${UNDERTIME_DEDUCTION_MULTIPLIER}x, grace-aware)`,
    });
  }

  const contribution = employee.contribution;
  if (input.applyGovernmentContributions && contribution) {
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

  for (const assignment of input.employeeAssignments) {
    if (assignment.deductionType.frequency === DeductionFrequency.ONE_TIME) {
      if (input.oneTimeAlreadyApplied.has(assignment.id)) {
        continue;
      }
    }

    const configuredAmount = toNumber(
      assignment.amountOverride ?? assignment.deductionType.defaultAmount,
      0,
    );
    const configuredPercent = toNumber(
      assignment.percentOverride ?? assignment.deductionType.defaultPercent,
      0,
    );

    let amount = 0;
    if (assignment.deductionType.amountMode === DeductionAmountMode.FIXED) {
      amount = configuredAmount;
    } else {
      amount = roundCurrency(earningsSubtotal * toPercent(configuredPercent));
    }

    if (assignment.deductionType.frequency === DeductionFrequency.INSTALLMENT) {
      const balanceSeed = toNumber(
        assignment.remainingBalance ?? assignment.installmentTotal,
        0,
      );
      const installmentValue = toNumber(assignment.installmentPerPayroll, amount);
      const effectiveInstallment = Math.max(
        0,
        installmentValue > 0 ? installmentValue : amount,
      );
      const safeBalance = Math.max(0, balanceSeed);
      if (safeBalance <= 0 || effectiveInstallment <= 0) {
        continue;
      }
      amount = roundCurrency(Math.min(safeBalance, effectiveInstallment));
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

    if (assignment.deductionType.frequency === DeductionFrequency.ONE_TIME) {
      input.oneTimeAlreadyApplied.add(assignment.id);
    }
  }

  const totalEarnings = roundCurrency(
    earnings.reduce((sum, line) => sum + line.amount, 0),
  );
  const totalDeductions = roundCurrency(
    deductions.reduce((sum, line) => sum + line.amount, 0),
  );

  return {
    daysPresent,
    daysAbsent,
    daysLate,
    minutesWorked,
    minutesNetWorked,
    minutesOvertime,
    minutesUndertime,
    dailyRateSnapshot: dailyRate,
    ratePerMinuteSnapshot,
    grossPay: totalEarnings,
    totalEarnings,
    totalDeductions,
    netPay: roundCurrency(totalEarnings - totalDeductions),
    earnings,
    deductions,
  };
};
