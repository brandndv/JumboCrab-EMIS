import {
  GovernmentLoanAgency,
  GovernmentLoanAssistanceRequestStatus,
  Prisma,
} from "@prisma/client";
import {
  employeeRequestSelect,
  enumerateZonedDaysInclusive,
  reviewedBySelect,
  toEmployeeName,
} from "./requests-core-shared";
import { formatShiftSnapshotLabel } from "./requests-schedule-shared";
import type {
  CashAdvanceRequestRow,
  DayOffRequestRow,
  EmployeeLeaveCreditLedgerRow,
  GovernmentLoanAssistanceRequestRow,
  GovernmentLoanChecklistItem,
  LeaveCreditPolicyRow,
  LeaveCreditResetRunRow,
  LeaveRequestRow,
  SilEncashmentRequestRow,
  ScheduleChangeRequestRow,
  ScheduleSwapRequestRow,
} from "./types";

const toIsoString = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type CashAdvanceRequestRecord = Prisma.CashAdvanceRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
    deductionAssignment: {
      select: {
        id: true;
        status: true;
        effectiveFrom: true;
        remainingBalance: true;
      };
    };
  };
}>;

type GovernmentLoanAssistanceRequestRecord =
  Prisma.GovernmentLoanAssistanceRequestGetPayload<{
    include: {
      employee: { select: typeof employeeRequestSelect };
      reviewedBy: { select: typeof reviewedBySelect };
      deductionAssignment: {
        select: {
          id: true;
          status: true;
          effectiveFrom: true;
          remainingBalance: true;
        };
      };
    };
  }>;

export type CashAdvanceRequestRecordCompat = Omit<
  CashAdvanceRequestRecord,
  | "approvedAmount"
  | "approvedDeductionMode"
  | "approvedRepaymentPerPayroll"
  | "approvedEffectiveFrom"
  | "reviewedByUserId"
> & {
  approvedAmount?: Prisma.Decimal | number | null;
  approvedDeductionMode?: CashAdvanceRequestRecord["approvedDeductionMode"] | null;
  approvedRepaymentPerPayroll?: Prisma.Decimal | number | null;
  approvedEffectiveFrom?: Date | null;
  reviewedByUserId?: string | null;
};

type LeaveRequestRecord = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
    attendances: {
      select: {
        workDate: true;
      };
    };
  };
}>;

type SilEncashmentRequestRecord = Prisma.SilEncashmentRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

type DayOffRequestRecord = Prisma.DayOffRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

export type DayOffRequestRecordCompat = Omit<
  DayOffRequestRecord,
  | "sourceOffDate"
  | "targetWorkDate"
  | "sourceShiftIdSnapshot"
  | "sourceShiftCodeSnapshot"
  | "sourceShiftNameSnapshot"
  | "sourceStartMinutesSnapshot"
  | "sourceEndMinutesSnapshot"
  | "sourceSpansMidnightSnapshot"
  | "reviewedByUserId"
> & {
  sourceOffDate?: Date | null;
  targetWorkDate?: Date | null;
  sourceShiftIdSnapshot?: number | null;
  sourceShiftCodeSnapshot?: string | null;
  sourceShiftNameSnapshot?: string | null;
  sourceStartMinutesSnapshot?: number | null;
  sourceEndMinutesSnapshot?: number | null;
  sourceSpansMidnightSnapshot?: boolean | null;
  reviewedByUserId?: string | null;
};

type ScheduleChangeRequestRecord = Prisma.ScheduleChangeRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

export type ScheduleChangeRequestRecordCompat = Omit<
  ScheduleChangeRequestRecord,
  "startDate" | "endDate" | "reviewedByUserId"
> & {
  startDate?: Date | null;
  endDate?: Date | null;
  reviewedByUserId?: string | null;
};

