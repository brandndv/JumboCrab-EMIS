export type PayrollTypeValue =
  | "BIMONTHLY"
  | "MONTHLY"
  | "WEEKLY"
  | "OFF_CYCLE";

export type PayrollFrequencyValue = "WEEKLY" | "BIMONTHLY" | "MONTHLY";

export type PayrollStatusValue =
  | "DRAFT"
  | "REVIEWED"
  | "RELEASED"
  | "FINALIZED"
  | "VOIDED";

export type PayrollReviewDecisionValue = "PENDING" | "APPROVED" | "REJECTED";

export type PayrollEmployeeStatusValue =
  | "DRAFT"
  | "REVIEWED"
  | "RELEASED"
  | "FINALIZED"
  | "VOIDED";

export type PayrollEarningTypeValue =
  | "BASE_PAY"
  | "OVERTIME_PAY"
  | "ADJUSTMENT"
  | "BONUS"
  | "ALLOWANCE";

export type PayrollDeductionTypeValue =
  | "UNDERTIME_DEDUCTION"
  | "CONTRIBUTION_SSS"
  | "CONTRIBUTION_PHILHEALTH"
  | "CONTRIBUTION_PAGIBIG"
  | "WITHHOLDING_TAX"
  | "LOAN"
  | "CASH_ADVANCE"
  | "PENALTY"
  | "OTHER";

export type ContributionTypeValue =
  | "SSS"
  | "PHILHEALTH"
  | "PAGIBIG"
  | "WITHHOLDING";

export type PayrollLineSourceValue =
  | "SYSTEM"
  | "MANUAL"
  | "IMPORT"
  | "CONTRIBUTION_ENGINE";

export type PayrollReferenceTypeValue =
  | "ATTENDANCE"
  | "CONTRIBUTION"
  | "VIOLATION"
  | "LOAN"
  | "MANUAL";

export type PayrollRunSummary = {
  payrollId: string;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  payrollType: PayrollTypeValue;
  status: PayrollStatusValue;
  managerDecision: PayrollReviewDecisionValue;
  gmDecision: PayrollReviewDecisionValue;
  generatedAt: string;
  managerReviewedAt: string | null;
  gmReviewedAt: string | null;
  releasedAt: string | null;
  managerReviewRemarks: string | null;
  gmReviewRemarks: string | null;
  notes: string | null;
  createdByName: string | null;
  managerReviewedByName: string | null;
  gmReviewedByName: string | null;
  releasedByName: string | null;
  employeeCount: number;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
};

export type PayrollEarningLine = {
  id: string;
  earningType: PayrollEarningTypeValue;
  amount: number;
  minutes: number | null;
  rateSnapshot: number | null;
  source: PayrollLineSourceValue;
  isManual: boolean;
  referenceType: PayrollReferenceTypeValue | null;
  referenceId: string | null;
  remarks: string | null;
  isVoided: boolean;
};

export type PayrollDeductionLine = {
  id: string;
  deductionType: PayrollDeductionTypeValue;
  deductionTypeId: string | null;
  deductionCodeSnapshot: string | null;
  deductionNameSnapshot: string | null;
  assignmentId: string | null;
  contributionType: ContributionTypeValue | null;
  bracketIdSnapshot: string | null;
  bracketReferenceSnapshot: string | null;
  payrollFrequency: PayrollFrequencyValue | null;
  periodStartSnapshot: string | null;
  periodEndSnapshot: string | null;
  compensationBasisSnapshot: number | null;
  employeeShareSnapshot: number | null;
  employerShareSnapshot: number | null;
  baseTaxSnapshot: number | null;
  marginalRateSnapshot: number | null;
  quantitySnapshot: number | null;
  unitLabelSnapshot: string | null;
  metadata: Record<string, unknown> | null;
  amount: number;
  minutes: number | null;
  rateSnapshot: number | null;
  source: PayrollLineSourceValue;
  isManual: boolean;
  referenceType: PayrollReferenceTypeValue | null;
  referenceId: string | null;
  remarks: string | null;
  isVoided: boolean;
};

export type PayrollEmployeeDetail = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  status: PayrollEmployeeStatusValue;
  attendanceStart: string;
  attendanceEnd: string;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  minutesWorked: number;
  minutesNetWorked: number;
  minutesOvertime: number;
  minutesUndertime: number;
  positionIdSnapshot: string | null;
  positionNameSnapshot: string | null;
  dailyRateSnapshot: number | null;
  hourlyRateSnapshot: number | null;
  monthlyRateSnapshot: number | null;
  currencyCodeSnapshot: string | null;
  ratePerMinuteSnapshot: number | null;
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  notes: string | null;
  earnings: PayrollEarningLine[];
  deductions: PayrollDeductionLine[];
};

export type PayrollRunDetail = PayrollRunSummary & {
  employees: PayrollEmployeeDetail[];
};

export type PayrollEmployeeAttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  expectedShiftName: string | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
  actualInAt: string | null;
  actualOutAt: string | null;
  workedMinutes: number | null;
  netWorkedMinutes: number | null;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
};

export type PayrollPayslipSummary = {
  payrollEmployeeId: string;
  payrollId: string;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  payrollType: PayrollTypeValue;
  payrollStatus: PayrollStatusValue;
  generatedAt: string;
  releasedAt: string | null;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: PayrollEmployeeStatusValue;
};

export type PayrollPayslipDetail = PayrollPayslipSummary & {
  attendanceStart: string;
  attendanceEnd: string;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  minutesWorked: number;
  minutesNetWorked: number;
  minutesOvertime: number;
  minutesUndertime: number;
  positionIdSnapshot: string | null;
  positionNameSnapshot: string | null;
  dailyRateSnapshot: number | null;
  hourlyRateSnapshot: number | null;
  monthlyRateSnapshot: number | null;
  currencyCodeSnapshot: string | null;
  ratePerMinuteSnapshot: number | null;
  notes: string | null;
  earnings: PayrollEarningLine[];
  deductions: PayrollDeductionLine[];
};

export type GeneratePayrollInput = {
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  payrollType: PayrollTypeValue;
  notes?: string;
  employeeIds?: string[];
};

export type PayrollGenerationReadinessEmployee = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  unlockedRows: number;
  firstUnlockedDate: string;
  lastUnlockedDate: string;
};

export type PayrollGenerationReadiness = {
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  activeEmployees: number;
  employeesWithRows: number;
  employeesWithUnlockedRows: number;
  totalRows: number;
  lockedRows: number;
  unlockedRows: number;
  allLocked: boolean;
  unlockedEmployees: PayrollGenerationReadinessEmployee[];
};

export type PayrollEligibleEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
};

export type ReviewPayrollInput = {
  payrollId: string;
  level: "MANAGER" | "GENERAL_MANAGER";
  decision: "APPROVED" | "REJECTED";
  remarks?: string;
};
