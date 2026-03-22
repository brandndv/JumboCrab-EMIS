"use client";

import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
} from "@prisma/client";

export const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatEmployeeLabel = (employee: {
  employeeCode: string;
  firstName: string;
  lastName: string;
}) => `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const formatStepCount = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 0.0001) {
    return String(Math.round(value));
  }
  return value.toFixed(1).replace(/\.0$/, "");
};

export const amountModeLabel = (mode: DeductionAmountMode) =>
  mode === DeductionAmountMode.FIXED ? "Fixed amount" : "Percent";

export const frequencyLabel = (frequency: DeductionFrequency) => {
  switch (frequency) {
    case DeductionFrequency.ONE_TIME:
      return "One-time";
    case DeductionFrequency.INSTALLMENT:
      return "Installment";
    default:
      return "Per payroll";
  }
};

export const workflowStatusLabel = (
  status: EmployeeDeductionWorkflowStatus,
) => {
  switch (status) {
    case EmployeeDeductionWorkflowStatus.APPROVED:
      return "Approved";
    case EmployeeDeductionWorkflowStatus.REJECTED:
      return "Returned";
    default:
      return "Draft";
  }
};

export const runtimeStatusLabel = (
  status: EmployeeDeductionAssignmentStatus,
) => {
  switch (status) {
    case EmployeeDeductionAssignmentStatus.PAUSED:
      return "Paused";
    case EmployeeDeductionAssignmentStatus.COMPLETED:
      return "Completed";
    case EmployeeDeductionAssignmentStatus.CANCELLED:
      return "Cancelled";
    default:
      return "Active";
  }
};

export const workflowStatusClass = (
  status: EmployeeDeductionWorkflowStatus,
) => {
  switch (status) {
    case EmployeeDeductionWorkflowStatus.APPROVED:
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case EmployeeDeductionWorkflowStatus.REJECTED:
      return "border-orange-600/40 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    default:
      return "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
};

export const runtimeStatusClass = (
  status: EmployeeDeductionAssignmentStatus,
) => {
  switch (status) {
    case EmployeeDeductionAssignmentStatus.COMPLETED:
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case EmployeeDeductionAssignmentStatus.PAUSED:
      return "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case EmployeeDeductionAssignmentStatus.CANCELLED:
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
};

export const describeAssignmentValue = (row: {
  amountMode: DeductionAmountMode;
  defaultAmount?: number | null;
  defaultPercent?: number | null;
  amountOverride?: number | null;
  percentOverride?: number | null;
}) => {
  if (row.amountMode === DeductionAmountMode.FIXED) {
    return formatMoney(row.amountOverride ?? row.defaultAmount ?? 0);
  }

  const value = row.percentOverride ?? row.defaultPercent ?? 0;
  return `${value}%`;
};

export const getInstallmentMetrics = (row: {
  installmentTotal?: number | null;
  installmentPerPayroll?: number | null;
  remainingBalance?: number | null;
  status: EmployeeDeductionAssignmentStatus;
}) => {
  const total = Math.max(0, row.installmentTotal ?? 0);
  const balanceSeed =
    row.remainingBalance ?? (total > 0 ? total : 0);
  const balance = Math.min(total || balanceSeed, Math.max(0, balanceSeed));
  const paid = Math.max(0, total - balance);
  const perPayroll = Math.max(0, row.installmentPerPayroll ?? 0);
  const totalSteps =
    total > 0 && perPayroll > 0 ? Math.max(1, Math.ceil(total / perPayroll)) : null;
  const settledSteps =
    totalSteps && perPayroll > 0
      ? Math.min(totalSteps, paid / perPayroll)
      : null;
  const progressPercent =
    total > 0 ? clampPercent((paid / total) * 100) : 0;

  return {
    total,
    balance,
    paid,
    perPayroll,
    totalSteps,
    settledSteps,
    progressPercent,
  };
};

export const getDeductionProgressMeta = (row: {
  frequency: DeductionFrequency;
  effectiveFrom: string;
  effectiveTo?: string | null;
  installmentTotal?: number | null;
  installmentPerPayroll?: number | null;
  remainingBalance?: number | null;
  status: EmployeeDeductionAssignmentStatus;
}) => {
  if (row.frequency === DeductionFrequency.INSTALLMENT) {
    const metrics = getInstallmentMetrics(row);
    const stepsLabel =
      metrics.totalSteps && metrics.settledSteps != null
        ? `${formatStepCount(metrics.settledSteps)} / ${metrics.totalSteps} settled`
        : "Installment in progress";

    return {
      title: "Repayment progress",
      label: stepsLabel,
      detail: `${formatMoney(metrics.balance)} remaining of ${formatMoney(metrics.total)}`,
      percent: metrics.progressPercent,
      barClass:
        row.status === EmployeeDeductionAssignmentStatus.COMPLETED
          ? "bg-emerald-500"
          : "bg-orange-500",
    };
  }

  if (row.frequency === DeductionFrequency.ONE_TIME) {
    const isSettled = row.status === EmployeeDeductionAssignmentStatus.COMPLETED;
    return {
      title: "Settlement progress",
      label: isSettled ? "Paid" : "Pending",
      detail: isSettled
        ? "This one-time deduction has been settled."
        : "This one-time deduction will settle on release.",
      percent: isSettled ? 100 : 0,
      barClass: isSettled ? "bg-emerald-500" : "bg-sky-500",
    };
  }

  if (row.effectiveTo) {
    const fromTime = new Date(row.effectiveFrom).getTime();
    const toTime = new Date(row.effectiveTo).getTime();
    const now = Date.now();
    const span = Math.max(1, toTime - fromTime);
    const elapsed = clampPercent(((now - fromTime) / span) * 100);
    const done =
      row.status === EmployeeDeductionAssignmentStatus.COMPLETED ||
      row.status === EmployeeDeductionAssignmentStatus.CANCELLED;

    return {
      title: "Schedule progress",
      label: runtimeStatusLabel(row.status),
      detail: `Scheduled through ${formatDate(row.effectiveTo)}`,
      percent: done ? 100 : elapsed,
      barClass:
        row.status === EmployeeDeductionAssignmentStatus.CANCELLED
          ? "bg-destructive"
          : row.status === EmployeeDeductionAssignmentStatus.PAUSED
            ? "bg-amber-500"
            : "bg-sky-500",
    };
  }

  return {
    title: "Assignment status",
    label: runtimeStatusLabel(row.status),
    detail:
      row.status === EmployeeDeductionAssignmentStatus.ACTIVE
        ? "This deduction stays active until you pause or complete it."
        : row.status === EmployeeDeductionAssignmentStatus.PAUSED
          ? "This deduction is on hold until it is resumed."
          : row.status === EmployeeDeductionAssignmentStatus.CANCELLED
            ? "This deduction has been cancelled."
            : "This deduction has been completed.",
    percent:
      row.status === EmployeeDeductionAssignmentStatus.ACTIVE
        ? 58
        : row.status === EmployeeDeductionAssignmentStatus.PAUSED
          ? 34
          : 100,
    barClass:
      row.status === EmployeeDeductionAssignmentStatus.COMPLETED
        ? "bg-emerald-500"
        : row.status === EmployeeDeductionAssignmentStatus.CANCELLED
          ? "bg-destructive"
          : row.status === EmployeeDeductionAssignmentStatus.PAUSED
            ? "bg-amber-500"
            : "bg-sky-500",
  };
};
