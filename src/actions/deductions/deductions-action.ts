"use server";

import { revalidatePath } from "next/cache";
import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  PayrollStatus,
  Roles,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deductionAssignmentSchema,
  deductionPaymentSchema,
  deductionTypeSchema,
  type DeductionAssignmentInput,
} from "@/lib/validations/deductions";

const DEDUCTION_LAYOUT_PATHS = [
  "/admin/deductions",
  "/generalManager/deductions",
  "/manager/deductions",
  "/clerk/deductions",
  "/employee/deductions",
] as const;

const toIsoString = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const normalizeCode = (code: string | undefined, name: string) => {
  const seed = (code && code.trim() ? code : name).trim().toUpperCase();
  const slug = seed
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug;
};

const duplicateAssignmentMessage =
  "A deduction assignment for this employee, deduction type, and start date already exists. Edit the existing record or choose a different effective start date.";

const canManageDeductionTypes = (role?: Roles) =>
  role === Roles.Admin || role === Roles.GeneralManager;

const canReviewDeductionAssignments = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

const canCreateApprovedDeductionAssignments = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

const canRecordDeductionPayments = (role?: Roles) =>
  canCreateApprovedDeductionAssignments(role);

const canCreateDeductionDrafts = (role?: Roles) => role === Roles.Clerk;

const canViewEmployeeDeductionDirectory = (role?: Roles) =>
  role === Roles.Admin ||
  role === Roles.GeneralManager ||
  role === Roles.Manager ||
  role === Roles.Clerk;

const canSearchEmployeesForDeductions = (role?: Roles) =>
  canViewEmployeeDeductionDirectory(role) ||
  canCreateApprovedDeductionAssignments(role) ||
  canCreateDeductionDrafts(role);

const revalidateDeductionLayouts = () => {
  DEDUCTION_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
};

type DeductionTypePayload = {
  code?: string | null;
  name: string;
  description?: string | null;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: string | number | null;
  defaultPercent?: string | number | null;
  isActive?: boolean | null;
};

type DeductionAssignmentPayload = {
  id?: string | null;
  employeeId: string;
  deductionTypeId: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  amountOverride?: string | number | null;
  percentOverride?: string | number | null;
  installmentTotal?: string | number | null;
  installmentPerPayroll?: string | number | null;
  remainingBalance?: string | number | null;
  status?: EmployeeDeductionAssignmentStatus | null;
  reason?: string | null;
};

type DeductionPaymentPayload = {
  id: string;
  amount: string | number;
  paymentDate: string | Date;
  remarks?: string | null;
};

type DeductionTypeRecord = Prisma.DeductionTypeGetPayload<{
  include: {
    createdBy: {
      select: {
        username: true;
      };
    };
    updatedBy: {
      select: {
        username: true;
      };
    };
  };
}>;

type EmployeeDeductionAssignmentRecord =
  Prisma.EmployeeDeductionAssignmentGetPayload<{
    include: {
      employee: {
        select: {
          employeeId: true;
          employeeCode: true;
          firstName: true;
          lastName: true;
          img: true;
        };
      };
      deductionType: {
        select: {
          id: true;
          code: true;
          name: true;
          description: true;
          amountMode: true;
          frequency: true;
          defaultAmount: true;
          defaultPercent: true;
          isActive: true;
        };
      };
      assignedBy: {
        select: {
          userId: true;
          username: true;
        };
      };
      reviewedBy: {
        select: {
          userId: true;
          username: true;
        };
      };
      payments: {
        include: {
          createdBy: {
            select: {
              userId: true;
              username: true;
            };
          };
        };
      };
    };
  }>;

type EmployeeDeductionPaymentRecord = Prisma.EmployeeDeductionPaymentGetPayload<{
  include: {
    createdBy: {
      select: {
        userId: true;
        username: true;
      };
    };
  };
}>;

export type DeductionTypeRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: number | null;
  defaultPercent?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  updatedByName?: string | null;
};

export type DeductionEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

export type DeductionAssignmentRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  deductionTypeId: string;
  deductionCode: string;
  deductionName: string;
  deductionDescription?: string | null;
  deductionTypeIsActive: boolean;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: number | null;
  defaultPercent?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  amountOverride?: number | null;
  percentOverride?: number | null;
  installmentTotal?: number | null;
  installmentPerPayroll?: number | null;
  remainingBalance?: number | null;
  workflowStatus: EmployeeDeductionWorkflowStatus;
  status: EmployeeDeductionAssignmentStatus;
  reason?: string | null;
  assignedByUserId?: string | null;
  assignedByName?: string | null;
  reviewedByUserId?: string | null;
  reviewedByName?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  payments: DeductionPaymentRow[];
  createdAt: string;
  updatedAt: string;
};

