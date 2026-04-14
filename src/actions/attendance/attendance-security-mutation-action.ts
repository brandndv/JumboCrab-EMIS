"use server";

import { revalidatePath } from "next/cache";
import { SuspiciousAttendanceStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ATTENDANCE_SECURITY_SETTINGS_ID,
  canManageAttendanceSecuritySettings,
  canReviewSuspiciousAttendanceLogs,
  clampSuspiciousTimeWindowMinutes,
  ensureAttendanceSecuritySettings,
  mapReviewDecisionToStatus,
  serializeAttendanceSecuritySettings,
  type AttendanceSecurityReviewDecision,
} from "./attendance-security-shared";

const revalidateAttendanceSecurityPaths = () => {
  [
    "/admin/attendance/history",
    "/admin/attendance/suspicious",
    "/admin/attendance/settings",
    "/manager/attendance/history",
    "/manager/attendance/suspicious",
  ].forEach((path) => {
    revalidatePath(path);
  });
};

export async function updateAttendanceSecuritySettings(input: {
  deviceTokenTrackingEnabled: boolean;
  fingerprintTrackingEnabled: boolean;
  gpsValidationEnabled: boolean;
  suspiciousTimeWindowMinutes: number;
  allowOnlyOneRegisteredDevicePerEmployee: boolean;
  requireManagerReviewForFlaggedLogs: boolean;
}) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageAttendanceSecuritySettings(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const row = await db.attendanceSecuritySetting.upsert({
      where: { id: ATTENDANCE_SECURITY_SETTINGS_ID },
      update: {
        deviceTokenTrackingEnabled: Boolean(input.deviceTokenTrackingEnabled),
        fingerprintTrackingEnabled: Boolean(input.fingerprintTrackingEnabled),
        gpsValidationEnabled: Boolean(input.gpsValidationEnabled),
        suspiciousTimeWindowMinutes: clampSuspiciousTimeWindowMinutes(
          Number(input.suspiciousTimeWindowMinutes),
        ),
        allowOnlyOneRegisteredDevicePerEmployee: Boolean(
          input.allowOnlyOneRegisteredDevicePerEmployee,
        ),
        requireManagerReviewForFlaggedLogs: Boolean(
          input.requireManagerReviewForFlaggedLogs,
        ),
        updatedByUserId: session.userId ?? null,
      },
      create: {
        id: ATTENDANCE_SECURITY_SETTINGS_ID,
        deviceTokenTrackingEnabled: Boolean(input.deviceTokenTrackingEnabled),
        fingerprintTrackingEnabled: Boolean(input.fingerprintTrackingEnabled),
        gpsValidationEnabled: Boolean(input.gpsValidationEnabled),
        suspiciousTimeWindowMinutes: clampSuspiciousTimeWindowMinutes(
          Number(input.suspiciousTimeWindowMinutes),
        ),
        allowOnlyOneRegisteredDevicePerEmployee: Boolean(
          input.allowOnlyOneRegisteredDevicePerEmployee,
        ),
        requireManagerReviewForFlaggedLogs: Boolean(
          input.requireManagerReviewForFlaggedLogs,
        ),
        updatedByUserId: session.userId ?? null,
      },
    });

    revalidateAttendanceSecurityPaths();

    return {
      success: true,
      data: serializeAttendanceSecuritySettings(row),
    };
  } catch (error) {
    console.error("Failed to update attendance security settings", error);
    return {
      success: false,
      error: "Failed to update attendance security settings",
    };
  }
}

export async function reviewSuspiciousAttendanceLog(input: {
  id: string;
  decision: AttendanceSecurityReviewDecision;
  remarks?: string | null;
}) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewSuspiciousAttendanceLogs(session.role)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!session.userId) {
      return { success: false, error: "Reviewer account is missing a user ID" };
    }

    const logId = typeof input.id === "string" ? input.id.trim() : "";
    const decision =
      typeof input.decision === "string" ? input.decision.trim().toUpperCase() : "";
    const remarks =
      typeof input.remarks === "string" ? input.remarks.trim() : "";

    if (!logId) {
      return { success: false, error: "Suspicious log ID is required" };
    }
    if (!["VALID", "SUSPICIOUS", "REJECTED"].includes(decision)) {
      return { success: false, error: "Invalid review decision" };
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.suspiciousAttendanceLog.findUnique({
        where: { id: logId },
        include: {
          deviceLog: true,
        },
      });

      if (!row) {
        throw new Error("Suspicious log not found");
      }

      const nextStatus = mapReviewDecisionToStatus(
        decision as AttendanceSecurityReviewDecision,
      );

      const result = await tx.suspiciousAttendanceLog.update({
        where: { id: logId },
        data: {
          status: nextStatus,
          remarks: remarks || null,
          reviewedAt: new Date(),
          reviewedByUserId: session.userId,
        },
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

      if (nextStatus === SuspiciousAttendanceStatus.VALID && row.deviceLog) {
        const settings = await ensureAttendanceSecuritySettings(tx);
        const registration =
          (row.deviceLog.deviceToken
            ? await tx.deviceRegistration.findFirst({
                where: {
                  employeeId: row.employeeId,
                  deviceToken: row.deviceLog.deviceToken,
                },
              })
            : null) ||
          (row.deviceLog.fingerprint
            ? await tx.deviceRegistration.findFirst({
                where: {
                  employeeId: row.employeeId,
                  fingerprint: row.deviceLog.fingerprint,
                },
              })
            : null);

        const nextRegistration = registration
          ? await tx.deviceRegistration.update({
              where: { id: registration.id },
              data: {
                isActive: true,
                lastSeenAt: row.deviceLog.createdAt,
              },
            })
          : await tx.deviceRegistration.create({
              data: {
                employeeId: row.employeeId,
                deviceToken: row.deviceLog.deviceToken,
                fingerprint: row.deviceLog.fingerprint,
                firstSeenAt: row.deviceLog.createdAt,
                lastSeenAt: row.deviceLog.createdAt,
                isActive: true,
              },
            });

        if (settings.allowOnlyOneRegisteredDevicePerEmployee) {
          await tx.deviceRegistration.updateMany({
            where: {
              employeeId: row.employeeId,
              id: { not: nextRegistration.id },
            },
            data: {
              isActive: false,
            },
          });
        }
      }

      return result;
    });

    revalidateAttendanceSecurityPaths();

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Failed to review suspicious attendance log", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to review suspicious attendance log",
    };
  }
}