type ScheduleSwapRequestRecord = Prisma.ScheduleSwapRequestGetPayload<{
  include: {
    requesterEmployee: { select: typeof employeeRequestSelect };
    coworkerEmployee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

export const serializeCashAdvanceRequest = (
  row: CashAdvanceRequestRecordCompat,
): CashAdvanceRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  amount: toNumber(row.amount) ?? 0,
  repaymentPerPayroll: toNumber(row.repaymentPerPayroll) ?? 0,
  preferredStartDate: row.preferredStartDate.toISOString(),
  approvedAmount: toNumber(row.approvedAmount),
  approvedDeductionMode: row.approvedDeductionMode ?? null,
  approvedRepaymentPerPayroll: toNumber(row.approvedRepaymentPerPayroll),
  approvedEffectiveFrom: toIsoString(row.approvedEffectiveFrom),
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  deductionAssignmentId: row.deductionAssignmentId ?? null,
  linkedDeductionStatus: row.deductionAssignment?.status ?? null,
  linkedDeductionEffectiveFrom: toIsoString(
    row.deductionAssignment?.effectiveFrom,
  ),
  linkedDeductionRemainingBalance: toNumber(
    row.deductionAssignment?.remainingBalance,
  ),
});

export const governmentLoanAgencyLabel = (agency: GovernmentLoanAgency) => {
  switch (agency) {
    case GovernmentLoanAgency.SSS_SALARY_LOAN:
      return "SSS Salary Loan";
    case GovernmentLoanAgency.PAGIBIG_MPL:
      return "Pag-IBIG MPL";
    default:
      return agency;
  }
};

const GOVERNMENT_LOAN_CHECKLIST: Array<Omit<GovernmentLoanChecklistItem, "status">> = [
  { key: "REQUEST_SUBMITTED", label: "Request submitted" },
  { key: "MARK_PROCESSING", label: "Manager marks processing" },
  { key: "AGENCY_APPROVED", label: "Agency approved" },
  { key: "PAYROLL_DEDUCTION_RECORDED", label: "Payroll deduction recorded" },
];

const checklistIndexForGovernmentLoanStatus = (
  status: GovernmentLoanAssistanceRequestStatus,
) => {
  switch (status) {
    case GovernmentLoanAssistanceRequestStatus.PENDING_MANAGER_REVIEW:
      return 1;
    case GovernmentLoanAssistanceRequestStatus.PROCESSING:
      return 2;
    case GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY:
      return 3;
    case GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL:
      return 3;
    case GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY:
    case GovernmentLoanAssistanceRequestStatus.CANCELLED:
      return 2;
    default:
      return 0;
  }
};

export const buildGovernmentLoanChecklist = (
  status: GovernmentLoanAssistanceRequestStatus,
): GovernmentLoanChecklistItem[] => {
  const activeIndex = checklistIndexForGovernmentLoanStatus(status);

  return GOVERNMENT_LOAN_CHECKLIST.map((item, index) => {
    if (
      status === GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY &&
      index === activeIndex
    ) {
      return { ...item, status: "BLOCKED" };
    }
    if (
      status === GovernmentLoanAssistanceRequestStatus.CANCELLED &&
      index >= activeIndex
    ) {
      return { ...item, status: "BLOCKED" };
    }
    if (status === GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL) {
      return { ...item, status: "DONE" };
    }
    if (index < activeIndex) return { ...item, status: "DONE" };
    if (index === activeIndex) return { ...item, status: "CURRENT" };
    return { ...item, status: "PENDING" };
  });
};

export const serializeGovernmentLoanAssistanceRequest = (
  row: GovernmentLoanAssistanceRequestRecord,
): GovernmentLoanAssistanceRequestRow => {
  const checklist = buildGovernmentLoanChecklist(row.status);
  const doneCount = checklist.filter((item) => item.status === "DONE").length;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee.employeeCode,
    employeeName: toEmployeeName(row.employee),
    agency: row.agency,
    agencyLabel: governmentLoanAgencyLabel(row.agency),
    requestedAmount: toNumber(row.requestedAmount) ?? 0,
    termMonths: row.termMonths === 24 ? 24 : 12,
    estimatedMonthlyDeduction: toNumber(row.estimatedMonthlyDeduction) ?? 0,
    estimatedPerPayrollDeduction:
      toNumber(row.estimatedPerPayrollDeduction) ?? 0,
    governmentIdSnapshot: row.governmentIdSnapshot,
    monthlySalarySnapshot: toNumber(row.monthlySalarySnapshot),
    checklist,
    checklistProgress: Math.round((doneCount / checklist.length) * 100),
    employeeRemarks: row.employeeRemarks ?? null,
    status: row.status,
    managerRemarks: row.managerRemarks ?? null,
    agencyRemarks: row.agencyRemarks ?? null,
    approvedAmount: toNumber(row.approvedAmount),
    approvedMonthlyPayment: toNumber(row.approvedMonthlyPayment),
    repaymentStartDate: toIsoString(row.repaymentStartDate),
    reviewedByName: row.reviewedBy?.username ?? null,
    reviewedAt: toIsoString(row.reviewedAt),
    finalizedAt: toIsoString(row.finalizedAt),
    submittedAt: row.submittedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deductionAssignmentId: row.deductionAssignmentId ?? null,
    linkedDeductionStatus: row.deductionAssignment?.status ?? null,
    linkedDeductionEffectiveFrom: toIsoString(
      row.deductionAssignment?.effectiveFrom,
    ),
    linkedDeductionRemainingBalance: toNumber(
      row.deductionAssignment?.remainingBalance,
    ),
  };
};

