"use server";

import {
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  reviewedBySelect,
  scheduleChangeShiftSelect,
  serializeScheduleChangeRequest,
  serializeScheduleSwapRequest,
  toScheduleChangeShiftOption,
  toScheduleSwapEmployeeOption,
} from "./requests-shared";
import type {
  ScheduleChangeRequestRow,
  ScheduleChangeShiftOption,
  ScheduleSwapEmployeeOption,
  ScheduleSwapRequestRow,
} from "./types";

export async function listEmployeesForScheduleSwap(input?: {
  query?: string | null;
  workDate?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to search coworkers for swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 50;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const query = typeof input?.query === "string" ? input.query.trim() : "";

    const rows = await db.employee.findMany({
      where: {
        isArchived: false,
        employeeId: { not: employee.employeeId },
        userId: { not: null },
        ...(query
          ? {
              OR: [
                { employeeCode: { contains: query, mode: "insensitive" } },
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    return {
      success: true,
      data: rows.map(toScheduleSwapEmployeeOption),
    };
  } catch (error) {
    console.error("Error listing coworkers for schedule swap:", error);
    return { success: false, error: "Failed to load coworkers." };
  }
}

export async function listScheduleChangeShifts(input?: {
  query?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleChangeShiftOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to view schedule change shifts.",
      };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 50;
    const limit = Math.max(1, Math.min(limitRaw, 200));
    const query =
      typeof input?.query === "string" && input.query.trim()
        ? input.query.trim()
        : null;

    const rows = await db.shift.findMany({
      where: {
        isActive: true,
        ...(query
          ? {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      take: limit,
      select: scheduleChangeShiftSelect,
    });

    return {
      success: true,
      data: rows.map(toScheduleChangeShiftOption),
    };
  } catch (error) {
    console.error("Error listing schedule change shifts:", error);
    return { success: false, error: "Failed to load shifts." };
  }
}

export async function listScheduleChangeRequests(input?: {
  statuses?: ScheduleChangeRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow[];
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

    const where: Prisma.ScheduleChangeRequestWhereInput = {};

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
        error: "You are not allowed to view schedule change requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.scheduleChangeRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return {
      success: true,
      data: rows.map(serializeScheduleChangeRequest),
    };
  } catch (error) {
    console.error("Error listing schedule change requests:", error);
    return {
      success: false,
      error: "Failed to load schedule change requests.",
    };
  }
}

export async function listScheduleSwapRequests(input?: {
  statuses?: ScheduleSwapRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow[];
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

    const where: Prisma.ScheduleSwapRequestWhereInput = {};
    let viewerEmployeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      viewerEmployeeId = employee.employeeId;
      where.OR = [
        { requesterEmployeeId: employee.employeeId },
        { coworkerEmployeeId: employee.employeeId },
      ];
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.OR = [
          { requesterEmployeeId: employeeId },
          { coworkerEmployeeId: employeeId },
        ];
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view schedule swap requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.scheduleSwapRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return {
      success: true,
      data: rows.map((row) =>
        serializeScheduleSwapRequest(row, viewerEmployeeId),
      ),
    };
  } catch (error) {
    console.error("Error listing schedule swap requests:", error);
    return { success: false, error: "Failed to load schedule swap requests." };
  }
}
