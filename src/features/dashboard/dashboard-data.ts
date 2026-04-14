import {
  ATTENDANCE_STATUS,
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  PayrollReviewDecision,
  PayrollStatus,
  Prisma,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import {
  employeeDeductionAssignmentInclude,
  serializeDeductionAssignment,
} from "@/actions/deductions/deductions-shared";
import type { DeductionAssignmentRow } from "@/actions/deductions/types";
import {
  formatEmployeeName,
  serializePayrollRunSummary,
} from "@/actions/payroll/payroll-shared";
import type { PayrollPayslipSummary, PayrollRunSummary } from "@/types/payroll";
import {
  PAID_LEAVE_ALLOWANCE_PER_YEAR,
  PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR,
  employeeRequestSelect,
  reviewedBySelect,
} from "@/actions/requests/requests-core-shared";
import {
  serializeCashAdvanceRequest,
  serializeDayOffRequest,
  serializeLeaveRequest,
  serializeScheduleChangeRequest,
  serializeScheduleSwapRequest,
} from "@/actions/requests/requests-serializers-shared";
import type {
  CashAdvanceRequestRow,
  DayOffRequestRow,
  LeaveRequestRow,
  ScheduleChangeRequestRow,
  ScheduleSwapRequestRow,
} from "@/actions/requests/types";
import { employeeViolationInclude } from "@/actions/violations/violations-core-shared";
import { serializeViolation } from "@/actions/violations/violations-serializers-shared";
import type { ViolationRow } from "@/actions/violations/types";
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
import { getCurrentPlainSession } from "@/lib/current-session";
import { db } from "@/lib/db";
import { toIsoString, toNumber } from "@/lib/payroll/helpers";
import { normalizeRole, type AppRole } from "@/lib/rbac";
import { TZ, endOfZonedDay, formatZonedTime, startOfZonedDay } from "@/lib/timezone";

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

export type DashboardChartPoint = {
  label: string;
  recorded: number;
  flagged: number;
};

export type DashboardChart = {
  title: string;
  description: string;
  data: DashboardChartPoint[];
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
  chart?: DashboardChart;
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

type AttendanceSnapshot = {
  id: string;
  employeeId: string;
  status: ATTENDANCE_STATUS;
  lateMinutes: number;
  undertimeMinutes: number;
  actualInAt: string | null;
  actualOutAt: string | null;
  breakStartAt: string | null;
  breakEndAt: string | null;
  expectedShiftName: string | null;
  lastPunchAt: string | null;
};

const payrollRunDashboardInclude = {
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
} satisfies Prisma.PayrollInclude;

const cashAdvanceDashboardInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
  deductionAssignment: {
    select: {
      id: true,
      status: true,
      effectiveFrom: true,
      remainingBalance: true,
    },
  },
} satisfies Prisma.CashAdvanceRequestInclude;

const leaveRequestDashboardInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
  attendances: {
    select: {
      workDate: true,
      isPaidLeave: true,
    },
  },
} satisfies Prisma.LeaveRequestInclude;

const dayOffRequestDashboardInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
} satisfies Prisma.DayOffRequestInclude;

const scheduleChangeDashboardInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
} satisfies Prisma.ScheduleChangeRequestInclude;

const scheduleSwapDashboardInclude = {
  requesterEmployee: { select: employeeRequestSelect },
  coworkerEmployee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
} satisfies Prisma.ScheduleSwapRequestInclude;

type DashboardPayrollRunRecord = Prisma.PayrollGetPayload<{
  include: typeof payrollRunDashboardInclude;
}>;

type DashboardCashAdvanceRecord = Prisma.CashAdvanceRequestGetPayload<{
  include: typeof cashAdvanceDashboardInclude;
}>;

type DashboardLeaveRequestRecord = Prisma.LeaveRequestGetPayload<{
  include: typeof leaveRequestDashboardInclude;
}>;

type DashboardDayOffRequestRecord = Prisma.DayOffRequestGetPayload<{
  include: typeof dayOffRequestDashboardInclude;
}>;

