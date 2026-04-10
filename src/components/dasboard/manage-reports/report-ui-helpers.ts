export type RolePath = "manager" | "generalManager";

export type ReportType =
  | "attendance"
  | "accounts"
  | "employee-information"
  | "contributions"
  | "deductions"
  | "violations"
  | "payroll";

export type ReportFilterDraft = {
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  employeeId: string;
  payrollType: string;
  attendanceStatus: string;
  accountRole: string;
  employmentStatus: string;
  currentStatus: string;
  deductionFrequency: string;
  deductionWorkflowStatus: string;
  deductionRuntimeStatus: string;
  violationStatus: string;
  payrollHasDeductions: string;
  search: string;
};

export const EMPTY_REPORT_FILTERS: ReportFilterDraft = {
  dateFrom: "",
  dateTo: "",
  departmentId: "",
  employeeId: "",
  payrollType: "",
  attendanceStatus: "",
  accountRole: "",
  employmentStatus: "",
  currentStatus: "",
  deductionFrequency: "",
  deductionWorkflowStatus: "",
  deductionRuntimeStatus: "",
  violationStatus: "",
  payrollHasDeductions: "",
  search: "",
};

export const REPORT_PAYROLL_TYPE_OPTIONS = [
  { value: "BIMONTHLY", label: "Bi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "OFF_CYCLE", label: "Off-cycle" },
] as const;

export const REPORT_ATTENDANCE_STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "Leave" },
  { value: "LATE", label: "Late" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "OVERTIME", label: "Overtime" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "REST", label: "Rest" },
] as const;

export const REPORT_ROLE_OPTIONS = [
  { value: "Admin", label: "Admin" },
  { value: "GeneralManager", label: "General Manager" },
  { value: "Manager", label: "Manager" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Clerk", label: "Clerk" },
  { value: "Employee", label: "Employee" },
] as const;

export const REPORT_EMPLOYMENT_STATUS_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "PROBATIONARY", label: "Probationary" },
  { value: "TRAINING", label: "Training" },
] as const;

export const REPORT_CURRENT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "VACATION", label: "Vacation" },
  { value: "SICK_LEAVE", label: "Sick Leave" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ENDED", label: "Ended" },
] as const;

export const REPORT_DEDUCTION_FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "PER_PAYROLL", label: "Per payroll" },
  { value: "INSTALLMENT", label: "Installment" },
] as const;

export const REPORT_DEDUCTION_WORKFLOW_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export const REPORT_DEDUCTION_RUNTIME_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const REPORT_VIOLATION_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export const REPORT_HAS_DEDUCTIONS_OPTIONS = [
  { value: "yes", label: "Has deductions" },
  { value: "no", label: "No deductions" },
] as const;

export const REPORT_DEFINITIONS: Record<
  ReportType,
  {
    title: string;
    description: string;
    path: string;
    blurb: string;
  }
> = {
  attendance: {
    title: "Attendance",
    description: "Track attendance activity, work hours, and posting status across employees.",
    path: "/attendance",
    blurb: "Present, absent, late, leave, overtime, and payroll-link status.",
  },
  accounts: {
    title: "Accounts",
    description: "Audit system user accounts, linked employees, and account availability.",
    path: "/accounts",
    blurb: "User inventory, roles, disabled accounts, and linked employee profiles.",
  },
  "employee-information": {
    title: "Employee Information",
    description: "Review the employee masterlist, role assignments, employment status, and work contact details.",
    path: "/employee-information",
    blurb: "Employee directory export with department, position, status, and contact data.",
  },
  contributions: {
    title: "Contributions",
    description: "Review computed statutory contribution previews across employees using position-owned rates and official bracket tables.",
    path: "/contributions",
    blurb: "Current bracket-based employee shares, government-ID readiness, and previewed withholding values.",
  },
  deductions: {
    title: "Deductions",
    description: "Review employee deduction assignments, active repayment status, and open installment balances.",
    path: "/deductions",
    blurb: "Assignment workflow, runtime status, installment balances, and completion tracking.",
  },
  violations: {
    title: "Violations",
    description: "Review employee violation records, review outcomes, and active strike totals.",
    path: "/violations",
    blurb: "Violation history, status, counted strikes, and acknowledgements.",
  },
  payroll: {
    title: "Payroll",
    description: "Review released payroll results, employee payouts, and deduction totals.",
    path: "/payroll",
    blurb: "Released payroll periods, employee pay, and payout totals.",
  },
};

export const formatReportDate = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
};

export const formatReportDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

export const formatMinutes = (minutes?: number | null) => {
  const safe = Number.isFinite(minutes ?? NaN) ? Math.max(0, minutes ?? 0) : 0;
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
};

export const formatHoursFromMinutes = (minutes?: number | null) => {
  const safe = Number.isFinite(minutes ?? NaN) ? Math.max(0, minutes ?? 0) : 0;
  return `${(safe / 60).toFixed(2)} hrs`;
};

export const formatRoleLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export const formatAttendanceStatusLabel = (value: string) =>
  value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

export const formatPayrollTypeLabel = (value: string) => {
  switch (value) {
    case "BIMONTHLY":
      return "Bi-monthly";
    case "MONTHLY":
      return "Monthly";
    case "WEEKLY":
      return "Weekly";
    case "OFF_CYCLE":
      return "Off-cycle";
    default:
      return formatRoleLabel(value);
  }
};

export const formatDeductionFrequencyLabel = (value: string) => {
  switch (value) {
    case "ONE_TIME":
      return "One-time";
    case "PER_PAYROLL":
      return "Per payroll";
    case "INSTALLMENT":
      return "Installment";
    default:
      return formatRoleLabel(value);
  }
};

export const formatWorkflowStatusLabel = (value: string) =>
  formatRoleLabel(value);

export const formatRuntimeStatusLabel = (value: string) =>
  formatRoleLabel(value);

export const buildRoleReportHref = (rolePath: RolePath, reportType: ReportType) =>
  `/${rolePath}/reports${REPORT_DEFINITIONS[reportType].path}`;
