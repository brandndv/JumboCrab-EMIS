"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ATTENDANCE_SECURITY_SETTINGS_ID,
  canManageAttendanceSecuritySettings,
  serializeAttendanceSecuritySettings,
} from "./attendance-security-shared";

const revalidateAttendanceSecurityPaths = () => {
  [
    "/admin/attendance/history",
    "/admin/attendance/settings",
    "/manager/attendance/history",
  ].forEach((path) => {
    revalidatePath(path);
  });
};

export async function updateAttendanceSecuritySettings(input: {
  gpsValidationEnabled: boolean;
  faceRecognitionEnabled?: boolean;
  faceRequiredForQrPunch?: boolean;
  faceLivenessRequired?: boolean;
  faceMatchMaxDistance?: number;
  faceFailureMode?: string;
}) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageAttendanceSecuritySettings(session.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const data = {
      gpsValidationEnabled: Boolean(input.gpsValidationEnabled),
      faceRecognitionEnabled: Boolean(input.faceRecognitionEnabled),
      faceRequiredForQrPunch: Boolean(input.faceRequiredForQrPunch),
      faceLivenessRequired: input.faceLivenessRequired !== false,
      faceMatchMaxDistance: Math.max(
        0.45,
        Math.min(0.6, Number(input.faceMatchMaxDistance) || 0.5),
      ),
      faceFailureMode:
        typeof input.faceFailureMode === "string" &&
        input.faceFailureMode.toUpperCase() === "FLAG"
          ? "FLAG"
          : "BLOCK",
      updatedByUserId: session.userId ?? null,
    };

    const row = await db.attendanceSecuritySetting.upsert({
      where: { id: ATTENDANCE_SECURITY_SETTINGS_ID },
      update: data,
      create: {
        id: ATTENDANCE_SECURITY_SETTINGS_ID,
        ...data,
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
