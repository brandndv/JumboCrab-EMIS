import { headers } from "next/headers";
import { Prisma, Roles, type AttendanceSecuritySetting } from "@prisma/client";
import { db } from "@/lib/db";

export const ATTENDANCE_SECURITY_SETTINGS_ID = "default";

export const DEFAULT_ATTENDANCE_SECURITY_SETTINGS = {
  gpsValidationEnabled: false,
  faceRecognitionEnabled: false,
  faceRequiredForQrPunch: false,
  faceLivenessRequired: true,
  faceMatchMaxDistance: 0.5,
  faceFailureMode: "BLOCK",
} as const;

export type AttendanceSecurityClient = Prisma.TransactionClient | typeof db;

export type AttendanceSecurityPayload = {
  ipAddress?: string | null;
  userAgent?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const canManageAttendanceSecuritySettings = (role?: Roles) =>
  role === Roles.Admin;

const normalizeCoordinate = (
  value: number | null | undefined,
  min: number,
  max: number,
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
};

export const normalizeLatitude = (value: number | null | undefined) =>
  normalizeCoordinate(value, -90, 90);

export const normalizeLongitude = (value: number | null | undefined) =>
  normalizeCoordinate(value, -180, 180);

export const resolveAttendanceRequestMetadata = async () => {
  const hdr = await headers();

  return {
    ipAddress:
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null,
    userAgent: hdr.get("user-agent") || null,
  };
};

export const ensureAttendanceSecuritySettings = async (
  client: AttendanceSecurityClient = db,
) =>
  client.attendanceSecuritySetting.upsert({
    where: { id: ATTENDANCE_SECURITY_SETTINGS_ID },
    update: {},
    create: {
      id: ATTENDANCE_SECURITY_SETTINGS_ID,
      ...DEFAULT_ATTENDANCE_SECURITY_SETTINGS,
    },
  });

export const serializeAttendanceSecuritySettings = (
  row: AttendanceSecuritySetting,
) => ({
  id: row.id,
  gpsValidationEnabled: row.gpsValidationEnabled,
  faceRecognitionEnabled: row.faceRecognitionEnabled,
  faceRequiredForQrPunch: row.faceRequiredForQrPunch,
  faceLivenessRequired: row.faceLivenessRequired,
  faceMatchMaxDistance: Number(row.faceMatchMaxDistance),
  faceFailureMode: row.faceFailureMode,
  updatedByUserId: row.updatedByUserId ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeAttendanceSecurityClientConfig = (
  row: AttendanceSecuritySetting,
) => ({
  gpsValidationEnabled: row.gpsValidationEnabled,
  faceRecognitionEnabled: row.faceRecognitionEnabled,
  faceRequiredForQrPunch: row.faceRequiredForQrPunch,
  faceLivenessRequired: row.faceLivenessRequired,
  faceMatchMaxDistance: Number(row.faceMatchMaxDistance),
  faceFailureMode: row.faceFailureMode,
});
