import { headers } from "next/headers";
import {
  Prisma,
  Roles,
  SuspiciousAttendanceStatus,
  type AttendanceDeviceLog,
  type AttendanceSecuritySetting,
  type DeviceRegistration,
  type SuspiciousAttendanceLog,
} from "@prisma/client";
import { db } from "@/lib/db";
import { toNumberOrNull } from "./attendance-helpers-shared";

export const ATTENDANCE_SECURITY_SETTINGS_ID = "default";
export const LOCATION_MISMATCH_RADIUS_METERS = 250;

export const DEFAULT_ATTENDANCE_SECURITY_SETTINGS = {
  deviceTokenTrackingEnabled: true,
  fingerprintTrackingEnabled: true,
  gpsValidationEnabled: false,
  suspiciousTimeWindowMinutes: 3,
  allowOnlyOneRegisteredDevicePerEmployee: false,
  requireManagerReviewForFlaggedLogs: true,
} as const;

export type AttendanceSecurityClient = Prisma.TransactionClient | typeof db;

export type AttendanceSecurityReviewDecision =
  | "VALID"
  | "SUSPICIOUS"
  | "REJECTED";

export type AttendanceSecurityPayload = {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceToken?: string | null;
  fingerprint?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const canViewSuspiciousAttendanceLogs = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

export const canReviewSuspiciousAttendanceLogs = (role?: Roles) =>
  canViewSuspiciousAttendanceLogs(role);

export const canManageAttendanceSecuritySettings = (role?: Roles) =>
  role === Roles.Admin;

export const canViewEmployeeDeviceRegistrations = (role?: Roles) =>
  role === Roles.Admin ||
  role === Roles.Manager ||
  role === Roles.GeneralManager ||
  role === Roles.Employee;

export const clampSuspiciousTimeWindowMinutes = (value: number) =>
  Math.max(1, Math.min(3, Math.round(value)));

export const normalizeDeviceToken = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 191);
};

export const normalizeFingerprint = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 191);
};

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
  deviceTokenTrackingEnabled: row.deviceTokenTrackingEnabled,
  fingerprintTrackingEnabled: row.fingerprintTrackingEnabled,
  gpsValidationEnabled: row.gpsValidationEnabled,
  suspiciousTimeWindowMinutes: row.suspiciousTimeWindowMinutes,
  allowOnlyOneRegisteredDevicePerEmployee:
    row.allowOnlyOneRegisteredDevicePerEmployee,
  requireManagerReviewForFlaggedLogs: row.requireManagerReviewForFlaggedLogs,
  updatedByUserId: row.updatedByUserId ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeAttendanceSecurityClientConfig = (
  row: AttendanceSecuritySetting,
) => ({
  deviceTokenTrackingEnabled: row.deviceTokenTrackingEnabled,
  fingerprintTrackingEnabled: row.fingerprintTrackingEnabled,
  gpsValidationEnabled: row.gpsValidationEnabled,
  suspiciousTimeWindowMinutes: row.suspiciousTimeWindowMinutes,
});

export const serializeDeviceRegistration = (
  row: DeviceRegistration & {
    employee?: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null;
  },
) => ({
  id: row.id,
  employeeId: row.employeeId,
  deviceToken: row.deviceToken ?? null,
  fingerprint: row.fingerprint ?? null,
  deviceLabel: row.deviceLabel ?? null,
  firstSeenAt: row.firstSeenAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  employee: row.employee
    ? {
        employeeId: row.employee.employeeId,
        employeeCode: row.employee.employeeCode,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
      }
    : null,
});

export const serializeAttendanceDeviceLog = (
  row: AttendanceDeviceLog & {
    employee?: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null;
  },
) => ({
  id: row.id,
  attendanceId: row.attendanceId,
  employeeId: row.employeeId,
  ipAddress: row.ipAddress ?? null,
  userAgent: row.userAgent ?? null,
  deviceToken: row.deviceToken ?? null,
  fingerprint: row.fingerprint ?? null,
  latitude: toNumberOrNull(row.latitude),
  longitude: toNumberOrNull(row.longitude),
  isFlagged: row.isFlagged,
  createdAt: row.createdAt.toISOString(),
  employee: row.employee
    ? {
        employeeId: row.employee.employeeId,
        employeeCode: row.employee.employeeCode,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
      }
    : null,
});

export const serializeSuspiciousAttendanceLog = (
  row: SuspiciousAttendanceLog & {
    employee?: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null;
    reviewedBy?: {
      userId: string;
      username: string;
    } | null;
    attendance?: {
      id: string;
      workDate: Date;
      status: string;
      actualInAt: Date | null;
      actualOutAt: Date | null;
      isFlagged: boolean;
    } | null;
    deviceLog?: (AttendanceDeviceLog & {
      employee?: {
        employeeId: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
      } | null;
    }) | null;
  },
) => ({
  id: row.id,
  attendanceId: row.attendanceId ?? null,
  deviceLogId: row.deviceLogId ?? null,
  employeeId: row.employeeId,
  reason: row.reason,
  severity: row.severity,
  detectedByRule: row.detectedByRule,
  status: row.status,
  reviewedByUserId: row.reviewedByUserId ?? null,
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  remarks: row.remarks ?? null,
  details: row.details ?? null,
  createdAt: row.createdAt.toISOString(),
  employee: row.employee
    ? {
        employeeId: row.employee.employeeId,
        employeeCode: row.employee.employeeCode,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
      }
    : null,
  reviewedBy: row.reviewedBy
    ? {
        userId: row.reviewedBy.userId,
        username: row.reviewedBy.username,
      }
    : null,
  attendance: row.attendance
    ? {
        id: row.attendance.id,
        workDate: row.attendance.workDate.toISOString(),
        status: row.attendance.status,
        actualInAt: row.attendance.actualInAt?.toISOString() ?? null,
        actualOutAt: row.attendance.actualOutAt?.toISOString() ?? null,
        isFlagged: row.attendance.isFlagged,
      }
    : null,
  deviceLog: row.deviceLog ? serializeAttendanceDeviceLog(row.deviceLog) : null,
});

export const formatSuspiciousAttendanceStatus = (
  status: SuspiciousAttendanceStatus,
) => {
  if (status === SuspiciousAttendanceStatus.REVIEWED) {
    return "Suspicious";
  }

  return status
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

export const mapReviewDecisionToStatus = (
  decision: AttendanceSecurityReviewDecision,
) => {
  if (decision === "VALID") return SuspiciousAttendanceStatus.VALID;
  if (decision === "REJECTED") return SuspiciousAttendanceStatus.REJECTED;
  return SuspiciousAttendanceStatus.REVIEWED;
};

export const hashPreview = (value?: string | null, visible = 8) => {
  if (!value) return "—";
  if (value.length <= visible) return value;
  return `${value.slice(0, visible)}…`;
};

export const haversineDistanceMeters = (input: {
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
}) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(input.toLatitude - input.fromLatitude);
  const dLon = toRadians(input.toLongitude - input.fromLongitude);
  const fromLat = toRadians(input.fromLatitude);
  const toLat = toRadians(input.toLatitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(fromLat) *
      Math.cos(toLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
};
