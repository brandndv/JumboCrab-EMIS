import {
  SuspiciousAttendanceSeverity,
  SuspiciousAttendanceStatus,
  type PUNCH_TYPE,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  LOCATION_MISMATCH_RADIUS_METERS,
  clampSuspiciousTimeWindowMinutes,
  ensureAttendanceSecuritySettings,
  haversineDistanceMeters,
  normalizeDeviceToken,
  normalizeFingerprint,
  normalizeLatitude,
  normalizeLongitude,
  type AttendanceSecurityClient,
  type AttendanceSecurityPayload,
} from "./attendance-security-shared";

type DetectionMatch = {
  reason: string;
  severity: SuspiciousAttendanceSeverity;
  detectedByRule: string;
  details?: Prisma.InputJsonValue;
};

const isGpsRuleApplicable = (source?: string | null) => source !== "KIOSK";

const buildEmployeeDisplay = (employee?: {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}) => ({
  employeeId: employee?.employeeId ?? "",
  employeeCode: employee?.employeeCode ?? "",
  employeeName: [employee?.firstName, employee?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim(),
});

export async function captureAttendanceSecurityEvent(input: {
  attendanceId: string;
  punchId: string;
  employeeId: string;
  punchType: PUNCH_TYPE;
  punchTime: Date;
  source?: string | null;
  payload?: AttendanceSecurityPayload | null;
  client?: AttendanceSecurityClient;
}) {
  const client = input.client ?? db;
  const settings = await ensureAttendanceSecuritySettings(client);
  const suspiciousTimeWindowMinutes = clampSuspiciousTimeWindowMinutes(
    settings.suspiciousTimeWindowMinutes,
  );
  const windowStart = new Date(
    input.punchTime.getTime() - suspiciousTimeWindowMinutes * 60 * 1000,
  );

  const deviceToken = settings.deviceTokenTrackingEnabled
    ? normalizeDeviceToken(input.payload?.deviceToken)
    : null;
  const fingerprint = settings.fingerprintTrackingEnabled
    ? normalizeFingerprint(input.payload?.fingerprint)
    : null;
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

  let activeDeviceRegistrations: Array<{
    id: string;
    deviceToken: string | null;
    fingerprint: string | null;
  }> = [];
  let matchingRegistration:
    | {
        id: string;
        deviceToken: string | null;
        fingerprint: string | null;
        isActive: boolean;
      }
    | null = null;

  if (deviceToken || fingerprint) {
    activeDeviceRegistrations = await client.deviceRegistration.findMany({
      where: {
        employeeId: input.employeeId,
        isActive: true,
      },
      select: {
        id: true,
        deviceToken: true,
        fingerprint: true,
      },
    });

    if (deviceToken) {
      matchingRegistration = await client.deviceRegistration.findFirst({
        where: {
          employeeId: input.employeeId,
          deviceToken,
        },
        select: {
          id: true,
          deviceToken: true,
          fingerprint: true,
          isActive: true,
        },
      });
    }

    if (!matchingRegistration && fingerprint) {
      matchingRegistration = await client.deviceRegistration.findFirst({
        where: {
          employeeId: input.employeeId,
          fingerprint,
        },
        select: {
          id: true,
          deviceToken: true,
          fingerprint: true,
          isActive: true,
        },
      });
    }

    if (matchingRegistration) {
      await client.deviceRegistration.update({
        where: { id: matchingRegistration.id },
        data: {
          deviceToken,
          fingerprint,
          lastSeenAt: input.punchTime,
        },
      });
    } else {
      matchingRegistration = await client.deviceRegistration.create({
        data: {
          employeeId: input.employeeId,
          deviceToken,
          fingerprint,
          firstSeenAt: input.punchTime,
          lastSeenAt: input.punchTime,
          isActive:
            !settings.allowOnlyOneRegisteredDevicePerEmployee ||
            activeDeviceRegistrations.length === 0,
        },
        select: {
          id: true,
          deviceToken: true,
          fingerprint: true,
          isActive: true,
        },
      });
    }
  }

  if (deviceToken || fingerprint) {
    await client.punch.update({
      where: { id: input.punchId },
      data: {
        deviceId: deviceToken ?? fingerprint,
      },
    });
  }

  const deviceLog = await client.attendanceDeviceLog.create({
    data: {
      attendanceId: input.attendanceId,
      employeeId: input.employeeId,
      ipAddress,
      userAgent,
      deviceToken,
      fingerprint,
      latitude,
      longitude,
      createdAt: input.punchTime,
    },
  });

  const matches: DetectionMatch[] = [];

  if (deviceToken) {
    const otherRegistrations = await client.deviceRegistration.findMany({
      where: {
        deviceToken,
        employeeId: { not: input.employeeId },
      },
      select: {
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

    if (otherRegistrations.length > 0) {
      matches.push({
        reason:
          "Device token already appears on another employee account and needs review.",
        severity: SuspiciousAttendanceSeverity.HIGH,
        detectedByRule: "SHARED_DEVICE_TOKEN",
        details: {
          deviceToken,
          linkedEmployees: otherRegistrations.map((row) =>
            buildEmployeeDisplay(row.employee),
          ),
        },
      });
    }
  }

  if (fingerprint) {
    const recentFingerprintMatches = await client.attendanceDeviceLog.findMany({
      where: {
        id: { not: deviceLog.id },
        fingerprint,
        employeeId: { not: input.employeeId },
        createdAt: {
          gte: windowStart,
          lte: input.punchTime,
        },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["employeeId"],
      select: {
        createdAt: true,
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

    if (recentFingerprintMatches.length > 0) {
      matches.push({
        reason:
          "Browser fingerprint matched another employee within suspicious review window.",
        severity: SuspiciousAttendanceSeverity.MEDIUM,
        detectedByRule: "SHARED_FINGERPRINT_WINDOW",
        details: {
          fingerprint,
          suspiciousTimeWindowMinutes,
          matchingEmployees: recentFingerprintMatches.map((row) => ({
            ...buildEmployeeDisplay(row.employee),
            matchedAt: row.createdAt.toISOString(),
          })),
        },
      });
    }
  }

  if (deviceToken || fingerprint) {
    const recentRapidReuseMatches = await client.attendanceDeviceLog.findMany({
      where: {
        id: { not: deviceLog.id },
        employeeId: { not: input.employeeId },
        createdAt: {
          gte: windowStart,
          lte: input.punchTime,
        },
        OR: [
          ...(deviceToken ? [{ deviceToken }] : []),
          ...(fingerprint ? [{ fingerprint }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
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

    if (recentRapidReuseMatches.length > 0) {
      matches.push({
        reason:
          "Same browser or device submitted attendance for multiple employees within suspicious review window.",
        severity: SuspiciousAttendanceSeverity.HIGH,
        detectedByRule: "RAPID_MULTI_EMPLOYEE_DEVICE_REUSE",
        details: {
          deviceToken,
          fingerprint,
          suspiciousTimeWindowMinutes,
          recentPunches: recentRapidReuseMatches.map((row) => ({
            ...buildEmployeeDisplay(row.employee),
            matchedAt: row.createdAt.toISOString(),
          })),
        },
      });
    }
  }

  if (settings.gpsValidationEnabled && isGpsRuleApplicable(input.source)) {
    if (latitude == null || longitude == null) {
      matches.push({
        reason:
          "Location data was missing while GPS validation is enabled for attendance review.",
        severity: SuspiciousAttendanceSeverity.MEDIUM,
        detectedByRule: "MISSING_REQUIRED_LOCATION",
        details: {
          gpsValidationEnabled: true,
          latitude,
          longitude,
        },
      });
    } else if (deviceToken || fingerprint) {
      const recentLocationMatch = await client.attendanceDeviceLog.findFirst({
        where: {
          id: { not: deviceLog.id },
          createdAt: {
            gte: windowStart,
            lte: input.punchTime,
          },
          latitude: { not: null },
          longitude: { not: null },
          OR: [
            ...(deviceToken ? [{ deviceToken }] : []),
            ...(fingerprint ? [{ fingerprint }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          latitude: true,
          longitude: true,
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

      const previousLatitude = recentLocationMatch
        ? Number(recentLocationMatch.latitude)
        : null;
      const previousLongitude = recentLocationMatch
        ? Number(recentLocationMatch.longitude)
        : null;

      if (
        recentLocationMatch &&
        previousLatitude != null &&
        previousLongitude != null
      ) {
        const distanceMeters = haversineDistanceMeters({
          fromLatitude: previousLatitude,
          fromLongitude: previousLongitude,
          toLatitude: latitude,
          toLongitude: longitude,
        });

        if (distanceMeters > LOCATION_MISMATCH_RADIUS_METERS) {
          matches.push({
            reason:
              "Current GPS location is far from recent same-device attendance activity.",
            severity: SuspiciousAttendanceSeverity.MEDIUM,
            detectedByRule: "LOCATION_MISMATCH",
            details: {
              suspiciousTimeWindowMinutes,
              distanceMeters,
              previousPunchAt: recentLocationMatch.createdAt.toISOString(),
              previousEmployee: buildEmployeeDisplay(recentLocationMatch.employee),
              previousLatitude,
              previousLongitude,
              currentLatitude: latitude,
              currentLongitude: longitude,
            },
          });
        }
      }
    }
  }

  if (matchingRegistration && !matchingRegistration.isActive) {
    const priorInactiveUses = await client.attendanceDeviceLog.count({
      where: {
        id: { not: deviceLog.id },
        employeeId: input.employeeId,
        OR: [
          ...(deviceToken ? [{ deviceToken }] : []),
          ...(fingerprint ? [{ fingerprint }] : []),
        ],
      },
    });

    matches.push({
      reason:
        priorInactiveUses > 0
          ? "Inactive or unregistered device was used again and needs manager review."
          : "Inactive or unregistered device was used for attendance.",
      severity: SuspiciousAttendanceSeverity.MEDIUM,
      detectedByRule:
        priorInactiveUses > 0
          ? "REPEATED_INACTIVE_DEVICE_USE"
          : "INACTIVE_DEVICE_USE",
      details: {
        registrationId: matchingRegistration.id,
        priorInactiveUses,
      },
    });
  }

  if (
    settings.allowOnlyOneRegisteredDevicePerEmployee &&
    matchingRegistration &&
    !matchingRegistration.isActive &&
    activeDeviceRegistrations.some(
      (registration) => registration.id !== matchingRegistration?.id,
    )
  ) {
    matches.push({
      reason:
        "Employee already has another active registered device while single-device policy is enabled.",
      severity: SuspiciousAttendanceSeverity.HIGH,
      detectedByRule: "SINGLE_ACTIVE_DEVICE_POLICY",
      details: {
        registrationId: matchingRegistration.id,
        activeRegistrations: activeDeviceRegistrations.map((registration) => ({
          id: registration.id,
          deviceToken: registration.deviceToken,
          fingerprint: registration.fingerprint,
        })),
      },
    });
  }

  if (matches.length === 0) {
    return {
      flagged: false,
      reasons: [] as string[],
      suspiciousLogIds: [] as string[],
      deviceLogId: deviceLog.id,
      status: null,
    };
  }

  await client.attendance.update({
    where: { id: input.attendanceId },
    data: {
      isFlagged: true,
      flaggedAt: input.punchTime,
    },
  });

  await client.attendanceDeviceLog.update({
    where: { id: deviceLog.id },
    data: { isFlagged: true },
  });

  const autoReviewed = !settings.requireManagerReviewForFlaggedLogs;
  const suspiciousLogs = await Promise.all(
    matches.map((match) =>
      client.suspiciousAttendanceLog.create({
        data: {
          attendanceId: input.attendanceId,
          deviceLogId: deviceLog.id,
          employeeId: input.employeeId,
          reason: match.reason,
          severity: match.severity,
          detectedByRule: match.detectedByRule,
          status: autoReviewed
            ? SuspiciousAttendanceStatus.REVIEWED
            : SuspiciousAttendanceStatus.PENDING,
          reviewedAt: autoReviewed ? input.punchTime : null,
          remarks: autoReviewed
            ? "Auto-reviewed because manager review is disabled in attendance settings."
            : null,
          details: match.details,
          createdAt: input.punchTime,
        },
        select: {
          id: true,
          status: true,
        },
      }),
    ),
  );

  return {
    flagged: true,
    reasons: matches.map((match) => match.reason),
    suspiciousLogIds: suspiciousLogs.map((row) => row.id),
    deviceLogId: deviceLog.id,
    status: suspiciousLogs[0]?.status ?? null,
  };
}