type DashboardScheduleChangeRecord = Prisma.ScheduleChangeRequestGetPayload<{
  include: typeof scheduleChangeDashboardInclude;
}>;

type DashboardScheduleSwapRecord = Prisma.ScheduleSwapRequestGetPayload<{
  include: typeof scheduleSwapDashboardInclude;
}>;

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

const isOpenPayrollRun = (run: PayrollRunSummary) =>
  run.status !== "RELEASED" && run.status !== "VOIDED";

const isGmApprovalRun = (run: PayrollRunSummary) =>
  run.status !== "RELEASED" &&
  run.status !== "VOIDED" &&
  run.managerDecision === PayrollReviewDecision.APPROVED &&
  run.gmDecision === PayrollReviewDecision.PENDING;

const sortByNewest = <T>(rows: T[], getDate: (row: T) => string | null | undefined) =>
  [...rows].sort(
    (a, b) =>
      new Date(getDate(b) ?? 0).getTime() - new Date(getDate(a) ?? 0).getTime(),
  );

const getDayBounds = (dateKey = todayKey()) => {
  const start = startOfZonedDay(new Date(`${dateKey}T00:00:00+08:00`));
  return {
    start,
    end: endOfZonedDay(start),
  };
};

const buildAttendanceFlagWhere = (
  start: Date,
  end: Date,
): Prisma.AttendanceWhereInput => ({
  workDate: {
    gte: start,
    lt: end,
  },
  OR: [
    { status: ATTENDANCE_STATUS.ABSENT },
    { status: ATTENDANCE_STATUS.INCOMPLETE },
    { lateMinutes: { gt: 0 } },
    { undertimeMinutes: { gt: 0 } },
    { isFlagged: true },
  ],
});

const shiftDateKey = (dateKey: string, offsetDays: number) => {
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
};

const formatChartDayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ,
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));

const loadAttendanceTrend = async (days = 7): Promise<DashboardChartPoint[]> => {
  const currentDayKey = todayKey();
  const dateKeys = Array.from({ length: days }, (_, index) =>
    shiftDateKey(currentDayKey, index - (days - 1)),
  );

  return Promise.all(
    dateKeys.map(async (dateKey) => {
      const { start, end } = getDayBounds(dateKey);
      const [recorded, flagged] = await Promise.all([
        db.attendance.count({
          where: {
            workDate: {
              gte: start,
              lt: end,
            },
          },
        }),
        db.attendance.count({
          where: buildAttendanceFlagWhere(start, end),
        }),
      ]);

      return {
        label: formatChartDayLabel(dateKey),
        recorded,
        flagged,
      };
    }),
  );
};

