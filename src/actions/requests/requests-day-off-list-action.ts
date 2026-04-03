"use server";

import { DayOffRequestStatus, Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  reviewedBySelect,
  serializeDayOffRequest,
  toZonedDayKey,
} from "./requests-shared";
import type {
  DayOffRequestRow,
  EmployeeDayOffMonthlySummary,
} from "./types";

export async function getEmployeeDayOffMonthlySummary(input?: {
  year?: number | null;
  month?: number | null;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  data?: EmployeeDayOffMonthlySummary;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const todayKey = toZonedDayKey(new Date());
    const [currentYear, currentMonth] = todayKey.split("-").map(Number);
    const resolvedYear =
      typeof input?.year === "number" && Number.isInteger(input.year)
        ? input.year
        : currentYear;
    const resolvedMonth =
      typeof input?.month === "number" && Number.isInteger(input.month)
        ? input.month
        : currentMonth;
    const year = Math.max(2000, Math.min(resolvedYear, 2100));
    const month = Math.max(1, Math.min(resolvedMonth, 12));

    let employeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      employeeId =
        typeof input?.employeeId === "string" && input.employeeId.trim()
          ? input.employeeId.trim()
          : null;
      if (!employeeId) {
        return { success: false, error: "Employee is required." };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view day off summaries.",
      };
    }

    const monthStart = new Date(
      `${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`,
    );
    const nextMonthStart =
      month === 12
        ? new Date(`${year + 1}-01-01T00:00:00+08:00`)
        : new Date(
            `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+08:00`,
          );

    const approvedThisMonth = await db.dayOffRequest.count({
      where: {
        employeeId,
        status: DayOffRequestStatus.APPROVED,
        workDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    });

    return {
      success: true,
      data: {
        year,
        month,
        monthLabel: monthStart.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        approvedThisMonth,
      },
    };
  } catch (error) {
    console.error("Error loading day off monthly summary:", error);
    return { success: false, error: "Failed to load day off summary." };
  }
}

export async function listDayOffRequests(input?: {
  statuses?: DayOffRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DayOffRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.DayOffRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view day off requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.dayOffRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return { success: true, data: rows.map(serializeDayOffRequest) };
  } catch (error) {
    console.error("Error listing day off requests:", error);
    return { success: false, error: "Failed to load day off requests." };
  }
}
