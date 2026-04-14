"use server";

import {
  Prisma,
  Roles,
  SuspiciousAttendanceSeverity,
  SuspiciousAttendanceStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { endOfZonedDay, startOfZonedDay } from "@/lib/timezone";
import {
  canManageAttendanceSecuritySettings,
  canViewEmployeeDeviceRegistrations,
  canViewSuspiciousAttendanceLogs,
  ensureAttendanceSecuritySettings,
  serializeAttendanceSecurityClientConfig,
  serializeAttendanceSecuritySettings,
  serializeDeviceRegistration,
  serializeSuspiciousAttendanceLog,
} from "./attendance-security-shared";

const parseDateInput = (value?: string | null) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function getAttendanceSecuritySettings() {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageAttendanceSecuritySettings(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const settings = await ensureAttendanceSecuritySettings();
    return {
      success: true,
      data: serializeAttendanceSecuritySettings(settings),
    };
  } catch (error) {
    console.error("Failed to load attendance security settings", error);
    return {
      success: false,
      error: "Failed to load attendance security settings",
    };
  }
}

export async function getAttendancePunchClientConfig() {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Unauthorized" };
    }

    const settings = await ensureAttendanceSecuritySettings();
    return {
      success: true,
      data: serializeAttendanceSecurityClientConfig(settings),
    };
  } catch (error) {
    console.error("Failed to load attendance punch security config", error);
    return {
      success: false,
      error: "Failed to load attendance punch security config",
    };
  }
}

export async function listSuspiciousAttendanceLogs(input?: {
  start?: string | null;
  end?: string | null;
  query?: string | null;
  employeeId?: string | null;
  status?: string | null;
  severity?: string | null;
}) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canViewSuspiciousAttendanceLogs(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const start = parseDateInput(input?.start);
    const end = parseDateInput(input?.end);
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId.trim() : "";
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const requestedStatus =
      typeof input?.status === "string" ? input.status.trim().toUpperCase() : "";
    const requestedSeverity =
      typeof input?.severity === "string"
        ? input.severity.trim().toUpperCase()
        : "";

    const where: Prisma.SuspiciousAttendanceLogWhereInput = {};

    if (start || end) {
      where.createdAt = {
        ...(start ? { gte: startOfZonedDay(start) } : {}),
        ...(end ? { lt: endOfZonedDay(end) } : {}),
      };
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (requestedStatus) {
      const normalizedStatus =
        requestedStatus === "SUSPICIOUS" ? "REVIEWED" : requestedStatus;
      if (
        Object.values(SuspiciousAttendanceStatus).includes(
          normalizedStatus as SuspiciousAttendanceStatus,
        )
      ) {
        where.status = normalizedStatus as SuspiciousAttendanceStatus;
      }
    }

    if (
      requestedSeverity &&
      Object.values(SuspiciousAttendanceSeverity).includes(
        requestedSeverity as SuspiciousAttendanceSeverity,
      )
    ) {
      where.severity = requestedSeverity as SuspiciousAttendanceSeverity;
    }

    if (queryTokens.length > 0) {
      where.employee = {
        is: {
          AND: queryTokens.map((token) => ({
            OR: [
              { employeeCode: { contains: token, mode: "insensitive" } },
              { firstName: { contains: token, mode: "insensitive" } },
              { middleName: { contains: token, mode: "insensitive" } },
              { lastName: { contains: token, mode: "insensitive" } },
            ],
          })),
        },
      };
    }

    const rows = await db.suspiciousAttendanceLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            userId: true,
            username: true,
          },
        },
        attendance: {
          select: {
            id: true,
            workDate: true,
            status: true,
            actualInAt: true,
            actualOutAt: true,
            isFlagged: true,
          },
        },
        deviceLog: {
          include: {
            employee: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: rows.map((row) => serializeSuspiciousAttendanceLog(row)),
    };
  } catch (error) {
    console.error("Failed to list suspicious attendance logs", error);
    return {
      success: false,
      error: "Failed to load suspicious attendance logs",
    };
  }
}

export async function getSuspiciousAttendanceLogDetail(id: string) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canViewSuspiciousAttendanceLogs(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const logId = typeof id === "string" ? id.trim() : "";
    if (!logId) {
      return { success: false, error: "Suspicious log ID is required" };
    }

    const row = await db.suspiciousAttendanceLog.findUnique({
      where: { id: logId },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            userId: true,
            username: true,
          },
        },
        attendance: {
          select: {
            id: true,
            workDate: true,
            status: true,
            actualInAt: true,
            actualOutAt: true,
            isFlagged: true,
          },
        },
        deviceLog: {
          include: {
            employee: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return { success: false, error: "Suspicious log not found" };
    }

    const relatedLogs = row.attendanceId
      ? await db.suspiciousAttendanceLog.findMany({
          where: {
            attendanceId: row.attendanceId,
          },
          orderBy: [{ createdAt: "desc" }],
          include: {
            employee: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
            reviewedBy: {
              select: {
                userId: true,
                username: true,
              },
            },
          },
        })
      : [];

    return {
      success: true,
      data: {
        ...serializeSuspiciousAttendanceLog(row),
        relatedLogs: relatedLogs.map((log) => serializeSuspiciousAttendanceLog(log)),
      },
    };
  } catch (error) {
    console.error("Failed to load suspicious attendance log detail", error);
    return {
      success: false,
      error: "Failed to load suspicious attendance log detail",
    };
  }
}

export async function listEmployeeDeviceRegistrations(employeeId: string) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canViewEmployeeDeviceRegistrations(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const targetEmployeeId =
      typeof employeeId === "string" ? employeeId.trim() : "";
    if (!targetEmployeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    if (session.role === Roles.Employee) {
      if (!session.userId) {
        return { success: false, error: "Unauthorized" };
      }

      const ownedEmployee = await db.employee.findUnique({
        where: { userId: session.userId },
        select: { employeeId: true },
      });

      if (!ownedEmployee || ownedEmployee.employeeId !== targetEmployeeId) {
        return { success: false, error: "Unauthorized" };
      }
    }

    const rows = await db.deviceRegistration.findMany({
      where: { employeeId: targetEmployeeId },
      orderBy: [{ isActive: "desc" }, { lastSeenAt: "desc" }],
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      success: true,
      data: rows.map((row) => serializeDeviceRegistration(row)),
    };
  } catch (error) {
    console.error("Failed to list employee device registrations", error);
    return {
      success: false,
      error: "Failed to load registered devices",
    };
  }
}
