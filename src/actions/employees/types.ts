import type { Employee as PrismaEmployee } from "@prisma/client";

export type EmployeeActionRecord = Omit<PrismaEmployee, "dailyRate"> & {
  dailyRate: number | null;
  department?: string | null;
  position?: string | null;
};

export type EmployeeRateHistoryItem = {
  id: string;
  employeeId: string;
  dailyRate: number | null;
  effectiveFrom: string;
  reason: string | null;
  createdAt: string;
};
