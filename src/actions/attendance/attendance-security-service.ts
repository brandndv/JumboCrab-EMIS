import { db } from "@/lib/db";
import {
  normalizeLatitude,
  normalizeLongitude,
  type AttendanceSecurityClient,
  type AttendanceSecurityPayload,
} from "./attendance-security-shared";

export async function captureAttendanceSecurityEvent(input: {
  attendanceId: string;
  employeeId: string;
  punchTime: Date;
  payload?: AttendanceSecurityPayload | null;
  client?: AttendanceSecurityClient;
}) {
  const client = input.client ?? db;
  const latitude = normalizeLatitude(input.payload?.latitude);
  const longitude = normalizeLongitude(input.payload?.longitude);
  const ipAddress =
    typeof input.payload?.ipAddress === "string" &&
    input.payload.ipAddress.trim().length > 0
      ? input.payload.ipAddress.trim().slice(0, 191)
      : null;
  const userAgent =
    typeof input.payload?.userAgent === "string" &&
    input.payload.userAgent.trim().length > 0
      ? input.payload.userAgent.trim().slice(0, 1000)
      : null;

  const contextLog = await client.attendanceContextLog.create({
    data: {
      attendanceId: input.attendanceId,
      employeeId: input.employeeId,
      ipAddress,
      userAgent,
      latitude,
      longitude,
      createdAt: input.punchTime,
    },
  });

  return {
    contextLogId: contextLog.id,
  };
}