const loadRecentPayrollRuns = async (input?: {
  limit?: number;
  where?: Prisma.PayrollWhereInput;
}): Promise<PayrollRunSummary[]> => {
  const rows = await db.payroll.findMany({
    where: input?.where,
    include: payrollRunDashboardInclude,
    orderBy: [{ payrollPeriodStart: "desc" }, { createdAt: "desc" }],
    take: input?.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializePayrollRunSummary(row as DashboardPayrollRunRecord),
  );
};

const loadRecentPayrollPayslips = async (input: {
  employeeId: string;
  limit?: number;
}): Promise<PayrollPayslipSummary[]> => {
  const rows = await db.payrollEmployee.findMany({
    where: {
      employeeId: input.employeeId,
      payroll: {
        status: PayrollStatus.RELEASED,
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
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) => ({
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
    employeeName: formatEmployeeName(row.employee),
    grossPay: toNumber(row.grossPay, 0),
    totalEarnings: toNumber(row.totalEarnings, 0),
    totalDeductions: toNumber(row.totalDeductions, 0),
    netPay: toNumber(row.netPay, 0),
    status: row.status,
  }));
};

const loadRecentDeductionAssignments = async (input: {
  limit?: number;
  where?: Prisma.EmployeeDeductionAssignmentWhereInput;
}): Promise<DeductionAssignmentRow[]> => {
  const rows = await db.employeeDeductionAssignment.findMany({
    where: input.where,
    include: employeeDeductionAssignmentInclude,
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map(serializeDeductionAssignment);
};

const loadCashAdvanceRequests = async (input: {
  where?: Prisma.CashAdvanceRequestWhereInput;
  limit?: number;
}): Promise<CashAdvanceRequestRow[]> => {
  const rows = await db.cashAdvanceRequest.findMany({
    where: input.where,
    include: cashAdvanceDashboardInclude,
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializeCashAdvanceRequest(row as DashboardCashAdvanceRecord),
  );
};

const loadLeaveRequests = async (input: {
  where?: Prisma.LeaveRequestWhereInput;
  limit?: number;
}): Promise<LeaveRequestRow[]> => {
  const rows = await db.leaveRequest.findMany({
    where: input.where,
    include: leaveRequestDashboardInclude,
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializeLeaveRequest(row as DashboardLeaveRequestRecord),
  );
};

const loadDayOffRequests = async (input: {
  where?: Prisma.DayOffRequestWhereInput;
  limit?: number;
}): Promise<DayOffRequestRow[]> => {
  const rows = await db.dayOffRequest.findMany({
    where: input.where,
    include: dayOffRequestDashboardInclude,
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializeDayOffRequest(row as DashboardDayOffRequestRecord),
  );
};

const loadScheduleChangeRequests = async (input: {
  where?: Prisma.ScheduleChangeRequestWhereInput;
  limit?: number;
}): Promise<ScheduleChangeRequestRow[]> => {
  const rows = await db.scheduleChangeRequest.findMany({
    where: input.where,
    include: scheduleChangeDashboardInclude,
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializeScheduleChangeRequest(row as DashboardScheduleChangeRecord),
  );
};

const loadScheduleSwapRequests = async (input: {
  where?: Prisma.ScheduleSwapRequestWhereInput;
  limit?: number;
  viewerEmployeeId?: string | null;
}): Promise<ScheduleSwapRequestRow[]> => {
  const rows = await db.scheduleSwapRequest.findMany({
    where: input.where,
    include: scheduleSwapDashboardInclude,
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map((row) =>
    serializeScheduleSwapRequest(
      row as DashboardScheduleSwapRecord,
      input.viewerEmployeeId,
    ),
  );
};

const loadRecentViolations = async (input: {
  where?: Prisma.EmployeeViolationWhereInput;
  limit?: number;
}): Promise<ViolationRow[]> => {
  const rows = await db.employeeViolation.findMany({
    where: input.where,
    include: employeeViolationInclude,
    orderBy: [{ violationDate: "desc" }, { createdAt: "desc" }],
    take: input.limit && input.limit > 0 ? input.limit : undefined,
  });

  return rows.map(serializeViolation);
};

const loadTodayAttendanceSnapshot = async (
  employeeId: string,
  dateKey = todayKey(),
): Promise<AttendanceSnapshot | null> => {
  const { start, end } = getDayBounds(dateKey);

  const [attendance, punches] = await Promise.all([
    db.attendance.findFirst({
      where: {
        employeeId,
        workDate: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { workDate: "desc" },
      include: {
        expectedShift: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.punch.findMany({
      where: {
        employeeId,
        punchTime: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { punchTime: "asc" },
      select: {
        punchType: true,
        punchTime: true,
      },
    }),
  ]);

  if (!attendance && punches.length === 0) {
    return null;
  }

  const lastPunchAt =
    punches.length > 0 ? punches[punches.length - 1].punchTime : null;
  const breakOutAt =
    [...punches].reverse().find((row) => row.punchType === "BREAK_OUT")?.punchTime ??
    null;
  const breakInAt =
    [...punches].reverse().find((row) => row.punchType === "BREAK_IN")?.punchTime ??
    null;

  return {
    id: attendance?.id ?? `attendance-placeholder-${employeeId}-${dateKey}`,
    employeeId,
    status: attendance?.status ?? ATTENDANCE_STATUS.ABSENT,
    lateMinutes: attendance?.lateMinutes ?? 0,
    undertimeMinutes: attendance?.undertimeMinutes ?? 0,
    actualInAt: toIsoString(attendance?.actualInAt),
    actualOutAt: toIsoString(attendance?.actualOutAt),
    breakStartAt: toIsoString(breakOutAt),
    breakEndAt: toIsoString(breakInAt),
    expectedShiftName: attendance?.expectedShift?.name ?? null,
    lastPunchAt: toIsoString(lastPunchAt),
  };
};

const buildPayrollItem = (
  role: AppRole,
  run: PayrollRunSummary,
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

const buildPayslipItem = (role: AppRole, row: PayrollPayslipSummary): DashboardItem => ({
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
  const rawSession = await getCurrentPlainSession();
  if (!rawSession?.isLoggedIn || !rawSession.userId || !rawSession.role) {
    return null;
  }

  const normalizedRole = normalizeRole(rawSession.role);
  if (!normalizedRole) {
    return null;
  }

  const employee =
    rawSession.employee &&
    typeof rawSession.employee === "object" &&
    "employeeId" in rawSession.employee &&
    "firstName" in rawSession.employee &&
    "lastName" in rawSession.employee
      ? (rawSession.employee as {
          employeeId: unknown;
          firstName: unknown;
          lastName: unknown;
          position?: unknown;
          department?: unknown;
          dailyRate?: unknown;
        })
      : null;

  return {
    userId: rawSession.userId,
    username: rawSession.username ?? "",
    email: rawSession.email ?? "",
    role: normalizedRole,
    employee: employee
      ? {
          employeeId: String(employee.employeeId),
          firstName: String(employee.firstName),
          lastName: String(employee.lastName),
          position:
            typeof employee.position === "string"
              ? employee.position
              : null,
          department:
            typeof employee.department === "string"
              ? employee.department
              : null,
          dailyRate:
            typeof employee.dailyRate === "number"
              ? employee.dailyRate
              : null,
        }
      : null,
  };
};

const buildAdminDashboard = async (session: DashboardSession): Promise<DashboardData> => {
  const { start: todayStart, end: todayEnd } = getDayBounds();
  const [
    payrollRuns,
    activeEmployeeCount,
    linkedAccounts,
    userCount,
    disabledUsers,
    attendanceRecordedCount,
    attendanceFlaggedCount,
    departmentCount,
    payrollQueueCount,
    deductionDraftCount,
    violationDraftCount,
    attendanceTrend,
  ] = await Promise.all([
    loadRecentPayrollRuns({ limit: 5 }),
    db.employee.count({
      where: {
        isArchived: false,
        currentStatus: { not: "ENDED" },
      },
    }),
    db.employee.count({
      where: {
        isArchived: false,
        currentStatus: { not: "ENDED" },
        userId: { not: null },
      },
    }),
    db.user.count(),
    db.user.count({ where: { isDisabled: true } }),
    db.attendance.count({
      where: {
        workDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
    db.attendance.count({
      where: buildAttendanceFlagWhere(todayStart, todayEnd),
    }),
    db.department.count({ where: { isActive: true } }),
    db.payroll.count({
      where: { status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] } },
    }),
    db.employeeDeductionAssignment.count({
      where: { workflowStatus: EmployeeDeductionWorkflowStatus.DRAFT },
    }),
    db.employeeViolation.count({ where: { status: "DRAFT" } }),
    loadAttendanceTrend(7),
  ]);

  const missingAccounts = Math.max(0, activeEmployeeCount - linkedAccounts);

  return {
    role: "admin",
    roleLabel: formatRoleLabel("admin"),
    displayName: buildDisplayName(session),
    subtitle: buildSubtitle(session),
    summary: "Today’s operational snapshot.",
    timestampLabel: shortNowLabel(),
    stats: [
      {
        label: "Active Employees",
        value: toCompactNumber(activeEmployeeCount),
        description: `${departmentCount} departments`,
        icon: "users",
        tone: "primary",
      },
      {
        label: "User Accounts",
        value: toCompactNumber(userCount),
        description: `${disabledUsers} disabled`,
        icon: "shield",
        tone: "info",
      },
      {
        label: "Attendance Flags",
        value: toCompactNumber(attendanceFlaggedCount),
        description: `${attendanceRecordedCount} logged today`,
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
        description: "Fix access coverage.",
        href: "/admin/users",
        icon: "shield",
        badge: missingAccounts > 0 ? `${missingAccounts} missing` : undefined,
      },
      {
        title: "Payroll History",
        description: "Review open payroll runs.",
        href: "/admin/payroll/payroll-history",
        icon: "receipt",
        badge: payrollQueueCount > 0 ? `${payrollQueueCount} open` : undefined,
      },
      {
        title: "Check Attendance",
        description: "Review today’s flagged logs.",
        href: "/admin/attendance",
        icon: "clock",
        badge:
          attendanceFlaggedCount > 0 ? `${attendanceFlaggedCount} flagged` : undefined,
      },
      {
        title: "Update Organization",
        description: "Edit teams and roles.",
        href: "/admin/organization/structure",
        icon: "building",
      },
    ],
    notes: [
      `${missingAccounts} missing account${missingAccounts === 1 ? "" : "s"}`,
      `${payrollQueueCount} open payroll run${payrollQueueCount === 1 ? "" : "s"}`,
      `${attendanceFlaggedCount} flagged attendance item${attendanceFlaggedCount === 1 ? "" : "s"}`,
    ],
    chart: {
      title: "Attendance activity",
      description: "Logged vs flagged over the last 7 days.",
      data: attendanceTrend,
    },
    primaryPanel: {
      title: "Payroll",
      description: "Latest runs.",
      emptyText: "No payroll runs are available yet.",
      items: payrollRuns.map((run) =>
        buildPayrollItem("admin", run, "/admin/payroll/payroll-history"),
      ),
      footerHref: "/admin/payroll/payroll-history",
      footerLabel: "Open payroll history",
    },
    secondaryPanel: {
      title: "Queues",
      description: "Items needing attention.",
      emptyText: "No review queues are active right now.",
      items: [
        {
          id: "admin-users",
          title: "Employees without linked accounts",
          description: "Create or link user records.",
          meta: `${linkedAccounts}/${activeEmployeeCount} active employees linked`,
          icon: "shield",
          href: "/admin/users",
          value: String(missingAccounts),
          statusLabel: missingAccounts > 0 ? "Needs setup" : "Covered",
          statusClassName: toneBadgeClass(
            missingAccounts > 0 ? "warning" : "success",
          ),
        },
        {
          id: "admin-deductions",
          title: "Deduction drafts waiting on review",
          description: "Manager review is still pending.",
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
          description: "Drafted violations are ready for review.",
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
          description: "Late, incomplete, absent, and undertime logs.",
          meta: `${attendanceRecordedCount} total attendance row${attendanceRecordedCount === 1 ? "" : "s"} today`,
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
      loadRecentPayrollRuns({ limit: 5 }),
      loadRecentDeductionAssignments({ limit: 5 }),
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
  const { start: todayStart, end: todayEnd } = getDayBounds();
  const [
    cashRows,
    leaveRows,
    dayOffRows,
    scheduleChangeRows,
    scheduleSwapRows,
    payrollRuns,
    pendingCashCount,
    pendingLeaveCount,
    pendingDayOffCount,
    pendingScheduleChangeCount,
    pendingScheduleSwapCount,
    payrollQueueCount,
    payrollReturnedCount,
    gmApprovalCount,
    attendanceFlaggedCount,
    activeEmployeeCount,
    deductionDraftCount,
    draftViolationCount,
  ] = await Promise.all([
    loadCashAdvanceRequests({
      where: { status: CashAdvanceRequestStatus.PENDING_MANAGER },
      limit: 8,
    }),
    loadLeaveRequests({
      where: { status: LeaveRequestStatus.PENDING_MANAGER },
      limit: 8,
    }),
    loadDayOffRequests({
      where: { status: DayOffRequestStatus.PENDING_MANAGER },
      limit: 8,
    }),
    loadScheduleChangeRequests({
      where: { status: ScheduleChangeRequestStatus.PENDING_MANAGER },
      limit: 8,
    }),
    loadScheduleSwapRequests({
      where: { status: ScheduleSwapRequestStatus.PENDING_MANAGER },
      limit: 8,
    }),
    loadRecentPayrollRuns({ limit: 6 }),
    db.cashAdvanceRequest.count({
      where: { status: CashAdvanceRequestStatus.PENDING_MANAGER },
    }),
    db.leaveRequest.count({
      where: { status: LeaveRequestStatus.PENDING_MANAGER },
    }),
    db.dayOffRequest.count({
      where: { status: DayOffRequestStatus.PENDING_MANAGER },
    }),
    db.scheduleChangeRequest.count({
      where: { status: ScheduleChangeRequestStatus.PENDING_MANAGER },
    }),
    db.scheduleSwapRequest.count({
      where: { status: ScheduleSwapRequestStatus.PENDING_MANAGER },
    }),
    db.payroll.count({
      where: {
        status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] },
      },
    }),
    db.payroll.count({
      where: {
        OR: [
          { managerDecision: PayrollReviewDecision.REJECTED },
          { gmDecision: PayrollReviewDecision.REJECTED },
        ],
        status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] },
      },
    }),
    db.payroll.count({
      where: {
        status: { notIn: [PayrollStatus.RELEASED, PayrollStatus.VOIDED] },
        managerDecision: PayrollReviewDecision.APPROVED,
        gmDecision: PayrollReviewDecision.PENDING,
      },
    }),
    db.attendance.count({
      where: {
        workDate: {
          gte: todayStart,
          lt: todayEnd,
        },
        OR: [
          { status: ATTENDANCE_STATUS.ABSENT },
          { status: ATTENDANCE_STATUS.INCOMPLETE },
          { lateMinutes: { gt: 0 } },
          { undertimeMinutes: { gt: 0 } },
        ],
      },
    }),
    db.employee.count({ where: { isArchived: false } }),
    db.employeeDeductionAssignment.count({
      where: { workflowStatus: EmployeeDeductionWorkflowStatus.DRAFT },
    }),
    db.employeeViolation.count({ where: { status: "DRAFT" } }),
  ]);

  const pendingRequests =
    pendingCashCount +
    pendingLeaveCount +
    pendingDayOffCount +
    pendingScheduleChangeCount +
    pendingScheduleSwapCount;

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
    loadRecentViolations({
      where: { draftedById: session.userId },
    }),
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
  const employeeId = session.employee?.employeeId ?? null;
  const today = todayKey();
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const yearStart = new Date(`${currentYear}-01-01T00:00:00+08:00`);
  const nextYearStart = new Date(`${currentYear + 1}-01-01T00:00:00+08:00`);
  const monthStartDate = new Date(
    `${currentYear}-${String(currentMonth).padStart(2, "0")}-01T00:00:00+08:00`,
  );
  const nextMonthStart =
    currentMonth === 12
      ? new Date(`${currentYear + 1}-01-01T00:00:00+08:00`)
      : new Date(
          `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01T00:00:00+08:00`,
        );

  const [
    todayAttendance,
    cashRows,
    leaveRows,
    dayOffRows,
    scheduleChangeRows,
    scheduleSwapRows,
    payslipRows,
    pendingCashCount,
    pendingLeaveCount,
    pendingDayOffCount,
    pendingScheduleChangeCount,
    pendingScheduleSwapCount,
    activeDeductions,
    releasedPayslipCount,
    paidLeaveUsed,
    paidSickLeaveUsed,
    approvedDayOffThisMonth,
    unacknowledgedViolations,
  ] = await Promise.all([
    employeeId ? loadTodayAttendanceSnapshot(employeeId, today) : Promise.resolve(null),
    employeeId
      ? loadCashAdvanceRequests({ where: { employeeId }, limit: 8 })
      : Promise.resolve([]),
    employeeId
      ? loadLeaveRequests({ where: { employeeId }, limit: 8 })
      : Promise.resolve([]),
    employeeId
      ? loadDayOffRequests({ where: { employeeId }, limit: 8 })
      : Promise.resolve([]),
    employeeId
      ? loadScheduleChangeRequests({ where: { employeeId }, limit: 8 })
      : Promise.resolve([]),
    employeeId
      ? loadScheduleSwapRequests({
          where: {
            OR: [
              { requesterEmployeeId: employeeId },
              { coworkerEmployeeId: employeeId },
            ],
          },
          limit: 8,
          viewerEmployeeId: employeeId,
        })
      : Promise.resolve([]),
    employeeId
      ? loadRecentPayrollPayslips({ employeeId, limit: 6 })
      : Promise.resolve([]),
    employeeId
      ? db.cashAdvanceRequest.count({
          where: {
            employeeId,
            status: CashAdvanceRequestStatus.PENDING_MANAGER,
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.leaveRequest.count({
          where: {
            employeeId,
            status: LeaveRequestStatus.PENDING_MANAGER,
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.dayOffRequest.count({
          where: {
            employeeId,
            status: DayOffRequestStatus.PENDING_MANAGER,
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.scheduleChangeRequest.count({
          where: {
            employeeId,
            status: ScheduleChangeRequestStatus.PENDING_MANAGER,
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.scheduleSwapRequest.count({
          where: {
            OR: [
              { requesterEmployeeId: employeeId },
              { coworkerEmployeeId: employeeId },
            ],
            status: {
              in: [
                ScheduleSwapRequestStatus.PENDING_MANAGER,
                ScheduleSwapRequestStatus.PENDING_COWORKER,
              ],
            },
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.employeeDeductionAssignment.count({
          where: {
            employeeId,
            workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
            status: EmployeeDeductionAssignmentStatus.ACTIVE,
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.payrollEmployee.count({
          where: {
            employeeId,
            payroll: { status: PayrollStatus.RELEASED },
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.attendance.count({
          where: {
            employeeId,
            status: ATTENDANCE_STATUS.LEAVE,
            isPaidLeave: true,
            workDate: {
              gte: yearStart,
              lt: nextYearStart,
            },
            NOT: {
              leaveRequest: {
                is: {
                  leaveType: LeaveRequestType.SICK,
                },
              },
            },
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.attendance.count({
          where: {
            employeeId,
            status: ATTENDANCE_STATUS.LEAVE,
            isPaidLeave: true,
            workDate: {
              gte: yearStart,
              lt: nextYearStart,
            },
            leaveRequest: {
              is: {
                leaveType: LeaveRequestType.SICK,
              },
            },
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.dayOffRequest.count({
          where: {
            employeeId,
            status: DayOffRequestStatus.APPROVED,
            workDate: {
              gte: monthStartDate,
              lt: nextMonthStart,
            },
          },
        })
      : Promise.resolve(0),
    employeeId
      ? db.employeeViolation.count({
          where: {
            employeeId,
            isAcknowledged: false,
          },
        })
      : Promise.resolve(0),
  ]);

  const pendingRequests =
    pendingCashCount +
    pendingLeaveCount +
    pendingDayOffCount +
    pendingScheduleChangeCount +
    pendingScheduleSwapCount;
  const latestPayslip = payslipRows[0] ?? null;
  const leaveBalance = {
    year: currentYear,
    paidLeaveAllowance: PAID_LEAVE_ALLOWANCE_PER_YEAR,
    paidLeaveUsed,
    paidLeaveRemaining: Math.max(
      0,
      PAID_LEAVE_ALLOWANCE_PER_YEAR - paidLeaveUsed,
    ),
    paidSickLeaveAllowance: PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR,
    paidSickLeaveUsed,
    paidSickLeaveRemaining: Math.max(
      0,
      PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR - paidSickLeaveUsed,
    ),
  };
  const dayOffSummary = {
    year: currentYear,
    month: currentMonth,
    monthLabel: monthStartDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    approvedThisMonth: approvedDayOffThisMonth,
  };

  const lastPunch =
    todayAttendance?.lastPunchAt ??
    todayAttendance?.actualOutAt ??
    todayAttendance?.actualInAt ??
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
        badge: releasedPayslipCount > 0 ? `${releasedPayslipCount} released` : undefined,
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
