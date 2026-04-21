"use server";

import { getSession } from "@/lib/auth";
import {
  canManageAttendanceSecuritySettings,
  ensureAttendanceSecuritySettings,
  serializeAttendanceSecurityClientConfig,
  serializeAttendanceSecuritySettings,
} from "./attendance-security-shared";

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