export type DeductionPaymentRow = {
  id: string;
  amount: number;
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
};

const serializeDeductionType = (row: DeductionTypeRecord): DeductionTypeRow => ({
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

const serializeDeductionPayment = (
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

const serializeDeductionAssignment = (
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

const resolveAssignmentValues = (input: DeductionAssignmentInput, options: {
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount: Prisma.Decimal | null;
  defaultPercent: Prisma.Decimal | null;
  existing?: {
    installmentTotal: Prisma.Decimal | null;
    installmentPerPayroll: Prisma.Decimal | null;
    remainingBalance: Prisma.Decimal | null;
  };
}) => {
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
    input.installmentTotal ??
    toNumber(options.existing?.installmentTotal) ??
    null;
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
    remainingBalance: remainingBalance == null ? installmentTotal : remainingBalance,
  } as const;
};

const resolveInstallmentStatusAfterPayment = (
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

const findDuplicateAssignment = async (input: {
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

const loadAssignmentRecord = async (id: string) =>
  db.employeeDeductionAssignment.findUnique({
    where: { id },
    include: {
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
        include: {
          createdBy: {
            select: {
              userId: true,
              username: true,
            },
          },
        },
      },
    },
  });

export async function listDeductionTypes(input?: {
  includeInactive?: boolean | null;
}): Promise<{ success: boolean; data?: DeductionTypeRow[]; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session?.isLoggedIn ||
      (!canManageDeductionTypes(session.role) &&
        !canSearchEmployeesForDeductions(session.role))
    ) {
      return {
        success: false,
        error: "You are not allowed to view deduction types.",
      };
    }

    const includeInactive =
      canManageDeductionTypes(session.role) &&
      typeof input?.includeInactive === "boolean"
        ? input.includeInactive
        : false;

    const rows = await db.deductionType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ name: "asc" }],
      include: {
        createdBy: { select: { username: true } },
        updatedBy: { select: { username: true } },
      },
    });

    return { success: true, data: rows.map(serializeDeductionType) };
  } catch (error) {
    console.error("Error listing deduction types:", error);
    return { success: false, error: "Failed to load deduction types." };
  }
}

export async function createDeductionType(
  input: DeductionTypePayload,
): Promise<{ success: boolean; data?: DeductionTypeRow; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageDeductionTypes(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create deduction types.",
      };
    }

    const parsed = deductionTypeSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return { success: false, error: message || "Invalid deduction type data" };
    }

    const code = normalizeCode(parsed.data.code, parsed.data.name);
    if (!code) {
      return {
        success: false,
        error: "A valid deduction code could not be generated.",
      };
    }

    const duplicate = await db.deductionType.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { name: { equals: parsed.data.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A deduction type with the same code or name already exists.",
      };
    }

    const created = await db.deductionType.create({
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        amountMode: parsed.data.amountMode,
        frequency: parsed.data.frequency,
        defaultAmount:
          parsed.data.amountMode === DeductionAmountMode.FIXED
            ? parsed.data.defaultAmount ?? null
            : null,
        defaultPercent:
          parsed.data.amountMode === DeductionAmountMode.PERCENT
            ? parsed.data.defaultPercent ?? null
            : null,
        isActive: parsed.data.isActive,
        createdByUserId: session.userId ?? null,
        updatedByUserId: session.userId ?? null,
      },
      include: {
        createdBy: { select: { username: true } },
        updatedBy: { select: { username: true } },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionType(created) };
  } catch (error) {
    console.error("Error creating deduction type:", error);
    return { success: false, error: "Failed to create deduction type." };
  }
}

