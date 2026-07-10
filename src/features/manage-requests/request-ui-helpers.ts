import {
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  EmployeeDeductionAssignmentStatus,
  GovernmentLoanAgency,
  GovernmentLoanAssistanceRequestStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { TZ } from "@/lib/timezone";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

export const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const requestStatusLabel = (
  status:
    | CashAdvanceRequestStatus
    | DayOffRequestStatus
    | GovernmentLoanAssistanceRequestStatus
    | LeaveRequestStatus
    | ScheduleChangeRequestStatus
    | ScheduleSwapRequestStatus,
) => {
  switch (status) {
    case ScheduleSwapRequestStatus.PENDING_COWORKER:
      return "Pending coworker";
    case GovernmentLoanAssistanceRequestStatus.PENDING_MANAGER_REVIEW:
      return "Pending manager review";
    case GovernmentLoanAssistanceRequestStatus.PROCESSING:
      return "Processing";
    case GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY:
      return "Approved by agency";
    case GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY:
      return "Declined by agency";
    case GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL:
      return "Recorded in payroll";
    case GovernmentLoanAssistanceRequestStatus.CANCELLED:
      return "Cancelled";
    case CashAdvanceRequestStatus.PENDING_MANAGER:
    case DayOffRequestStatus.PENDING_MANAGER:
    case LeaveRequestStatus.PENDING_MANAGER:
    case ScheduleChangeRequestStatus.PENDING_MANAGER:
    case ScheduleSwapRequestStatus.PENDING_MANAGER:
      return "Pending manager";
    case CashAdvanceRequestStatus.APPROVED:
    case DayOffRequestStatus.APPROVED:
    case LeaveRequestStatus.APPROVED:
    case ScheduleChangeRequestStatus.APPROVED:
    case ScheduleSwapRequestStatus.APPROVED:
      return "Approved";
    case CashAdvanceRequestStatus.REJECTED:
    case DayOffRequestStatus.REJECTED:
    case LeaveRequestStatus.REJECTED:
    case ScheduleChangeRequestStatus.REJECTED:
    case ScheduleSwapRequestStatus.REJECTED:
      return "Rejected";
    case ScheduleSwapRequestStatus.DECLINED:
      return "Declined";
    case CashAdvanceRequestStatus.CANCELLED:
    case DayOffRequestStatus.CANCELLED:
    case LeaveRequestStatus.CANCELLED:
    case ScheduleChangeRequestStatus.CANCELLED:
    case ScheduleSwapRequestStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
};

export const requestStatusClass = (
  status:
    | CashAdvanceRequestStatus
    | DayOffRequestStatus
    | GovernmentLoanAssistanceRequestStatus
    | LeaveRequestStatus
    | ScheduleChangeRequestStatus
    | ScheduleSwapRequestStatus,
) => {
  switch (status) {
    case CashAdvanceRequestStatus.APPROVED:
    case DayOffRequestStatus.APPROVED:
    case LeaveRequestStatus.APPROVED:
    case ScheduleChangeRequestStatus.APPROVED:
    case GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY:
    case GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL:
      return "border-emerald-600 text-emerald-700";
    case ScheduleSwapRequestStatus.PENDING_COWORKER:
    case GovernmentLoanAssistanceRequestStatus.PROCESSING:
      return "border-sky-600 text-sky-700";
    case CashAdvanceRequestStatus.REJECTED:
    case DayOffRequestStatus.REJECTED:
    case LeaveRequestStatus.REJECTED:
    case ScheduleChangeRequestStatus.REJECTED:
    case ScheduleSwapRequestStatus.REJECTED:
    case ScheduleSwapRequestStatus.DECLINED:
    case GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY:
      return "border-destructive text-destructive";
    case CashAdvanceRequestStatus.CANCELLED:
    case DayOffRequestStatus.CANCELLED:
    case LeaveRequestStatus.CANCELLED:
    case ScheduleChangeRequestStatus.CANCELLED:
    case ScheduleSwapRequestStatus.CANCELLED:
    case GovernmentLoanAssistanceRequestStatus.CANCELLED:
      return "border-slate-500 text-slate-600";
    case CashAdvanceRequestStatus.PENDING_MANAGER:
    case DayOffRequestStatus.PENDING_MANAGER:
    case LeaveRequestStatus.PENDING_MANAGER:
    case ScheduleChangeRequestStatus.PENDING_MANAGER:
    case ScheduleSwapRequestStatus.PENDING_MANAGER:
    case GovernmentLoanAssistanceRequestStatus.PENDING_MANAGER_REVIEW:
    default:
      return "border-orange-600 text-orange-700";
  }
};

export const requestTypeLabel = (
  type:
    | "CASH_ADVANCE"
    | "GOVERNMENT_LOAN"
    | "SIL_ENCASHMENT"
    | "LEAVE"
    | "DAY_OFF"
    | "SCHEDULE_CHANGE"
    | "SCHEDULE_SWAP",
) => {
  switch (type) {
    case "LEAVE":
      return "Leave";
    case "DAY_OFF":
      return "Change Day Off";
    case "SCHEDULE_CHANGE":
      return "Change Shift";
    case "SCHEDULE_SWAP":
      return "Schedule Swap";
    case "GOVERNMENT_LOAN":
      return "Government Loan Assistance";
    case "SIL_ENCASHMENT":
      return "SIL Encashment";
    case "CASH_ADVANCE":
    default:
      return "Cash Advance";
  }
};

export const governmentLoanAgencyLabel = (agency: GovernmentLoanAgency) => {
  switch (agency) {
    case GovernmentLoanAgency.SSS_SALARY_LOAN:
      return "SSS Salary Loan";
    case GovernmentLoanAgency.PAGIBIG_MPL:
      return "Pag-IBIG Multi-Purpose Loan";
    default:
      return agency;
  }
};

export const leaveTypeLabel = (type: LeaveRequestType) => {
  switch (type) {
    case "SICK":
      return "Sick leave";
    case "SIL":
      return "Service Incentive Leave";
    case "UNPAID":
      return "Unpaid leave";
    default:
      return type;
  }
};

export const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "Not set";
  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  return formatDate(start ?? end);
};

export const countDaysInclusive = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

export const enumerateDateKeysInRange = (
  start?: string | null,
  end?: string | null,
) => {
  if (!start || !end) return [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const keys: string[] = [];
  const cursor = new Date(startDate);
  cursor.setUTCHours(12, 0, 0, 0);
  const finalDate = new Date(endDate);
  finalDate.setUTCHours(12, 0, 0, 0);

  while (cursor.getTime() <= finalDate.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

export const formatDateKey = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const linkedDeductionStatusLabel = (
  status?: EmployeeDeductionAssignmentStatus | null,
) => {
  if (!status) return "Not created";
  switch (status) {
    case EmployeeDeductionAssignmentStatus.ACTIVE:
      return "Active";
    case EmployeeDeductionAssignmentStatus.PAUSED:
      return "Paused";
    case EmployeeDeductionAssignmentStatus.COMPLETED:
      return "Completed";
    case EmployeeDeductionAssignmentStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
};
