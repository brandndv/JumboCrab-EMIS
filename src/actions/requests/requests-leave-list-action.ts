"use server";

import {
  ATTENDANCE_STATUS,
  LeaveRequestStatus,
  LeaveRequestType,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PAID_LEAVE_ALLOWANCE_PER_YEAR,
  PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR,
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  reviewedBySelect,
  serializeLeaveRequest,
} from "./requests-shared";
import type { EmployeeLeaveBalanceSummary, LeaveRequestRow } from "./types";

export async function listLeaveRequests(input?: {
  statuses?: LeaveRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: LeaveRequestRow[];
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

    const where: Prisma.LeaveRequestWhereInput = {};

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
        error: "You are not allowed to view leave requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.leaveRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        attendances: {
          select: {
            workDate: true,
            isPaidLeave: true,
          },
        },
      },
    });

    return { success: true, data: rows.map(serializeLeaveRequest) };
  } catch (error) {
    console.error("Error listing leave requests:", error);
    return { success: false, error: "Failed to load leave requests." };
  }
}

export async function getEmployeeLeaveBalanceSummary(input?: {
  year?: number | null;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  data?: EmployeeLeaveBalanceSummary;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const resolvedYear =
      typeof input?.year === "number" && Number.isInteger(input.year)
        ? input.year
        : new Date().getFullYear();
    const year = Math.max(2000, Math.min(resolvedYear, 2100));

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
        error: "You are not allowed to view leave balances.",
      };
    }

    const yearStart = new Date(`${year}-01-01T00:00:00+08:00`);
    const nextYearStart = new Date(`${year + 1}-01-01T00:00:00+08:00`);

    const paidLeaveAttendances = await db.attendance.findMany({
      where: {
        employeeId,
        status: ATTENDANCE_STATUS.LEAVE,
        isPaidLeave: true,
        workDate: {
          gte: yearStart,
          lt: nextYearStart,
        },
      },
      select: {
        leaveRequest: {
          select: {
            leaveType: true,
          },
        },
      },
    });

    let paidLeaveUsed = 0;
    let paidSickLeaveUsed = 0;

    paidLeaveAttendances.forEach((attendance) => {
      if (attendance.leaveRequest?.leaveType === LeaveRequestType.SICK) {
        paidSickLeaveUsed += 1;
      } else {
        paidLeaveUsed += 1;
      }
    });

    return {
      success: true,
      data: {
        year,
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
      },
    };
  } catch (error) {
    console.error("Error loading leave balance summary:", error);
    return { success: false, error: "Failed to load leave balances." };
  }
}