export async function updateDeductionType(input: {
  id: string;
} & DeductionTypePayload): Promise<{
  success: boolean;
  data?: DeductionTypeRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageDeductionTypes(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update deduction types.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "Deduction type ID is required." };
    }

    const parsed = deductionTypeSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return { success: false, error: message || "Invalid deduction type data" };
    }

    const existing = await db.deductionType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Deduction type not found." };
    }

    const code = normalizeCode(parsed.data.code, parsed.data.name);
    if (!code) {
      return {
        success: false,
        error: "A valid deduction code could not be generated.",
      };
    }

    const duplicate = await db.deductionType.findFirst({
      where: {
        id: { not: id },
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { name: { equals: parsed.data.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A deduction type with the same code or name already exists.",
      };
    }

    const updated = await db.deductionType.update({
      where: { id },
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        amountMode: parsed.data.amountMode,
        frequency: parsed.data.frequency,
        defaultAmount:
          parsed.data.amountMode === DeductionAmountMode.FIXED
            ? parsed.data.defaultAmount ?? null
            : null,
        defaultPercent:
          parsed.data.amountMode === DeductionAmountMode.PERCENT
            ? parsed.data.defaultPercent ?? null
            : null,
        isActive: parsed.data.isActive,
        updatedByUserId: session.userId ?? null,
      },
      include: {
        createdBy: { select: { username: true } },
        updatedBy: { select: { username: true } },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionType(updated) };
  } catch (error) {
    console.error("Error updating deduction type:", error);
    return { success: false, error: "Failed to update deduction type." };
  }
}

export async function listEmployeesForDeduction(input?: {
  query?: string | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DeductionEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canSearchEmployeesForDeductions(session.role)) {
      return { success: false, error: "You are not allowed to load employees." };
    }

    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 40;
    const limit = Math.max(1, Math.min(limitRaw, 200));
    const queryTokens = query.split(/\s+/).filter(Boolean);

    const where: Prisma.EmployeeWhereInput = { isArchived: false };
    if (queryTokens.length > 0) {
      where.AND = queryTokens.map((token) => ({
        OR: [
          { employeeCode: { contains: token, mode: "insensitive" } },
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      }));
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: [{ employeeCode: "asc" }],
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employeeId) {
      return { success: true, data: employees };
    }

    const hasSelected = employees.some((row) => row.employeeId === employeeId);
    if (hasSelected) {
      return { success: true, data: employees };
    }

    const selected = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        isArchived: true,
      },
    });

    if (!selected || selected.isArchived) {
      return { success: true, data: employees };
    }

    return { success: true, data: [selected, ...employees] };
  } catch (error) {
    console.error("Error listing employees for deductions:", error);
    return { success: false, error: "Failed to load employees." };
  }
}

export async function listEmployeeDeductionAssignments(input?: {
  employeeId?: string | null;
  assignmentId?: string | null;
  workflowStatuses?: EmployeeDeductionWorkflowStatus[] | null;
  directoryMode?: boolean | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const assignmentId =
      typeof input?.assignmentId === "string" && input.assignmentId.trim()
        ? input.assignmentId.trim()
        : null;
    const directoryMode = input?.directoryMode === true;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 300;
    const limit = Math.max(1, Math.min(limitRaw, 500));

    const where: Prisma.EmployeeDeductionAssignmentWhereInput = {};

    if (session.role === Roles.Employee) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      where.employee = { userId: session.userId };
      where.workflowStatus = EmployeeDeductionWorkflowStatus.APPROVED;
    } else if (session.role === Roles.Clerk) {
      if (!session.userId) {
        return { success: false, error: "Clerk session is invalid." };
      }
      if (!directoryMode && !employeeId) {
        where.assignedByUserId = session.userId;
      }
    } else if (!canViewEmployeeDeductionDirectory(session.role) && !canReviewDeductionAssignments(session.role)) {
      return {
        success: false,
        error: "You are not allowed to view deduction assignments.",
      };
    }

    if (employeeId) where.employeeId = employeeId;
    if (assignmentId) where.id = assignmentId;
    if (
      session.role !== Roles.Employee &&
      Array.isArray(input?.workflowStatuses) &&
      input?.workflowStatuses.length
    ) {
      where.workflowStatus = { in: input.workflowStatuses };
    }

    const rows = await db.employeeDeductionAssignment.findMany({
      where,
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
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
          include: {
            createdBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return { success: true, data: rows.map(serializeDeductionAssignment) };
  } catch (error) {
    console.error("Error listing employee deduction assignments:", error);
    return {
      success: false,
      error: "Failed to load deduction assignments.",
    };
  }
}

export async function getEmployeeDeductionAssignment(
  assignmentId: string,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const id = typeof assignmentId === "string" ? assignmentId.trim() : "";
    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }

    const row = await loadAssignmentRecord(id);
    if (!row) {
      return { success: false, error: "Deduction assignment not found." };
    }

    if (session.role === Roles.Clerk) {
      if (
        !session.userId ||
        row.assignedByUserId !== session.userId ||
        (row.workflowStatus !== EmployeeDeductionWorkflowStatus.DRAFT &&
          row.workflowStatus !== EmployeeDeductionWorkflowStatus.REJECTED)
      ) {
        return {
          success: false,
          error: "You are not allowed to edit this deduction draft.",
        };
      }
    } else if (canCreateApprovedDeductionAssignments(session.role)) {
      if (row.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
        return {
          success: false,
          error: "Only approved deduction assignments can be edited here.",
        };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to access this deduction assignment.",
      };
    }

    return { success: true, data: serializeDeductionAssignment(row) };
  } catch (error) {
    console.error("Error fetching deduction assignment:", error);
    return { success: false, error: "Failed to load deduction assignment." };
  }
}

