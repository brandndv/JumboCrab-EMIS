import {
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  LeaveRequestStatus,
  PayrollReviewDecision,
  PayrollStatus,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { fetchSession } from "@/actions/auth/session-action";
import { listAttendance } from "@/actions/attendance/attendance-action";
import { listEmployeeDeductionAssignments } from "@/actions/deductions/deductions-action";
import { getEmployees } from "@/actions/employees/employees-action";
import {
  listPayrollPayslips,
  listPayrollRuns,
} from "@/actions/payroll/payroll-action";
import {
  getEmployeeDayOffMonthlySummary,
  getEmployeeLeaveBalanceSummary,
  listCashAdvanceRequests,
  listDayOffRequests,
  listLeaveRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
  type LeaveRequestRow,
  type ScheduleChangeRequestRow,
  type ScheduleSwapRequestRow,
} from "@/actions/requests/requests-action";
import { getUsers } from "@/actions/users/users-action";
import { getViolations } from "@/actions/violations/violations-action";
import {
  formatDate as formatDeductionDate,
  describeAssignmentValue,
  runtimeStatusClass,
  runtimeStatusLabel,
  workflowStatusClass,
  workflowStatusLabel,
} from "@/features/manage-deductions/deduction-ui-helpers";
import {
  formatCurrency,
  formatDateRange,
  formatDateTime,
  humanizePayrollType,
  statusClass,
} from "@/features/manage-payroll/payroll-ui-helpers";
import {
  formatDate as formatRequestDate,
  formatDateRange as formatRequestDateRange,
  formatMoney,
  leaveTypeLabel,
  requestStatusClass,
  requestStatusLabel,
  requestTypeLabel,
} from "@/features/manage-requests/request-ui-helpers";
import { db } from "@/lib/db";
import { normalizeRole, type AppRole } from "@/lib/rbac";
import { TZ, formatZonedTime } from "@/lib/timezone";

type DashboardTone = "primary" | "info" | "success" | "warning" | "danger";

export type DashboardIconKey =
  | "activity"
  | "alert"
  | "banknote"
  | "briefcase"
  | "building"
  | "calendar"
  | "clock"
  | "coins"
  | "file"
  | "receipt"
  | "scan"
  | "shield"
  | "sparkles"
  | "users";

export type DashboardStat = {
  label: string;
  value: string;
  description: string;
  icon: DashboardIconKey;
  tone: DashboardTone;
};

export type DashboardAction = {
  title: string;
  description: string;
  href: string;
  icon: DashboardIconKey;
  badge?: string;
};

export type DashboardItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  icon: DashboardIconKey;
  href?: string;
  value?: string;
  statusLabel?: string;
  statusClassName?: string;
};

export type DashboardPanel = {
  title: string;
  description: string;
  emptyText: string;
  items: DashboardItem[];
  footerHref?: string;
  footerLabel?: string;
};

export type DashboardData = {
  role: AppRole;
  roleLabel: string;
  displayName: string;
  subtitle: string;
  summary: string;
  timestampLabel: string;
  stats: DashboardStat[];
  actions: DashboardAction[];
  notes: string[];
  primaryPanel: DashboardPanel;
  secondaryPanel: DashboardPanel;
};

type DashboardSession = {
  userId: string;
  username: string;
  email: string;
  role: AppRole;
  employee: {
    employeeId: string;
    firstName: string;
    lastName: string;
    position?: string | null;
    department?: string | null;
    dailyRate?: number | null;
  } | null;
};

type AttendanceActionRow = NonNullable<
  Awaited<ReturnType<typeof listAttendance>>["data"]
>[number];

type PayrollRunRow = NonNullable<
  Awaited<ReturnType<typeof listPayrollRuns>>["data"]
>[number];

type PayrollPayslipRow = NonNullable<
  Awaited<ReturnType<typeof listPayrollPayslips>>["data"]
>[number];

type DeductionAssignmentRow = NonNullable<
  Awaited<ReturnType<typeof listEmployeeDeductionAssignments>>["data"]
>[number];

type ViolationRow = NonNullable<Awaited<ReturnType<typeof getViolations>>["data"]>[number];

const toneBadgeClass = (tone: DashboardTone) => {
  switch (tone) {
    case "success":
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "warning":
      return "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "danger":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "info":
      return "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "border-primary/40 bg-primary/10 text-primary";
  }
};

const formatRoleLabel = (role: AppRole) => {
  switch (role) {
    case "generalManager":
      return "General Manager";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const shortNowLabel = () =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const todayKey = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: TZ,
  });

const monthStart = () => {
  const today = todayKey();
  return new Date(`${today.slice(0, 7)}-01T00:00:00+08:00`);
};

const buildDisplayName = (session: DashboardSession) => {
  const employee = session.employee;
  if (!employee) return session.username;
  return `${employee.firstName} ${employee.lastName}`.trim();
};

const buildSubtitle = (session: DashboardSession) => {
  const bits = [session.employee?.position, session.employee?.department].filter(
    Boolean,
  );
  return bits.length > 0 ? bits.join(" • ") : session.email;
};

const safeData = async <T>(
  promise: Promise<{ success: boolean; data?: T | null; error?: string | null }>,
  fallback: T,
) => {
  try {
    const result = await promise;
    if (!result.success) return fallback;
    return result.data ?? fallback;
  } catch {
    return fallback;
  }
};

const toCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const humanizeAttendanceStatus = (value?: string | null) => {
  if (!value) return "No record";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const employeeStatusLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const employeeStatusClass = (value: string) => {
  if (value === "ACTIVE") return toneBadgeClass("success");
  if (value === "ON_LEAVE" || value === "VACATION" || value === "SICK_LEAVE") {
    return toneBadgeClass("warning");
  }
  if (value === "ENDED") return toneBadgeClass("danger");
  return toneBadgeClass("info");
};

const violationStatusClass = (value: ViolationRow["status"]) => {
  if (value === "APPROVED") return toneBadgeClass("success");
  if (value === "REJECTED") return toneBadgeClass("danger");
  return toneBadgeClass("warning");
};

const isAttendanceFlagged = (row: AttendanceActionRow) =>
  row.status === "ABSENT" ||
  row.status === "INCOMPLETE" ||
  (row.lateMinutes ?? 0) > 0 ||
  (row.undertimeMinutes ?? 0) > 0;

const isOpenPayrollRun = (run: PayrollRunRow) =>
  run.status !== "RELEASED" && run.status !== "VOIDED";

const isGmApprovalRun = (run: PayrollRunRow) =>
  run.status !== "RELEASED" &&
  run.status !== "VOIDED" &&
  run.managerDecision === PayrollReviewDecision.APPROVED &&
  run.gmDecision === PayrollReviewDecision.PENDING;

const sortByNewest = <T>(rows: T[], getDate: (row: T) => string | null | undefined) =>
  [...rows].sort(
    (a, b) =>
      new Date(getDate(b) ?? 0).getTime() - new Date(getDate(a) ?? 0).getTime(),
  );

const buildPayrollItem = (
  role: AppRole,
  run: PayrollRunRow,
  href?: string,
): DashboardItem => ({
  id: run.payrollId,
  title: humanizePayrollType(run.payrollType),
  description: `${formatDateRange(run.payrollPeriodStart, run.payrollPeriodEnd)} • ${run.employeeCount} employee${run.employeeCount === 1 ? "" : "s"}`,
  meta:
    role === "generalManager"
      ? `Manager ${run.managerDecision.toLowerCase()} • GM ${run.gmDecision.toLowerCase()}`
      : `Generated ${formatDateTime(run.generatedAt)}`,
  icon: "receipt",
  href,
  value: formatCurrency(run.netTotal),
  statusLabel: run.status,
  statusClassName: statusClass(run.status),
});

const buildDeductionItem = (
  row: DeductionAssignmentRow,
  href: string,
): DashboardItem => ({
  id: row.id,
  title: row.deductionName,
  description: `${row.employeeName} • ${describeAssignmentValue(row)}`,
  meta: `${formatDeductionDate(row.effectiveFrom)} • ${runtimeStatusLabel(row.status)}`,
  icon: "coins",
  href,
  value:
    row.status === EmployeeDeductionAssignmentStatus.ACTIVE &&
    row.remainingBalance != null
      ? formatMoney(row.remainingBalance)
      : undefined,
  statusLabel: workflowStatusLabel(row.workflowStatus),
  statusClassName:
    row.workflowStatus === EmployeeDeductionWorkflowStatus.APPROVED
      ? runtimeStatusClass(row.status)
      : workflowStatusClass(row.workflowStatus),
});

const buildViolationItem = (
  row: ViolationRow,
  href: string,
): DashboardItem => ({
  id: row.id,
  title: row.employeeName,
  description: `${row.violationName} • ${formatRequestDate(row.violationDate)}`,
  meta: row.reviewRemarks?.trim() || `Filed ${formatRequestDate(row.createdAt)}`,
  icon: "shield",
  href,
  statusLabel: row.status,
  statusClassName: violationStatusClass(row.status),
});

const buildPayslipItem = (role: AppRole, row: PayrollPayslipRow): DashboardItem => ({
  id: row.payrollEmployeeId,
  title: formatDateRange(row.payrollPeriodStart, row.payrollPeriodEnd),
  description: `${humanizePayrollType(row.payrollType)} • ${row.employeeName}`,
  meta: row.releasedAt
    ? `Released ${formatDateTime(row.releasedAt)}`
    : `Generated ${formatDateTime(row.generatedAt)}`,
  icon: "banknote",
  href: role === "employee" ? "/employee/payslip" : `/${role}/payroll/payslips`,
  value: formatCurrency(row.netPay),
  statusLabel: row.payrollStatus,
  statusClassName: statusClass(row.payrollStatus),
});

const buildManagerRequestItems = (
  cashRows: CashAdvanceRequestRow[],
  leaveRows: LeaveRequestRow[],
  dayOffRows: DayOffRequestRow[],
  scheduleChangeRows: ScheduleChangeRequestRow[],
  scheduleSwapRows: ScheduleSwapRequestRow[],
) => {
  const items: Array<DashboardItem & { submittedAt: string }> = [];

  cashRows.forEach((row) => {
    items.push({
      id: row.id,
      title: `${requestTypeLabel("CASH_ADVANCE")} • ${row.employeeName}`,
      description: `${formatMoney(row.amount)} • starts ${formatRequestDate(row.preferredStartDate)}`,
      meta: `${row.employeeCode} • Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "banknote",
      href: "/manager/requests",
      value: formatMoney(row.amount),
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  leaveRows.forEach((row) => {
    items.push({
      id: row.id,
      title: `${leaveTypeLabel(row.leaveType)} • ${row.employeeName}`,
      description: `${formatRequestDateRange(row.startDate, row.endDate)} • ${row.totalDays} day${row.totalDays === 1 ? "" : "s"}`,
      meta: `${row.employeeCode} • Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "calendar",
      href: "/manager/requests",
      value: `${row.totalDays}d`,
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  dayOffRows.forEach((row) => {
    items.push({
      id: row.id,
      title: `${requestTypeLabel("DAY_OFF")} • ${row.employeeName}`,
      description: `${formatRequestDate(row.workDate)} • ${row.currentShiftLabel}`,
      meta: `${row.employeeCode} • Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "calendar",
      href: "/manager/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  scheduleChangeRows.forEach((row) => {
    items.push({
      id: row.id,
      title: `${requestTypeLabel("SCHEDULE_CHANGE")} • ${row.employeeName}`,
      description: `${formatRequestDate(row.workDate)} • ${row.requestedShiftLabel}`,
      meta: `${row.employeeCode} • Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "clock",
      href: "/manager/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  scheduleSwapRows.forEach((row) => {
    items.push({
      id: row.id,
      title: `${requestTypeLabel("SCHEDULE_SWAP")} • ${row.requesterEmployeeName}`,
      description: `${formatRequestDate(row.workDate)} • with ${row.coworkerEmployeeName}`,
      meta: `${row.requesterEmployeeCode} • Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "clock",
      href: "/manager/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  return sortByNewest(items, (item) => item.submittedAt).slice(0, 6);
};

const buildEmployeeRequestItems = (
  cashRows: CashAdvanceRequestRow[],
  leaveRows: LeaveRequestRow[],
  dayOffRows: DayOffRequestRow[],
  scheduleChangeRows: ScheduleChangeRequestRow[],
  scheduleSwapRows: ScheduleSwapRequestRow[],
) => {
  const items: Array<DashboardItem & { submittedAt: string }> = [];

  cashRows.forEach((row) => {
    items.push({
      id: row.id,
      title: requestTypeLabel("CASH_ADVANCE"),
      description: `${formatMoney(row.amount)} • starts ${formatRequestDate(row.preferredStartDate)}`,
      meta: `Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "banknote",
      href: "/employee/requests",
      value: formatMoney(row.amount),
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  leaveRows.forEach((row) => {
    items.push({
      id: row.id,
      title: leaveTypeLabel(row.leaveType),
      description: `${formatRequestDateRange(row.startDate, row.endDate)} • ${row.totalDays} day${row.totalDays === 1 ? "" : "s"}`,
      meta: `Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "calendar",
      href: "/employee/requests",
      value: `${row.totalDays}d`,
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  dayOffRows.forEach((row) => {
    items.push({
      id: row.id,
      title: requestTypeLabel("DAY_OFF"),
      description: `${formatRequestDate(row.workDate)} • ${row.currentShiftLabel}`,
      meta: `Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "calendar",
      href: "/employee/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  scheduleChangeRows.forEach((row) => {
    items.push({
      id: row.id,
      title: requestTypeLabel("SCHEDULE_CHANGE"),
      description: `${formatRequestDate(row.workDate)} • ${row.requestedShiftLabel}`,
      meta: `Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "clock",
      href: "/employee/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  scheduleSwapRows.forEach((row) => {
    items.push({
      id: row.id,
      title: requestTypeLabel("SCHEDULE_SWAP"),
      description: `${formatRequestDate(row.workDate)} • with ${row.coworkerEmployeeName}`,
      meta: `Submitted ${formatRequestDate(row.submittedAt)}`,
      icon: "clock",
      href: "/employee/requests",
      statusLabel: requestStatusLabel(row.status),
      statusClassName: requestStatusClass(row.status),
      submittedAt: row.submittedAt,
    });
  });

  return sortByNewest(items, (item) => item.submittedAt).slice(0, 6);
};

const buildSession = async (): Promise<DashboardSession | null> => {
  const result = await fetchSession();
  const rawSession = result.session;
  if (
    !result.success ||
    !rawSession?.isLoggedIn ||
    !("userId" in rawSession) ||
    !("username" in rawSession) ||
    !("email" in rawSession) ||
    !("role" in rawSession)
  ) {
    return null;
  }

  const normalizedRole = normalizeRole(rawSession.role);

  if (!normalizedRole) {
    return null;
  }

  return {
    userId: rawSession.userId ?? "",
    username: rawSession.username ?? "",
    email: rawSession.email ?? "",
    role: normalizedRole,
    employee: rawSession.employee
      ? {
          employeeId: rawSession.employee.employeeId,
          firstName: rawSession.employee.firstName,
          lastName: rawSession.employee.lastName,
          position:
            typeof rawSession.employee.position === "string"
              ? rawSession.employee.position
              : null,
          department:
            typeof rawSession.employee.department === "string"
              ? rawSession.employee.department
              : null,
          dailyRate:
            typeof rawSession.employee.dailyRate === "number"
              ? rawSession.employee.dailyRate
              : null,
        }
      : null,
  };
};

const buildAdminDashboard = async (session: DashboardSession): Promise<DashboardData> => {
  const today = todayKey();
  const [
    employees,
    users,
    attendanceRows,
    payrollRuns,
    departmentCount,
    payrollQueueCount,
    deductionDraftCount,
    violationDraftCount,
  ] = await Promise.all([
    safeData(getEmployees(), []),
    safeData(getUsers(), []),
    safeData(listAttendance({ start: today, end: today, includeAll: true }), []),
    safeData(listPayrollRuns({ limit: 5 }), []),
    db.department.count({ where: { isActive: true } }),
    db.payroll.count({
      where: { status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] } },
    }),
    db.employeeDeductionAssignment.count({
      where: { workflowStatus: EmployeeDeductionWorkflowStatus.DRAFT },
    }),
    db.employeeViolation.count({ where: { status: "DRAFT" } }),
  ]);

  const activeEmployees = employees.filter(
    (employee) => !employee.isArchived && employee.currentStatus !== "ENDED",
  );
  const linkedAccounts = activeEmployees.filter((employee) => !!employee.userId).length;
  const disabledUsers = users.filter((user) => user.isDisabled).length;
  const attendanceFlaggedCount = attendanceRows.filter(isAttendanceFlagged).length;

  return {
    role: "admin",
    roleLabel: formatRoleLabel("admin"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary:
      "Keep the full operation visible across workforce records, attendance, payroll, and access coverage.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Active Employees",
        value: toCompactNumber(activeEmployees.length),
        description: `${departmentCount} departments with live headcount`,
        icon: "users",
        tone: "primary",
      },
      {
        label: "User Accounts",
        value: toCompactNumber(users.length),
        description: `${disabledUsers} disabled account${disabledUsers === 1 ? "" : "s"}`,
        icon: "shield",
        tone: "info",
      },
      {
        label: "Attendance Flags",
        value: toCompactNumber(attendanceFlaggedCount),
        description: `${attendanceRows.length} attendance row${attendanceRows.length === 1 ? "" : "s"} logged today`,
        icon: "alert",
        tone: attendanceFlaggedCount > 0 ? "warning" : "success",
      },
      {
        label: "Open Review Work",
        value: toCompactNumber(
          payrollQueueCount + deductionDraftCount + violationDraftCount,
        ),
        description: `${payrollQueueCount} payroll • ${deductionDraftCount} deductions • ${violationDraftCount} violations`,
        icon: "receipt",
        tone: "warning",
      },
    ],
    actions: [
      {
        title: "Manage Users",
        description: "Create accounts and fix access coverage.",
        href: "/admin/users",
        icon: "shield",
        badge:
          activeEmployees.length - linkedAccounts > 0
            ? `${activeEmployees.length - linkedAccounts} missing`
            : undefined,
      },
      {
        title: "Payroll History",
        description: "Inspect current payroll run progress and release status.",
        href: "/admin/payroll/payroll-history",
        icon: "receipt",
        badge: payrollQueueCount > 0 ? `${payrollQueueCount} open` : undefined,
      },
      {
        title: "Check Attendance",
        description: "Review today's flagged attendance records.",
        href: "/admin/attendance",
        icon: "clock",
        badge:
          attendanceFlaggedCount > 0 ? `${attendanceFlaggedCount} flagged` : undefined,
      },
      {
        title: "Update Organization",
        description: "Adjust departments, positions, and structure.",
        href: "/admin/organization/structure",
        icon: "building",
      },
    ],
    notes: [
      `${activeEmployees.length - linkedAccounts} employee account${activeEmployees.length - linkedAccounts === 1 ? "" : "s"} still need login access.`,
      `${payrollQueueCount} payroll run${payrollQueueCount === 1 ? "" : "s"} remain unreleased.`,
      `${attendanceFlaggedCount} attendance record${attendanceFlaggedCount === 1 ? "" : "s"} are flagged today.`,
    ],
    primaryPanel: {
      title: "Payroll Pulse",
      description: "Latest payroll runs across the release pipeline.",
      emptyText: "No payroll runs are available yet.",
      items: payrollRuns.map((run) =>
        buildPayrollItem("admin", run, "/admin/payroll/payroll-history"),
      ),
      footerHref: "/admin/payroll/payroll-history",
      footerLabel: "Open payroll history",
    },
    secondaryPanel: {
      title: "Review Queues",
      description: "The company-wide items that currently need attention.",
      emptyText: "No review queues are active right now.",
      items: [
        {
          id: "admin-users",
          title: "Employees without linked accounts",
          description: "Create or link user records so staff can access the system.",
          meta: `${linkedAccounts}/${activeEmployees.length} active employees linked`,
          icon: "shield",
          href: "/admin/users",
          value: String(activeEmployees.length - linkedAccounts),
          statusLabel:
            activeEmployees.length - linkedAccounts > 0 ? "Needs setup" : "Covered",
          statusClassName: toneBadgeClass(
            activeEmployees.length - linkedAccounts > 0 ? "warning" : "success",
          ),
        },
        {
          id: "admin-deductions",
          title: "Deduction drafts waiting on review",
          description: "Manager review is still pending for drafted employee deductions.",
          meta: "Open the deduction review board to process queue items.",
          icon: "coins",
          href: "/admin/deductions/review",
          value: String(deductionDraftCount),
          statusLabel: deductionDraftCount > 0 ? "Open" : "Clear",
          statusClassName: toneBadgeClass(
            deductionDraftCount > 0 ? "warning" : "success",
          ),
        },
        {
          id: "admin-violations",
          title: "Violation drafts waiting for decision",
          description: "Drafted employee violations are ready for management review.",
          meta: "Use the violation board to approve or return them.",
          icon: "shield",
          href: "/admin/violations",
          value: String(violationDraftCount),
          statusLabel: violationDraftCount > 0 ? "Review" : "Clear",
          statusClassName: toneBadgeClass(
            violationDraftCount > 0 ? "warning" : "success",
          ),
        },
        {
          id: "admin-attendance",
          title: "Today's attendance exceptions",
          description: "Late, incomplete, absent, and undertime records from today's log.",
          meta: `${attendanceRows.length} total attendance row${attendanceRows.length === 1 ? "" : "s"} today`,
          icon: "clock",
          href: "/admin/attendance/history",
          value: String(attendanceFlaggedCount),
          statusLabel: attendanceFlaggedCount > 0 ? "Check now" : "Stable",
          statusClassName: toneBadgeClass(
            attendanceFlaggedCount > 0 ? "warning" : "success",
          ),
        },
      ],
    },
  };
};

const buildGeneralManagerDashboard = async (
  session: DashboardSession,
): Promise<DashboardData> => {
  const monthStartDate = monthStart();
  const [payrollRuns, assignments, activeEmployees, gmQueueCount, releasedThisMonth] =
    await Promise.all([
      safeData(listPayrollRuns({ limit: 5 }), []),
      safeData(
        listEmployeeDeductionAssignments({ directoryMode: true, limit: 5 }),
        [],
      ),
      db.employee.count({ where: { isArchived: false } }),
      db.payroll.count({
        where: {
          status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] },
          managerDecision: PayrollReviewDecision.APPROVED,
          gmDecision: PayrollReviewDecision.PENDING,
        },
      }),
      db.payroll.count({
        where: {
          status: PayrollStatus.RELEASED,
          releasedAt: { gte: monthStartDate },
        },
      }),
    ]);

  const [activeDeductionTypeCount, activeAssignmentCount, draftViolationCount, departmentCount] =
    await Promise.all([
      db.deductionType.count({ where: { isActive: true } }),
      db.employeeDeductionAssignment.count({
        where: {
          workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
          status: EmployeeDeductionAssignmentStatus.ACTIVE,
        },
      }),
      db.employeeViolation.count({ where: { status: "DRAFT" } }),
      db.department.count({ where: { isActive: true } }),
    ]);

  const spotlightRuns = payrollRuns
    .filter((run) => isGmApprovalRun(run))
    .concat(payrollRuns.filter((run) => !isGmApprovalRun(run)))
    .slice(0, 5);

  return {
    role: "generalManager",
    roleLabel: formatRoleLabel("generalManager"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary:
      "Stay on top of final payroll approval, policy coverage, and executive-level workforce signals.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Active Employees",
        value: toCompactNumber(activeEmployees),
        description: `${departmentCount} active departments`,
        icon: "users",
        tone: "primary",
      },
      {
        label: "Final Approvals",
        value: toCompactNumber(gmQueueCount),
        description: "Payroll runs waiting on your sign-off",
        icon: "receipt",
        tone: gmQueueCount > 0 ? "warning" : "success",
      },
      {
        label: "Released This Month",
        value: toCompactNumber(releasedThisMonth),
        description: "Payroll runs already released this month",
        icon: "banknote",
        tone: "info",
      },
      {
        label: "Active Deduction Types",
        value: toCompactNumber(activeDeductionTypeCount),
        description: `${activeAssignmentCount} live employee assignment${activeAssignmentCount === 1 ? "" : "s"}`,
        icon: "coins",
        tone: "success",
      },
    ],
    actions: [
      {
        title: "Final Payroll Review",
        description: "Approve manager-prepared payroll runs and release them.",
        href: "/generalManager/payroll/review-payroll",
        icon: "receipt",
        badge: gmQueueCount > 0 ? `${gmQueueCount} waiting` : undefined,
      },
      {
        title: "Deduction Types",
        description: "Maintain active deduction programs.",
        href: "/generalManager/deductions",
        icon: "coins",
        badge: `${activeDeductionTypeCount} active`,
      },
      {
        title: "Employee Directory",
        description: "Review workforce records and staffing changes.",
        href: "/generalManager/employees",
        icon: "users",
      },
      {
        title: "Violation Review",
        description: "Track policy cases pending review.",
        href: "/generalManager/violations",
        icon: "shield",
        badge: draftViolationCount > 0 ? `${draftViolationCount} drafts` : undefined,
      },
    ],
    notes: [
      `${gmQueueCount} payroll run${gmQueueCount === 1 ? "" : "s"} are ready for your approval or release.`,
      `${activeAssignmentCount} active employee deduction assignment${activeAssignmentCount === 1 ? "" : "s"} are currently live.`,
      `${draftViolationCount} violation draft${draftViolationCount === 1 ? "" : "s"} still need review.`,
    ],
    primaryPanel: {
      title: "Approval & Release Queue",
      description: "Recent payroll runs, prioritizing the ones that need your action.",
      emptyText: "No payroll runs are available for review.",
      items: spotlightRuns.map((run) =>
        buildPayrollItem(
          "generalManager",
          run,
          "/generalManager/payroll/review-payroll",
        ),
      ),
      footerHref: "/generalManager/payroll/payroll-history",
      footerLabel: "Open payroll history",
    },
    secondaryPanel: {
      title: "Deduction Coverage",
      description: "Recently updated employee deductions and current runtime states.",
      emptyText: "No employee deduction assignments are available yet.",
      items: assignments.map((row) =>
        buildDeductionItem(row, "/generalManager/deductions/employee"),
      ),
      footerHref: "/generalManager/deductions/employee",
      footerLabel: "Open employee deductions",
    },
  };
};

const buildManagerDashboard = async (
  session: DashboardSession,
): Promise<DashboardData> => {
  const today = todayKey();
  const [
    cashRows,
    leaveRows,
    dayOffRows,
    scheduleChangeRows,
    scheduleSwapRows,
    payrollRuns,
    attendanceRows,
    activeEmployeeCount,
    deductionDraftCount,
    draftViolationCount,
  ] = await Promise.all([
    safeData(
      listCashAdvanceRequests({
        statuses: [CashAdvanceRequestStatus.PENDING_MANAGER],
        limit: 8,
      }),
      [],
    ),
    safeData(
      listLeaveRequests({
        statuses: [LeaveRequestStatus.PENDING_MANAGER],
        limit: 8,
      }),
      [],
    ),
    safeData(
      listDayOffRequests({
        statuses: [DayOffRequestStatus.PENDING_MANAGER],
        limit: 8,
      }),
      [],
    ),
    safeData(
      listScheduleChangeRequests({
        statuses: [ScheduleChangeRequestStatus.PENDING_MANAGER],
        limit: 8,
      }),
      [],
    ),
    safeData(
      listScheduleSwapRequests({
        statuses: [ScheduleSwapRequestStatus.PENDING_MANAGER],
        limit: 8,
      }),
      [],
    ),
    safeData(listPayrollRuns({ limit: 6 }), []),
    safeData(listAttendance({ start: today, end: today, includeAll: true }), []),
    db.employee.count({ where: { isArchived: false } }),
    db.employeeDeductionAssignment.count({
      where: { workflowStatus: EmployeeDeductionWorkflowStatus.DRAFT },
    }),
    db.employeeViolation.count({ where: { status: "DRAFT" } }),
  ]);

  const pendingRequests =
    cashRows.length +
    leaveRows.length +
    dayOffRows.length +
    scheduleChangeRows.length +
    scheduleSwapRows.length;
  const payrollQueueCount = payrollRuns.filter(isOpenPayrollRun).length;
  const payrollReturnedCount = payrollRuns.filter(
    (run) =>
      run.managerDecision === PayrollReviewDecision.REJECTED ||
      run.gmDecision === PayrollReviewDecision.REJECTED,
  ).length;
  const gmApprovalCount = payrollRuns.filter(isGmApprovalRun).length;
  const attendanceFlaggedCount = attendanceRows.filter(isAttendanceFlagged).length;

  return {
    role: "manager",
    roleLabel: formatRoleLabel("manager"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary:
      "Focus on payroll preparation, requests, and operational issues that need a management decision today.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Pending Requests",
        value: toCompactNumber(pendingRequests),
        description: "Employee submissions waiting for manager action",
        icon: "file",
        tone: pendingRequests > 0 ? "warning" : "success",
      },
      {
        label: "Payroll In Motion",
        value: toCompactNumber(payrollQueueCount),
        description: "Prepared or returned payroll runs under your scope",
        icon: "receipt",
        tone: payrollQueueCount > 0 ? "warning" : "success",
      },
      {
        label: "Deduction Drafts",
        value: toCompactNumber(deductionDraftCount),
        description: "Employee deduction drafts pending review",
        icon: "coins",
        tone: deductionDraftCount > 0 ? "warning" : "success",
      },
      {
        label: "Attendance Exceptions",
        value: toCompactNumber(attendanceFlaggedCount),
        description: `${activeEmployeeCount} active employee${activeEmployeeCount === 1 ? "" : "s"} on record`,
        icon: "clock",
        tone: attendanceFlaggedCount > 0 ? "warning" : "info",
      },
    ],
    actions: [
      {
        title: "Requests Queue",
        description: "Review leave, day-off, swap, and cash advance requests.",
        href: "/manager/requests",
        icon: "file",
        badge: pendingRequests > 0 ? `${pendingRequests} waiting` : undefined,
      },
      {
        title: "Generate Payroll",
        description: "Prepare new payroll runs or regenerate returned periods.",
        href: "/manager/payroll/generate-payroll",
        icon: "receipt",
        badge:
          payrollReturnedCount > 0
            ? `${payrollReturnedCount} returned`
            : payrollQueueCount > 0
              ? `${payrollQueueCount} active`
              : undefined,
      },
      {
        title: "Contributions",
        description: "Maintain SSS, PhilHealth, Pag-IBIG, and tax contribution records.",
        href: "/manager/contributions",
        icon: "banknote",
      },
      {
        title: "Deductions Board",
        description: "Process deduction drafts and employee assignments.",
        href: "/manager/deductions",
        icon: "coins",
        badge:
          deductionDraftCount > 0 ? `${deductionDraftCount} drafts` : undefined,
      },
      {
        title: "Attendance Review",
        description: "Look into late, incomplete, and undertime records.",
        href: "/manager/attendance/history",
        icon: "clock",
        badge:
          attendanceFlaggedCount > 0
            ? `${attendanceFlaggedCount} flagged`
            : undefined,
      },
    ],
    notes: [
      `${draftViolationCount} violation draft${draftViolationCount === 1 ? "" : "s"} are still pending review.`,
      `${gmApprovalCount} payroll run${gmApprovalCount === 1 ? "" : "s"} are waiting on General Manager approval or release.`,
      `${attendanceFlaggedCount} attendance record${attendanceFlaggedCount === 1 ? "" : "s"} need a second look today.`,
    ],
    primaryPanel: {
      title: "Requests Waiting for Action",
      description: "Newest employee requests that are already in the manager queue.",
      emptyText: "No employee requests are waiting on manager action.",
      items: buildManagerRequestItems(
        cashRows,
        leaveRows,
        dayOffRows,
        scheduleChangeRows,
        scheduleSwapRows,
      ),
      footerHref: "/manager/requests",
      footerLabel: "Open request board",
    },
    secondaryPanel: {
      title: "Payroll Activity",
      description: "Recent payroll runs prepared under your scope and their current status.",
      emptyText: "No payroll runs are active right now.",
      items: payrollRuns
        .filter((run) => isOpenPayrollRun(run))
        .slice(0, 6)
        .map((run) =>
          buildPayrollItem("manager", run, "/manager/payroll/payroll-history"),
        ),
      footerHref: "/manager/payroll/payroll-history",
      footerLabel: "Open payroll history",
    },
  };
};

const buildSupervisorDashboard = async (
  session: DashboardSession,
): Promise<DashboardData> => {
  const [violations, directReports] = await Promise.all([
    safeData(getViolations(), []),
    db.employee.findMany({
      where: {
        supervisorUserId: session.userId,
        isArchived: false,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 6,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        currentStatus: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    }),
  ]);

  const [directReportCount, teamOnLeaveCount] = await Promise.all([
    db.employee.count({
      where: { supervisorUserId: session.userId, isArchived: false },
    }),
    db.employee.count({
      where: {
        supervisorUserId: session.userId,
        isArchived: false,
        currentStatus: { in: ["ON_LEAVE", "VACATION", "SICK_LEAVE"] },
      },
    }),
  ]);

  const draftCount = violations.filter((row) => row.status === "DRAFT").length;
  const approvedCount = violations.filter((row) => row.status === "APPROVED").length;
  const rejectedCount = violations.filter((row) => row.status === "REJECTED").length;

  return {
    role: "supervisor",
    roleLabel: formatRoleLabel("supervisor"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary:
      "Track your direct reports and keep the violation pipeline moving before it reaches management review.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Direct Reports",
        value: toCompactNumber(directReportCount),
        description: `${teamOnLeaveCount} team member${teamOnLeaveCount === 1 ? "" : "s"} currently out`,
        icon: "users",
        tone: "primary",
      },
      {
        label: "Open Drafts",
        value: toCompactNumber(draftCount),
        description: "Violation drafts still in progress",
        icon: "shield",
        tone: draftCount > 0 ? "warning" : "success",
      },
      {
        label: "Approved",
        value: toCompactNumber(approvedCount),
        description: "Violation drafts already approved",
        icon: "sparkles",
        tone: "success",
      },
      {
        label: "Returned",
        value: toCompactNumber(rejectedCount),
        description: "Drafts that came back with remarks",
        icon: "alert",
        tone: rejectedCount > 0 ? "warning" : "info",
      },
    ],
    actions: [
      {
        title: "Draft Violation",
        description: "Create a new employee violation draft.",
        href: "/supervisor/violations/add",
        icon: "shield",
      },
      {
        title: "My Violation Board",
        description: "Track draft, approved, and returned cases.",
        href: "/supervisor/violations",
        icon: "file",
        badge: draftCount > 0 ? `${draftCount} open` : undefined,
      },
    ],
    notes: [
      `${directReportCount} direct report${directReportCount === 1 ? "" : "s"} are currently assigned to you.`,
      `${draftCount} violation draft${draftCount === 1 ? "" : "s"} are still open.`,
      `${rejectedCount} draft${rejectedCount === 1 ? "" : "s"} were returned with manager remarks.`,
    ],
    primaryPanel: {
      title: "My Violation Drafts",
      description: "Your most recent violation submissions and their review state.",
      emptyText: "You have not drafted any employee violations yet.",
      items: violations
        .slice(0, 6)
        .map((row) => buildViolationItem(row, "/supervisor/violations")),
      footerHref: "/supervisor/violations",
      footerLabel: "Open violation board",
    },
    secondaryPanel: {
      title: "Direct Report Snapshot",
      description: "A quick look at the employees currently assigned to your supervision.",
      emptyText: "No direct reports are assigned to you yet.",
      items: directReports.map((employee) => ({
        id: employee.employeeId,
        title: `${employee.firstName} ${employee.lastName}`.trim(),
        description: `${employee.employeeCode} • ${employee.position?.name ?? "Team member"}`,
        meta: employee.department?.name ?? "No department assigned",
        icon: "users",
        statusLabel: employeeStatusLabel(employee.currentStatus),
        statusClassName: employeeStatusClass(employee.currentStatus),
      })),
    },
  };
};

const buildEmployeeDashboard = async (
  session: DashboardSession,
): Promise<DashboardData> => {
  const today = todayKey();
  const employeeId = session.employee?.employeeId ?? null;

  const [
    attendanceRows,
    cashRows,
    leaveRows,
    dayOffRows,
    scheduleChangeRows,
    scheduleSwapRows,
    deductionRows,
    payslipRows,
    leaveBalance,
    dayOffSummary,
    violations,
  ] = await Promise.all([
    employeeId
      ? safeData(
          listAttendance({
            start: today,
            end: today,
            employeeId,
            includeAll: true,
          }),
          [],
        )
      : Promise.resolve([]),
    safeData(listCashAdvanceRequests({ limit: 8 }), []),
    safeData(listLeaveRequests({ limit: 8 }), []),
    safeData(listDayOffRequests({ limit: 8 }), []),
    safeData(listScheduleChangeRequests({ limit: 8 }), []),
    safeData(listScheduleSwapRequests({ limit: 8 }), []),
    safeData(listEmployeeDeductionAssignments({ limit: 8 }), []),
    safeData(listPayrollPayslips(), []),
    safeData(getEmployeeLeaveBalanceSummary(), {
      year: new Date().getFullYear(),
      paidLeaveAllowance: 0,
      paidLeaveUsed: 0,
      paidLeaveRemaining: 0,
      paidSickLeaveAllowance: 0,
      paidSickLeaveUsed: 0,
      paidSickLeaveRemaining: 0,
    }),
    safeData(getEmployeeDayOffMonthlySummary(), {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      monthLabel: "",
      approvedThisMonth: 0,
    }),
    safeData(getViolations(), []),
  ]);

  const todayAttendance = attendanceRows[0] ?? null;
  const pendingRequests = [
    ...cashRows.filter((row) => row.status === "PENDING_MANAGER"),
    ...leaveRows.filter((row) => row.status === "PENDING_MANAGER"),
    ...dayOffRows.filter((row) => row.status === "PENDING_MANAGER"),
    ...scheduleChangeRows.filter((row) => row.status === "PENDING_MANAGER"),
    ...scheduleSwapRows.filter(
      (row) =>
        row.status === "PENDING_MANAGER" || row.status === "PENDING_COWORKER",
    ),
  ].length;
  const activeDeductions = deductionRows.filter((row) => row.status === "ACTIVE").length;
  const latestPayslip = payslipRows[0] ?? null;
  const unacknowledgedViolations = violations.filter(
    (row) => !row.isAcknowledged,
  ).length;

  const lastPunch =
    todayAttendance?.actualOutAt ??
    todayAttendance?.actualInAt ??
    todayAttendance?.breakEndAt ??
    todayAttendance?.breakStartAt ??
    null;
  const attendanceDescription = todayAttendance
    ? [
        todayAttendance.expectedShiftName || "Shift assigned",
        lastPunch ? `Last punch ${formatZonedTime(lastPunch, { second: undefined })}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : "No attendance snapshot has been created for today yet.";

  return {
    role: "employee",
    roleLabel: formatRoleLabel("employee"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary:
      "Stay on top of your shift status, requests, deductions, and the latest released payslips.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Today's Attendance",
        value: humanizeAttendanceStatus(todayAttendance?.status),
        description: attendanceDescription,
        icon: "clock",
        tone:
          todayAttendance?.status === "PRESENT"
            ? "success"
            : todayAttendance?.status
                ? "warning"
                : "info",
      },
      {
        label: "Pending Requests",
        value: toCompactNumber(pendingRequests),
        description: "Requests still moving through approval",
        icon: "file",
        tone: pendingRequests > 0 ? "warning" : "success",
      },
      {
        label: "Paid Leave Remaining",
        value: String(leaveBalance.paidLeaveRemaining),
        description: `Sick leave remaining: ${leaveBalance.paidSickLeaveRemaining}`,
        icon: "calendar",
        tone: "info",
      },
      {
        label: "Latest Net Pay",
        value: latestPayslip ? formatCurrency(latestPayslip.netPay) : "—",
        description: latestPayslip
          ? formatDateRange(
              latestPayslip.payrollPeriodStart,
              latestPayslip.payrollPeriodEnd,
            )
          : "No released payslip available yet",
        icon: "banknote",
        tone: latestPayslip ? "success" : "info",
      },
    ],
    actions: [
      {
        title: "Scan Time",
        description: "Open the QR scanner or kiosk tools for today's shift.",
        href: "/employee/scan",
        icon: "scan",
      },
      {
        title: "Requests",
        description: "Submit and monitor your employee requests.",
        href: "/employee/requests",
        icon: "file",
        badge: pendingRequests > 0 ? `${pendingRequests} pending` : undefined,
      },
      {
        title: "My Attendance",
        description: "Check today's status and attendance history.",
        href: "/employee/attendance",
        icon: "clock",
        badge: todayAttendance ? humanizeAttendanceStatus(todayAttendance.status) : undefined,
      },
      {
        title: "My Payslips",
        description: "Review released payroll runs and net pay details.",
        href: "/employee/payslip",
        icon: "receipt",
        badge: payslipRows.length > 0 ? `${payslipRows.length} released` : undefined,
      },
    ],
    notes: [
      `${dayOffSummary.approvedThisMonth} approved day-off request${dayOffSummary.approvedThisMonth === 1 ? "" : "s"} this month.`,
      `${activeDeductions} approved deduction assignment${activeDeductions === 1 ? "" : "s"} are active on your record.`,
      unacknowledgedViolations > 0
        ? `${unacknowledgedViolations} violation${unacknowledgedViolations === 1 ? "" : "s"} still need your acknowledgement.`
        : "No unacknowledged violations are waiting on you right now.",
    ],
    primaryPanel: {
      title: "Request Activity",
      description: "Your latest request submissions and current approval states.",
      emptyText: "You have not submitted any requests yet.",
      items: buildEmployeeRequestItems(
        cashRows,
        leaveRows,
        dayOffRows,
        scheduleChangeRows,
        scheduleSwapRows,
      ),
      footerHref: "/employee/requests",
      footerLabel: "Open request history",
    },
    secondaryPanel: {
      title: "Latest Payslips",
      description: "Released payroll runs and the net pay already available to you.",
      emptyText: "No released payslips are available yet.",
      items: payslipRows
        .slice(0, 6)
        .map((row) => buildPayslipItem("employee", row)),
      footerHref: "/employee/payslip",
      footerLabel: "Open payslips",
    },
  };
};

export async function loadRoleDashboardData(
  role: AppRole,
): Promise<DashboardData | null> {
  const session = await buildSession();
  if (!session) return null;

  switch (role) {
    case "admin":
      return buildAdminDashboard(session);
    case "generalManager":
      return buildGeneralManagerDashboard(session);
    case "manager":
      return buildManagerDashboard(session);
    case "supervisor":
      return buildSupervisorDashboard(session);
    case "employee":
      return buildEmployeeDashboard(session);
    default:
      return null;
  }
}