export const serializeLeaveRequest = (
  row: LeaveRequestRecord,
): LeaveRequestRow => {
  const totalDays = enumerateZonedDaysInclusive(row.startDate, row.endDate).length;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee.employeeCode,
    employeeName: toEmployeeName(row.employee),
    leaveType: row.leaveType,
    leaveCreditType:
      row.leaveType === "SICK" ? "SICK" : row.leaveType === "SIL" ? "SIL" : null,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason ?? null,
    status: row.status,
    managerRemarks: row.managerRemarks ?? null,
    reviewedByName: row.reviewedBy?.username ?? null,
    reviewedAt: toIsoString(row.reviewedAt),
    submittedAt: row.submittedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    totalDays,
    creditDaysUsed: row.leaveType === "UNPAID" ? 0 : totalDays,
    paidDaysCount: row.leaveType === "UNPAID" ? 0 : totalDays,
    unpaidDaysCount: row.leaveType === "UNPAID" ? totalDays : 0,
    paidDateList:
      row.leaveType === "UNPAID"
        ? []
        : enumerateZonedDaysInclusive(row.startDate, row.endDate).map((day) =>
            day.toISOString(),
          ),
    unpaidDateList:
      row.leaveType === "UNPAID"
        ? enumerateZonedDaysInclusive(row.startDate, row.endDate).map((day) =>
            day.toISOString(),
          )
        : [],
  };
};

