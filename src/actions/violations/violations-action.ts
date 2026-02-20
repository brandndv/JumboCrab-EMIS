"use server";

import { db } from "@/lib/db";

import type { Prisma } from "@prisma/client";

type ViolationRecord = Prisma.ViolationGetPayload<{
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
  };
}>;

export type ViolationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  violationType: string;
  violationDate: string;
  amount?: number | null;
  paidAmount: number;
  remainingAmount: number;
  installmentAmount?: number | null;
  status: string;
  remarks?: string | null;
  createdAt: string;
};

const toNumber = (value: unknown) => {
  if (value === null || typeof value === "undefined") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const maybe = value as { toNumber?: () => number; toString?: () => string };
  if (typeof maybe.toNumber === "function") {
    return maybe.toNumber();
  }
  if (typeof maybe.toString === "function") {
    const parsed = Number(maybe.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumberOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  return toNumber(value);
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
};

const serializeViolation = (violation: ViolationRecord): ViolationRow => {
  const employee = violation.employee;
  const employeeName = employee
    ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
    : "";
  const employeeId =
    violation.employeeId ||
    violation.employeeEmployeeId ||
    employee?.employeeId ||
    "";

  return {
    id: violation.id,
    employeeId,
    employeeName: employeeName || "Unknown Employee",
    employeeCode: employee?.employeeCode ?? "",
    avatarUrl: employee?.img ?? null,
    violationType: violation.violationType,
    violationDate: toIsoString(violation.violationDate),
    amount: toNumberOrNull(violation.amount),
    paidAmount: toNumber(violation.paidAmount),
    remainingAmount: toNumber(violation.remainingAmount),
    installmentAmount: toNumberOrNull(violation.installmentAmount),
    status: violation.status,
    remarks: violation.remarks ?? null,
    createdAt: toIsoString(violation.createdAt),
  };
};

export async function getViolations(): Promise<{
  success: boolean;
  data?: ViolationRow[];
  error?: string;
}> {
  try {
    console.log("Fetching Violations");

    const violations = await db.violation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            img: true,
          },
        },
      },
    });
    return {
      success: true,
      data: violations.map(serializeViolation),
    };
  } catch (error) {
    console.error("Error fetching violations:", error);
    return {
      success: false,
      error: "Failed to fetch violations.",
    };
  }
}