export async function createEmployeeDeductionAssignment(
  input: DeductionAssignmentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (
      !session?.isLoggedIn ||
      (!canCreateApprovedDeductionAssignments(session.role) &&
        !canCreateDeductionDrafts(session.role))
    ) {
      return {
        success: false,
        error: "You are not allowed to create deduction assignments.",
      };
    }

    const parsed = deductionAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return {
        success: false,
        error: message || "Invalid deduction assignment data",
      };
    }

    const [employee, deductionType] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId: parsed.data.employeeId },
        select: {
          employeeId: true,
          isArchived: true,
        },
      }),
      db.deductionType.findUnique({
        where: { id: parsed.data.deductionTypeId },
        select: {
          id: true,
          isActive: true,
          amountMode: true,
          frequency: true,
          defaultAmount: true,
          defaultPercent: true,
        },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found." };
    }
    if (!deductionType || !deductionType.isActive) {
      return {
        success: false,
        error: "Deduction type not found or inactive.",
      };
    }

    const normalized = resolveAssignmentValues(parsed.data, {
      amountMode: deductionType.amountMode,
      frequency: deductionType.frequency,
      defaultAmount: deductionType.defaultAmount,
      defaultPercent: deductionType.defaultPercent,
    });
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const duplicate = await findDuplicateAssignment({
      employeeId: parsed.data.employeeId,
      deductionTypeId: parsed.data.deductionTypeId,
      effectiveFrom: parsed.data.effectiveFrom!,
    });
    if (duplicate) {
      return { success: false, error: duplicateAssignmentMessage };
    }

    const isDirectApproval = canCreateApprovedDeductionAssignments(session.role);
    const now = new Date();
    const created = await db.employeeDeductionAssignment.create({
      data: {
        employeeId: parsed.data.employeeId,
        deductionTypeId: parsed.data.deductionTypeId,
        effectiveFrom: parsed.data.effectiveFrom!,
        effectiveTo: parsed.data.effectiveTo ?? null,
        amountOverride: normalized.amountOverride ?? null,
        percentOverride: normalized.percentOverride ?? null,
        installmentTotal: normalized.installmentTotal ?? null,
        installmentPerPayroll: normalized.installmentPerPayroll ?? null,
        remainingBalance: normalized.remainingBalance ?? null,
        workflowStatus: isDirectApproval
          ? EmployeeDeductionWorkflowStatus.APPROVED
          : EmployeeDeductionWorkflowStatus.DRAFT,
        status: parsed.data.status ?? EmployeeDeductionAssignmentStatus.ACTIVE,
        reason: parsed.data.reason ?? null,
        assignedByUserId: session.userId ?? null,
        updatedByUserId: session.userId ?? null,
        submittedAt: now,
        reviewedByUserId: isDirectApproval ? session.userId ?? null : null,
        reviewedAt: isDirectApproval ? now : null,
        reviewRemarks: null,
      },
      include: {
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
          include: {
            createdBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(created) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: duplicateAssignmentMessage };
    }
    console.error("Error creating deduction assignment:", error);
    return { success: false, error: "Failed to create deduction assignment." };
  }
}

export async function updateEmployeeDeductionAssignment(
  input: DeductionAssignmentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const parsed = deductionAssignmentSchema.safeParse(input);
    if (!parsed.success || !parsed.data.id) {
      const message = parsed.error?.issues[0]?.message;
      return {
        success: false,
        error: message || "A valid deduction assignment ID is required",
      };
    }

    const existing = await loadAssignmentRecord(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }

    const isClerkEdit = session.role === Roles.Clerk;
    const isManagerEdit = canCreateApprovedDeductionAssignments(session.role);

    if (isClerkEdit) {
      if (
        !session.userId ||
        existing.assignedByUserId !== session.userId ||
        (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.DRAFT &&
          existing.workflowStatus !== EmployeeDeductionWorkflowStatus.REJECTED)
      ) {
        return {
          success: false,
          error: "You are not allowed to edit this deduction draft.",
        };
      }
    } else if (isManagerEdit) {
      if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
        return {
          success: false,
          error: "Only approved deduction assignments can be edited here.",
        };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to update deduction assignments.",
      };
    }

    const [employee, deductionType] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId: parsed.data.employeeId },
        select: { employeeId: true, isArchived: true },
      }),
      db.deductionType.findUnique({
        where: { id: parsed.data.deductionTypeId },
        select: {
          id: true,
          isActive: true,
          amountMode: true,
          frequency: true,
          defaultAmount: true,
          defaultPercent: true,
        },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found." };
    }
    if (!deductionType || !deductionType.isActive) {
      return {
        success: false,
        error: "Deduction type not found or inactive.",
      };
    }

    const normalized = resolveAssignmentValues(parsed.data, {
      amountMode: deductionType.amountMode,
      frequency: deductionType.frequency,
      defaultAmount: deductionType.defaultAmount,
      defaultPercent: deductionType.defaultPercent,
      existing: {
        installmentTotal: existing.installmentTotal,
        installmentPerPayroll: existing.installmentPerPayroll,
        remainingBalance: existing.remainingBalance,
      },
    });
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const duplicate = await findDuplicateAssignment({
      employeeId: parsed.data.employeeId,
      deductionTypeId: parsed.data.deductionTypeId,
      effectiveFrom: parsed.data.effectiveFrom!,
      excludeId: existing.id,
    });
    if (duplicate) {
      return { success: false, error: duplicateAssignmentMessage };
    }

    const updated = await db.employeeDeductionAssignment.update({
      where: { id: existing.id },
      data: {
        employeeId: parsed.data.employeeId,
        deductionTypeId: parsed.data.deductionTypeId,
        effectiveFrom: parsed.data.effectiveFrom!,
        effectiveTo: parsed.data.effectiveTo ?? null,
        amountOverride: normalized.amountOverride ?? null,
        percentOverride: normalized.percentOverride ?? null,
        installmentTotal: normalized.installmentTotal ?? null,
        installmentPerPayroll: normalized.installmentPerPayroll ?? null,
        remainingBalance: normalized.remainingBalance ?? null,
        workflowStatus: isClerkEdit
          ? EmployeeDeductionWorkflowStatus.DRAFT
          : existing.workflowStatus,
        status: parsed.data.status ?? existing.status,
        reason: parsed.data.reason ?? null,
        updatedByUserId: session.userId ?? null,
        submittedAt: isClerkEdit ? new Date() : existing.submittedAt,
      },
      include: {
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
          include: {
            createdBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: duplicateAssignmentMessage };
    }
    console.error("Error updating deduction assignment:", error);
    return { success: false, error: "Failed to update deduction assignment." };
  }
}

export async function reviewEmployeeDeductionAssignment(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  reviewRemarks?: string | null;
}): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewDeductionAssignments(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review deduction drafts.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const reviewRemarks =
      typeof input.reviewRemarks === "string" && input.reviewRemarks.trim()
        ? input.reviewRemarks.trim()
        : null;

    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }
    if (input.decision === "REJECTED" && !reviewRemarks) {
      return {
        success: false,
        error: "Review remarks are required when rejecting a draft.",
      };
    }

    const existing = await loadAssignmentRecord(id);
    if (!existing) {
      return { success: false, error: "Deduction draft not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.DRAFT) {
      return { success: false, error: "Only deduction drafts can be reviewed." };
    }

    const reviewed = await db.employeeDeductionAssignment.update({
      where: { id },
      data: {
        workflowStatus:
          input.decision === "APPROVED"
            ? EmployeeDeductionWorkflowStatus.APPROVED
            : EmployeeDeductionWorkflowStatus.REJECTED,
        reviewedByUserId: session.userId ?? null,
        reviewedAt: new Date(),
        reviewRemarks,
        updatedByUserId: session.userId ?? null,
      },
      include: {
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
          include: {
            createdBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(reviewed) };
  } catch (error) {
    console.error("Error reviewing deduction assignment:", error);
    return { success: false, error: "Failed to review deduction draft." };
  }
}

export async function recordEmployeeDeductionPayment(
  input: DeductionPaymentPayload,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canRecordDeductionPayments(session.role)) {
      return {
        success: false,
        error: "You are not allowed to record deduction payments.",
      };
    }

    const parsed = deductionPaymentSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return {
        success: false,
        error: message || "Invalid deduction payment data",
      };
    }

    const existing = await loadAssignmentRecord(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
      return {
        success: false,
        error: "Only approved deductions can record manual payments.",
      };
    }
    if (existing.deductionType.frequency !== DeductionFrequency.INSTALLMENT) {
      return {
        success: false,
        error: "Manual payments are only available for installment deductions.",
      };
    }
    if (existing.status === EmployeeDeductionAssignmentStatus.CANCELLED) {
      return {
        success: false,
        error: "Cancelled installment deductions cannot accept payments.",
      };
    }

    const currentBalance = toNumber(
      existing.remainingBalance ?? existing.installmentTotal,
    );
    const paymentAmount = parsed.data.amount;
    if (currentBalance == null || currentBalance <= 0) {
      return {
        success: false,
        error: "This installment does not have a remaining balance.",
      };
    }
    if (paymentAmount == null || paymentAmount <= 0) {
      return {
        success: false,
        error: "Payment amount is required.",
      };
    }
    if (paymentAmount > currentBalance) {
      return {
        success: false,
        error: "Payment amount cannot exceed the remaining balance.",
      };
    }

    const pendingPayrollLine = await db.payrollDeduction.findFirst({
      where: {
        assignmentId: existing.id,
        isVoided: false,
        payrollEmployee: {
          payroll: {
            status: { in: [PayrollStatus.DRAFT, PayrollStatus.REVIEWED] },
          },
        },
      },
      select: {
        payrollEmployee: {
          select: {
            payroll: {
              select: {
                payrollPeriodStart: true,
                payrollPeriodEnd: true,
              },
            },
          },
        },
      },
    });

    if (pendingPayrollLine) {
      const pendingPayroll = pendingPayrollLine.payrollEmployee.payroll;
      return {
        success: false,
        error: `This installment is already included in an unreleased payroll for ${pendingPayroll.payrollPeriodStart.toLocaleDateString()} to ${pendingPayroll.payrollPeriodEnd.toLocaleDateString()}. Release or void that payroll before recording another payment.`,
      };
    }

    const nextRemainingBalance = roundMoney(
      Math.max(0, currentBalance - paymentAmount),
    );

    const updated = await db.$transaction(async (tx) => {
      await tx.employeeDeductionPayment.create({
        data: {
          assignmentId: existing.id,
          amount: paymentAmount,
          paymentDate: parsed.data.paymentDate!,
          remarks: parsed.data.remarks ?? null,
          createdByUserId: session.userId ?? null,
        },
      });

      return tx.employeeDeductionAssignment.update({
        where: { id: existing.id },
        data: {
          remainingBalance: nextRemainingBalance,
          status: resolveInstallmentStatusAfterPayment(
            existing.status,
            nextRemainingBalance,
          ),
          updatedByUserId: session.userId ?? null,
        },
        include: {
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
            include: {
              createdBy: {
                select: {
                  userId: true,
                  username: true,
                },
              },
            },
          },
        },
      });
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    console.error("Error recording deduction payment:", error);
    return { success: false, error: "Failed to record deduction payment." };
  }
}

export async function setEmployeeDeductionAssignmentStatus(input: {
  id: string;
  status: EmployeeDeductionAssignmentStatus;
}): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (
      !session?.isLoggedIn ||
      !canCreateApprovedDeductionAssignments(session.role)
    ) {
      return {
        success: false,
        error: "You are not allowed to update deduction assignment status.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }

    const existing = await loadAssignmentRecord(id);
    if (!existing) {
      return { success: false, error: "Deduction assignment not found." };
    }
    if (existing.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
      return {
        success: false,
        error: "Only approved assignments can change payroll status.",
      };
    }

    const updated = await db.employeeDeductionAssignment.update({
      where: { id },
      data: {
        status: input.status,
        updatedByUserId: session.userId ?? null,
      },
      include: {
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
          include: {
            createdBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        },
      },
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionAssignment(updated) };
  } catch (error) {
    console.error("Error updating deduction assignment status:", error);
    return {
      success: false,
      error: "Failed to update deduction assignment status.",
    };
  }
}
