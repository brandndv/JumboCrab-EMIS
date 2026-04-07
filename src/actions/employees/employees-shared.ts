import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Employee as PrismaEmployee, Prisma } from "@prisma/client";
import type { EmployeeActionRecord, EmployeeRateHistoryItem } from "./types";

export const employeeLookupInclude = {
  department: { select: { departmentId: true, name: true } },
  position: { select: { positionId: true, name: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithLookupRelations = Prisma.EmployeeGetPayload<{
  include: typeof employeeLookupInclude;
}>;

type EmployeeRelationIds = {
  userId?: unknown;
  departmentId?: unknown;
  positionId?: unknown;
  supervisorUserId?: unknown;
};

const EMPLOYEE_ROUTE_PREFIXES = [
  "/admin/employees",
  "/manager/employees",
  "/generalManager/employees",
] as const;

export const toRateNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseDateInput = (value: unknown): Date | null => {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeOptionalId = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized =
    typeof value === "string" ? value.trim() : String(value).trim();
  return normalized === "" ? null : normalized;
};

export const isSameRate = (left: number | null, right: number | null) => {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) < 0.000001;
};

export const isMissingRateHistoryTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "P2021";
};

export const normalizeEmployeeRelationIds = (input: EmployeeRelationIds) => ({
  userId: normalizeOptionalId(input.userId),
  departmentId: normalizeOptionalId(input.departmentId),
  positionId: normalizeOptionalId(input.positionId),
  supervisorUserId: normalizeOptionalId(input.supervisorUserId),
});

export const validateEmployeeRelationIds = async (
  input: ReturnType<typeof normalizeEmployeeRelationIds>,
): Promise<string | null> => {
  const [user, supervisorUser, department, position] = await Promise.all([
    input.userId
      ? db.user.findUnique({
          where: { userId: input.userId },
          select: { userId: true },
        })
      : Promise.resolve(null),
    input.supervisorUserId
      ? db.user.findUnique({
          where: { userId: input.supervisorUserId },
          select: { userId: true },
        })
      : Promise.resolve(null),
    input.departmentId
      ? db.department.findUnique({
          where: { departmentId: input.departmentId },
          select: { departmentId: true },
        })
      : Promise.resolve(null),
    input.positionId
      ? db.position.findUnique({
          where: { positionId: input.positionId },
          select: { positionId: true, departmentId: true, isActive: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.userId && !user) {
    return "Selected user not found";
  }
  if (input.supervisorUserId && !supervisorUser) {
    return "Selected supervisor not found";
  }
  if (input.departmentId && !department) {
    return "Selected department not found";
  }
  if (input.positionId && !position) {
    return "Selected position not found";
  }
  if (position && !position.isActive) {
    return "Selected position is no longer active";
  }
  if (
    position &&
    input.departmentId &&
    position.departmentId !== input.departmentId
  ) {
    return "Selected position does not belong to the selected department";
  }

  return null;
};

export const serializeEmployeeRecord = (
  employee: PrismaEmployee,
): EmployeeActionRecord => ({
  ...employee,
  dailyRate: toRateNumber(employee.dailyRate),
});

export const serializeEmployeeWithLookups = (
  employee: EmployeeWithLookupRelations,
): EmployeeActionRecord => ({
  ...employee,
  dailyRate: toRateNumber(employee.dailyRate),
  department: employee.department?.name ?? null,
  position: employee.position?.name ?? null,
});

export const getFallbackRateHistory = async (
  employeeId: string,
  reason: string,
): Promise<EmployeeRateHistoryItem[]> => {
  const employee = await db.employee.findUnique({
    where: { employeeId },
    select: {
      employeeId: true,
      dailyRate: true,
      startDate: true,
      updatedAt: true,
    },
  });

  const fallbackRate = toRateNumber(employee?.dailyRate);
  if (!employee || fallbackRate == null) {
    return [];
  }

  return [
    {
      id: `fallback-${employee.employeeId}`,
      employeeId: employee.employeeId,
      dailyRate: fallbackRate,
      hourlyRate: null,
      monthlyRate: null,
      payrollFrequency: "BIMONTHLY",
      effectiveFrom: employee.startDate.toISOString(),
      reason,
      createdAt: employee.updatedAt.toISOString(),
    },
  ];
};

export const revalidateEmployeePages = (employeeId?: string) => {
  revalidatePath("/dashboard/employees");
  EMPLOYEE_ROUTE_PREFIXES.forEach((prefix) => {
    revalidatePath(prefix);
    if (employeeId) {
      revalidatePath(`${prefix}/${employeeId}/view`);
      revalidatePath(`${prefix}/${employeeId}/edit`);
    }
  });
};