export const serializeDayOffRequest = (
  row: DayOffRequestRecordCompat,
): DayOffRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  workDate: (row.targetWorkDate ?? row.workDate).toISOString(),
  sourceOffDate: (row.sourceOffDate ?? row.workDate).toISOString(),
  targetWorkDate: (row.targetWorkDate ?? row.workDate).toISOString(),
  currentShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.currentShiftCodeSnapshot,
    shiftName: row.currentShiftNameSnapshot,
    startMinutes: row.currentStartMinutesSnapshot,
    endMinutes: row.currentEndMinutesSnapshot,
  }),
  sourceShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.sourceShiftCodeSnapshot,
    shiftName: row.sourceShiftNameSnapshot,
    startMinutes: row.sourceStartMinutesSnapshot,
    endMinutes: row.sourceEndMinutesSnapshot,
  }),
  targetShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.currentShiftCodeSnapshot,
    shiftName: row.currentShiftNameSnapshot,
    startMinutes: row.currentStartMinutesSnapshot,
    endMinutes: row.currentEndMinutesSnapshot,
  }),
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeSilEncashmentRequest = (
  row: SilEncashmentRequestRecord,
): SilEncashmentRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  days: row.days,
  status: row.status,
  employeeRemarks: row.employeeRemarks ?? null,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  ledgerEntryId: row.ledgerEntryId ?? null,
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeScheduleChangeRequest = (
  row: ScheduleChangeRequestRecordCompat,
): ScheduleChangeRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  workDate: (row.startDate ?? row.workDate).toISOString(),
  startDate: (row.startDate ?? row.workDate).toISOString(),
  endDate: (row.endDate ?? row.workDate).toISOString(),
  totalDays: enumerateZonedDaysInclusive(
    row.startDate ?? row.workDate,
    row.endDate ?? row.workDate,
  ).length,
  currentShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.currentShiftCodeSnapshot,
    shiftName: row.currentShiftNameSnapshot,
    startMinutes: row.currentStartMinutesSnapshot,
    endMinutes: row.currentEndMinutesSnapshot,
  }),
  requestedShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.requestedShiftCodeSnapshot,
    shiftName: row.requestedShiftNameSnapshot,
    startMinutes: row.requestedStartMinutesSnapshot,
    endMinutes: row.requestedEndMinutesSnapshot,
  }),
  requestedShiftId: row.requestedShiftId,
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeLeaveCreditPolicy = (row: {
  id: string;
  leaveType: "SICK" | "SIL";
  annualCredits: number;
  resetMonth: number;
  resetDay: number;
  createdAt: Date;
  updatedAt: Date;
}): LeaveCreditPolicyRow => ({
  id: row.id,
  leaveType: row.leaveType,
  annualCredits: row.annualCredits,
  resetMonth: row.resetMonth,
  resetDay: row.resetDay,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeLeaveCreditResetRun = (row: {
  id: string;
  policyId: string;
  leaveType: "SICK" | "SIL";
  cycleStartDate: Date;
  cycleEndDate: Date;
  effectiveDate: Date;
  annualCredits: number;
  employeeCount: number;
  runType: "MANUAL" | "SCHEDULED";
  notes: string | null;
  initiatedByUserId: string | null;
  createdAt: Date;
}): LeaveCreditResetRunRow => ({
  id: row.id,
  policyId: row.policyId,
  leaveType: row.leaveType,
  cycleStartDate: row.cycleStartDate.toISOString(),
  cycleEndDate: row.cycleEndDate.toISOString(),
  effectiveDate: row.effectiveDate.toISOString(),
  annualCredits: row.annualCredits,
  employeeCount: row.employeeCount,
  runType: row.runType,
  notes: row.notes,
  initiatedByUserId: row.initiatedByUserId,
  createdAt: row.createdAt.toISOString(),
});

export const serializeEmployeeLeaveCreditLedger = (row: {
  id: string;
  employeeId: string;
  leaveType: "SICK" | "SIL";
  entryType: "GRANT" | "RESET" | "USAGE" | "ENCASHMENT" | "ADJUSTMENT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  effectiveDate: Date;
  cycleStartDate: Date;
  notes: string | null;
  leaveRequestId: string | null;
  resetRunId: string | null;
  createdAt: Date;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
  };
}): EmployeeLeaveCreditLedgerRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  leaveType: row.leaveType,
  entryType: row.entryType,
  amount: row.amount,
  balanceBefore: row.balanceBefore,
  balanceAfter: row.balanceAfter,
  effectiveDate: row.effectiveDate.toISOString(),
  cycleStartDate: row.cycleStartDate.toISOString(),
  notes: row.notes,
  leaveRequestId: row.leaveRequestId,
  resetRunId: row.resetRunId,
  createdAt: row.createdAt.toISOString(),
});

export const serializeScheduleSwapRequest = (
  row: ScheduleSwapRequestRecord,
  viewerEmployeeId?: string | null,
): ScheduleSwapRequestRow => ({
  id: row.id,
  requesterEmployeeId: row.requesterEmployeeId,
  requesterEmployeeCode: row.requesterEmployee.employeeCode,
  requesterEmployeeName: toEmployeeName(row.requesterEmployee),
  coworkerEmployeeId: row.coworkerEmployeeId,
  coworkerEmployeeCode: row.coworkerEmployee.employeeCode,
  coworkerEmployeeName: toEmployeeName(row.coworkerEmployee),
  workDate: row.workDate.toISOString(),
  requesterShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.requesterShiftCodeSnapshot,
    shiftName: row.requesterShiftNameSnapshot,
    startMinutes: row.requesterStartMinutesSnapshot,
    endMinutes: row.requesterEndMinutesSnapshot,
  }),
  coworkerShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.coworkerShiftCodeSnapshot,
    shiftName: row.coworkerShiftNameSnapshot,
    startMinutes: row.coworkerStartMinutesSnapshot,
    endMinutes: row.coworkerEndMinutesSnapshot,
  }),
  reason: row.reason ?? null,
  status: row.status,
  coworkerRemarks: row.coworkerRemarks ?? null,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  coworkerRespondedAt: toIsoString(row.coworkerRespondedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  isIncomingToViewer:
    Boolean(viewerEmployeeId) && row.coworkerEmployeeId === viewerEmployeeId,
  isOutgoingFromViewer:
    Boolean(viewerEmployeeId) && row.requesterEmployeeId === viewerEmployeeId,
});
