import { revalidatePath } from "next/cache";
import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  Roles,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { type DeductionAssignmentInput } from "@/lib/validations/deductions";
import type {
  DeductionAssignmentRow,
  DeductionPaymentRow,
  DeductionTypeRow,
} from "./types";

const DEDUCTION_LAYOUT_PATHS = [
  "/admin/deductions",
  "/generalManager/deductions",
  "/manager/deductions",
  "/employee/deductions",
] as const;

export const deductionTypeInclude = {
  createdBy: {
    select: {
      username: true,
    },
  },
  updatedBy: {
    select: {
      username: true,
    },
  },
} satisfies Prisma.DeductionTypeInclude;

export const employeeDeductionPaymentInclude = {
  createdBy: {
    select: {
      userId: true,
      username: true,
    },
  },
} satisfies Prisma.EmployeeDeductionPaymentInclude;

export const employeeDeductionAssignmentInclude = {
  employee: {
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      img: true,
    },
  },
  deductionType: {
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      amountMode: true,
      frequency: true,
      defaultAmount: true,
      defaultPercent: true,
      isActive: true,
    },
  },
  assignedBy: {
    select: {
      userId: true,
      username: true,
    },
  },
  reviewedBy: {
    select: {
      userId: true,
      username: true,
    },
  },
  payments: {
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    include: employeeDeductionPaymentInclude,
  },
} satisfies Prisma.EmployeeDeductionAssignmentInclude;

type DeductionTypeRecord = Prisma.DeductionTypeGetPayload<{
  include: typeof deductionTypeInclude;
}>;

type EmployeeDeductionAssignmentRecord =
  Prisma.EmployeeDeductionAssignmentGetPayload<{
    include: typeof employeeDeductionAssignmentInclude;
  }>;

type EmployeeDeductionPaymentRecord = Prisma.EmployeeDeductionPaymentGetPayload<{
  include: typeof employeeDeductionPaymentInclude;
}>;

export const duplicateAssignmentMessage =
  "A deduction assignment for this employee, deduction type, and start date already exists. Edit the existing record or choose a different effective start date.";

export const toIsoString = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

export const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const normalizeCode = (code: string | undefined, name: string) => {
  const seed = (code && code.trim() ? code : name).trim().toUpperCase();
  const slug = seed
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug;
};

export const canManageDeductionTypes = (role?: Roles) =>
  role === Roles.Admin || role === Roles.GeneralManager;

export const canReviewDeductionAssignments = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

export const canCreateApprovedDeductionAssignments = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

export const canRecordDeductionPayments = (role?: Roles) =>
  canCreateApprovedDeductionAssignments(role);

export const canViewEmployeeDeductionDirectory = (role?: Roles) =>
  role === Roles.Admin ||
  role === Roles.GeneralManager ||
  role === Roles.Manager;

export const canSearchEmployeesForDeductions = (role?: Roles) =>
  canViewEmployeeDeductionDirectory(role) ||
  canCreateApprovedDeductionAssignments(role);

export const revalidateDeductionLayouts = () => {
  DEDUCTION_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
};

export const serializeDeductionType = (
  row: DeductionTypeRecord,
): DeductionTypeRow => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description ?? null,
  amountMode: row.amountMode,
  frequency: row.frequency,
  defaultAmount: toNumber(row.defaultAmount),
  defaultPercent: toNumber(row.defaultPercent),
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  createdByName: row.createdBy?.username ?? null,
  updatedByName: row.updatedBy?.username ?? null,
});

export const serializeDeductionPayment = (
  row: EmployeeDeductionPaymentRecord,
): DeductionPaymentRow => ({
  id: row.id,
  amount: toNumber(row.amount) ?? 0,
  paymentDate: row.paymentDate.toISOString(),
  remarks: row.remarks ?? null,
  createdAt: row.createdAt.toISOString(),
  createdByUserId: row.createdByUserId ?? null,
  createdByName: row.createdBy?.username ?? null,
});

