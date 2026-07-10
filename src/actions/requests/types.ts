import {
  CashAdvanceDeductionMode,
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  EmployeeDeductionAssignmentStatus,
  GovernmentLoanAgency,
  GovernmentLoanAssistanceRequestStatus,
  LeaveCreditLedgerEntryType,
  LeaveCreditResetRunType,
  LeaveCreditType,
  LeaveRequestStatus,
  LeaveRequestType,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";

export type CashAdvanceRequestPayload = {
  amount: string | number;
  preferredStartDate?: string | Date | null;
  reason?: string | null;
};

export type GovernmentLoanAssistanceRequestPayload = {
  agency: GovernmentLoanAgency | "SSS_SALARY_LOAN" | "PAGIBIG_MPL";
  requestedAmount: string | number;
  termMonths: string | number;
  employeeRemarks?: string | null;
};

export type LeaveRequestPayload = {
  leaveType: LeaveRequestType | string;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
};

export type DayOffRequestPayload = {
  sourceOffDate: string | Date;
  targetWorkDate: string | Date;
  reason?: string | null;
};

export type ScheduleSwapRequestPayload = {
  coworkerEmployeeId: string;
  workDate: string | Date;
  reason?: string | null;
};

export type ScheduleChangeRequestPayload = {
  startDate: string | Date;
  endDate: string | Date;
  requestedShiftId: string | number;
  reason?: string | null;
};

export type RequestReviewPayload = {
  id: string;
  decision: "APPROVED" | "REJECTED";
  managerRemarks?: string | null;
  approvedAmount?: string | number | null;
  deductionMode?: CashAdvanceDeductionMode | "FULL_NEXT_PAYROLL" | "INSTALLMENTS" | null;
  approvedRepaymentPerPayroll?: string | number | null;
  approvedEffectiveFrom?: string | Date | null;
};

export type RequestSoftDeletePayload = {
  id: string;
  requestType:
    | "LEAVE"
    | "DAY_OFF"
    | "SCHEDULE_CHANGE"
    | "SCHEDULE_SWAP"
    | "GOVERNMENT_LOAN"
    | "CASH_ADVANCE";
  reason?: string | null;
};

export type GovernmentLoanStatusUpdatePayload = {
  id: string;
  status: "PROCESSING" | "APPROVED_BY_AGENCY" | "DECLINED_BY_AGENCY";
  managerRemarks?: string | null;
  agencyRemarks?: string | null;
};

export type GovernmentLoanFinalizePayload = {
  id: string;
  approvedAmount: string | number;
  approvedMonthlyPayment: string | number;
  repaymentStartDate: string | Date;
  managerRemarks?: string | null;
  agencyRemarks?: string | null;
};

export type SilEncashmentRequestPayload = {
  days: string | number;
  employeeRemarks?: string | null;
};

export type SilEncashmentReviewPayload = {
  id: string;
  decision: "APPROVED" | "REJECTED";
  managerRemarks?: string | null;
};

export type ScheduleSwapCoworkerReviewPayload = {
  id: string;
  decision: "ACCEPTED" | "DECLINED";
  coworkerRemarks?: string | null;
};

export type CashAdvanceRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  amount: number;
  repaymentPerPayroll: number;
  preferredStartDate: string;
  approvedAmount?: number | null;
  approvedDeductionMode?: CashAdvanceDeductionMode | null;
  approvedRepaymentPerPayroll?: number | null;
  approvedEffectiveFrom?: string | null;
  reason?: string | null;
  status: CashAdvanceRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  deductionAssignmentId?: string | null;
  linkedDeductionStatus?: EmployeeDeductionAssignmentStatus | null;
  linkedDeductionEffectiveFrom?: string | null;
  linkedDeductionRemainingBalance?: number | null;
};

export type GovernmentLoanChecklistItem = {
  key:
    | "REQUEST_SUBMITTED"
    | "MARK_PROCESSING"
    | "AGENCY_APPROVED"
    | "PAYROLL_DEDUCTION_RECORDED";
  label: string;
  status: "DONE" | "CURRENT" | "PENDING" | "BLOCKED";
};

export type GovernmentLoanAssistanceRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  agency: GovernmentLoanAgency;
  agencyLabel: string;
  requestedAmount: number;
  termMonths: 12 | 24;
  estimatedMonthlyDeduction: number;
  estimatedPerPayrollDeduction: number;
  governmentIdSnapshot: string;
  monthlySalarySnapshot?: number | null;
  checklist: GovernmentLoanChecklistItem[];
  checklistProgress: number;
  employeeRemarks?: string | null;
  status: GovernmentLoanAssistanceRequestStatus;
  managerRemarks?: string | null;
  agencyRemarks?: string | null;
  approvedAmount?: number | null;
  approvedMonthlyPayment?: number | null;
  repaymentStartDate?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  finalizedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  deductionAssignmentId?: string | null;
  linkedDeductionStatus?: EmployeeDeductionAssignmentStatus | null;
  linkedDeductionEffectiveFrom?: string | null;
  linkedDeductionRemainingBalance?: number | null;
};

export type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: LeaveRequestType;
  leaveCreditType: LeaveCreditType | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  totalDays: number;
  creditDaysUsed: number;
  paidDaysCount: number;
  unpaidDaysCount: number;
  paidDateList: string[];
  unpaidDateList: string[];
};

export type SilEncashmentRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  days: number;
  status: LeaveRequestStatus;
  employeeRemarks?: string | null;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  ledgerEntryId?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeLeaveCreditBucketSummary = {
  leaveType: LeaveCreditType;
  annualCredits: number;
  used: number;
  remaining: number;
  cycleStartDate: string;
  resetMonth: number;
  resetDay: number;
};

export type EmployeeLeaveBalanceSummary = {
  referenceDate: string;
  sick: EmployeeLeaveCreditBucketSummary;
  sil: EmployeeLeaveCreditBucketSummary;
  year?: number;
  paidLeaveAllowance?: number;
  paidLeaveUsed?: number;
  paidLeaveRemaining?: number;
  paidSickLeaveAllowance?: number;
  paidSickLeaveUsed?: number;
  paidSickLeaveRemaining?: number;
};

export type EmployeeDayOffMonthlySummary = {
  year: number;
  month: number;
  monthLabel: string;
  approvedThisMonth: number;
};

export type DayOffPreview = {
  sourceOffDate: string;
  targetWorkDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  source: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  target: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type DayOffRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  sourceOffDate: string;
  targetWorkDate: string;
  currentShiftLabel: string;
  sourceShiftLabel: string;
  targetShiftLabel: string;
  reason?: string | null;
  status: DayOffRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleChangeShiftOption = {
  id: number;
  code: string;
  name: string;
  colorHex?: string | null;
  shiftLabel: string;
};

export type ScheduleChangePreview = {
  startDate: string;
  endDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  requested: {
    shiftId: number;
    shiftCode: string;
    shiftName: string;
    shiftLabel: string;
  };
  totalDays: number;
};

export type ScheduleChangeRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  currentShiftLabel: string;
  requestedShiftLabel: string;
  requestedShiftId: number;
  reason?: string | null;
  status: ScheduleChangeRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSwapEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
};

export type ScheduleSwapPreview = {
  workDate: string;
  requester: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  coworker: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type ScheduleSwapRequestRow = {
  id: string;
  requesterEmployeeId: string;
  requesterEmployeeCode: string;
  requesterEmployeeName: string;
  coworkerEmployeeId: string;
  coworkerEmployeeCode: string;
  coworkerEmployeeName: string;
  workDate: string;
  requesterShiftLabel: string;
  coworkerShiftLabel: string;
  reason?: string | null;
  status: ScheduleSwapRequestStatus;
  coworkerRemarks?: string | null;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  coworkerRespondedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  isIncomingToViewer: boolean;
  isOutgoingFromViewer: boolean;
};

export type LeaveCreditPolicyRow = {
  id: string;
  leaveType: LeaveCreditType;
  annualCredits: number;
  resetMonth: number;
  resetDay: number;
  createdAt: string;
  updatedAt: string;
};

export type LeaveCreditResetRunRow = {
  id: string;
  policyId: string;
  leaveType: LeaveCreditType;
  cycleStartDate: string;
  cycleEndDate: string;
  effectiveDate: string;
  annualCredits: number;
  employeeCount: number;
  runType: LeaveCreditResetRunType;
  notes?: string | null;
  initiatedByUserId?: string | null;
  createdAt: string;
};

export type EmployeeLeaveCreditLedgerRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: LeaveCreditType;
  entryType: LeaveCreditLedgerEntryType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  effectiveDate: string;
  cycleStartDate: string;
  notes?: string | null;
  leaveRequestId?: string | null;
  resetRunId?: string | null;
  createdAt: string;
};