export const serializeDeductionAssignment = (
  row: EmployeeDeductionAssignmentRecord,
): DeductionAssignmentRow => {
  const employeeName = [row.employee.firstName, row.employee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: employeeName || "Employee",
    employeeCode: row.employee.employeeCode,
    avatarUrl: row.employee.img ?? null,
    deductionTypeId: row.deductionTypeId,
    deductionCode: row.deductionType.code,
    deductionName: row.deductionType.name,
    deductionDescription: row.deductionType.description ?? null,
    deductionTypeIsActive: Boolean(row.deductionType.isActive),
    amountMode: row.deductionType.amountMode,
    frequency: row.deductionType.frequency,
    defaultAmount: toNumber(row.deductionType.defaultAmount),
    defaultPercent: toNumber(row.deductionType.defaultPercent),
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: toIsoString(row.effectiveTo),
    amountOverride: toNumber(row.amountOverride),
    percentOverride: toNumber(row.percentOverride),
    installmentTotal: toNumber(row.installmentTotal),
    installmentPerPayroll: toNumber(row.installmentPerPayroll),
    remainingBalance: toNumber(row.remainingBalance),
    workflowStatus: row.workflowStatus,
    status: row.status,
    reason: row.reason ?? null,
    assignedByUserId: row.assignedByUserId ?? null,
    assignedByName: row.assignedBy?.username ?? null,
    reviewedByUserId: row.reviewedByUserId ?? null,
    reviewedByName: row.reviewedBy?.username ?? null,
    submittedAt: toIsoString(row.submittedAt),
    reviewedAt: toIsoString(row.reviewedAt),
    reviewRemarks: row.reviewRemarks ?? null,
    payments: row.payments.map(serializeDeductionPayment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

export const resolveAssignmentValues = (
  input: DeductionAssignmentInput,
  options: {
    amountMode: DeductionAmountMode;
    frequency: DeductionFrequency;
    defaultAmount: Prisma.Decimal | null;
    defaultPercent: Prisma.Decimal | null;
    existing?: {
      installmentTotal: Prisma.Decimal | null;
      installmentPerPayroll: Prisma.Decimal | null;
      remainingBalance: Prisma.Decimal | null;
    };
  },
) => {
  const amountOverride = input.amountOverride ?? null;
  const percentOverride = input.percentOverride ?? null;

  if (
    options.amountMode === DeductionAmountMode.FIXED &&
    amountOverride == null &&
    toNumber(options.defaultAmount) == null
  ) {
    return { error: "This deduction type requires a fixed amount." } as const;
  }

  if (
    options.amountMode === DeductionAmountMode.PERCENT &&
    percentOverride == null &&
    toNumber(options.defaultPercent) == null
  ) {
    return {
      error: "This deduction type requires a percent value.",
    } as const;
  }

  if (options.frequency !== DeductionFrequency.INSTALLMENT) {
    return {
      amountOverride,
      percentOverride,
      installmentTotal: null,
      installmentPerPayroll: null,
      remainingBalance: null,
    } as const;
  }

  const installmentTotal =
    input.installmentTotal ?? toNumber(options.existing?.installmentTotal) ?? null;
  const installmentPerPayroll =
    input.installmentPerPayroll ??
    toNumber(options.existing?.installmentPerPayroll) ??
    null;
  const remainingBalance =
    input.remainingBalance ??
    toNumber(options.existing?.remainingBalance) ??
    installmentTotal;

  if (installmentTotal == null || installmentTotal <= 0) {
    return {
      error: "Installment deductions require a total amount.",
    } as const;
  }

  if (installmentPerPayroll == null || installmentPerPayroll <= 0) {
    return {
      error: "Installment deductions require a per-payroll amount.",
    } as const;
  }

  return {
    amountOverride,
    percentOverride,
    installmentTotal,
    installmentPerPayroll,
    remainingBalance:
      remainingBalance == null ? installmentTotal : remainingBalance,
  } as const;
};

export const resolveInstallmentStatusAfterPayment = (
  currentStatus: EmployeeDeductionAssignmentStatus,
  nextRemainingBalance: number,
) => {
  if (nextRemainingBalance <= 0) {
    return EmployeeDeductionAssignmentStatus.COMPLETED;
  }

  if (currentStatus === EmployeeDeductionAssignmentStatus.PAUSED) {
    return EmployeeDeductionAssignmentStatus.PAUSED;
  }

  if (currentStatus === EmployeeDeductionAssignmentStatus.CANCELLED) {
    return EmployeeDeductionAssignmentStatus.CANCELLED;
  }

  return EmployeeDeductionAssignmentStatus.ACTIVE;
};

export const findDuplicateAssignment = async (input: {
  employeeId: string;
  deductionTypeId: string;
  effectiveFrom: Date;
  excludeId?: string | null;
}) =>
  db.employeeDeductionAssignment.findFirst({
    where: {
      employeeId: input.employeeId,
      deductionTypeId: input.deductionTypeId,
      effectiveFrom: input.effectiveFrom,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true },
  });

export const loadAssignmentRecord = async (id: string) =>
  db.employeeDeductionAssignment.findUnique({
    where: { id },
    include: employeeDeductionAssignmentInclude,
  });
