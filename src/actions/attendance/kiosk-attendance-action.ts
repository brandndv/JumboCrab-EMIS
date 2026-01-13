"use server";

import { headers } from "next/headers";
import { PUNCH_TYPE } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import {
  createPunchAndMaybeRecompute,
  getExpectedShiftForDate,
} from "@/lib/attendance";
import { endOfZonedDay, startOfZonedDay, zonedNow } from "@/lib/timezone";

const isIpAllowed = (ip: string | null) => {
  const raw = process.env.ALLOWED_PUNCH_IPS;
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return Boolean(ip && list.includes(ip));
};

const serializePunch = (punch: { punchTime: Date; punchType: string }) => ({
  punchTime: punch.punchTime.toISOString(),
  punchType: punch.punchType,
});

const serializePunchNullable = (
  punch: { punchTime: Date; punchType: string } | null
) => (punch ? serializePunch(punch) : null);

const computeBreakStats = (
  punches: Array<{ punchTime: Date; punchType: string }>
) => {
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;
  punches.forEach((p) => {
    if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
      if (!breakStart) {
        breakStart = p.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(
          0,
          Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000)
        );
        breakStart = null;
      }
    }
  });
  return { breakCount, breakMinutes };
};

export async function searchKioskUsers(input?: { query?: string }) {
  try {
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const matches = await db.user.findMany({
      where: {
        ...(query ? { username: { contains: query, mode: "insensitive" } } : {}),
        isDisabled: false,
        employee: { isNot: null },
      },
      select: {
        username: true,
        role: true,
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { username: "asc" },
      take: 10,
    });

    return { success: true, data: matches };
  } catch (error) {
    console.error("Failed to load kiosk suggestions", error);
    return { success: false, error: "Failed to load suggestions" };
  }
}

export async function getKioskStatus(input: {
  username: string;
  date?: string;
}) {
  try {
    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const dateParam = typeof input.date === "string" ? input.date : null;

    if (!username) {
      return { success: false, error: "username is required" };
    }

    const user = await db.user.findUnique({
      where: { username },
      select: {
        userId: true,
        username: true,
        role: true,
        isDisabled: true,
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });

    if (!user || user.isDisabled || !user.employee) {
      return { success: false, error: "User not eligible", reason: "user_not_eligible" };
    }

    const now = zonedNow();
    const dayInput = dateParam ? `${dateParam}T00:00:00+08:00` : null;
    const baseDate = dayInput ? new Date(dayInput) : now;
    if (Number.isNaN(baseDate.getTime())) {
      return { success: false, error: "Invalid date", reason: "invalid_date" };
    }
    const dayStart = startOfZonedDay(baseDate);
    const dayEnd = endOfZonedDay(baseDate);

    const expected = await getExpectedShiftForDate(
      user.employee.employeeId,
      dayStart
    );
    const punches = await db.punch.findMany({
      where: {
        employeeId: user.employee.employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: "asc" },
      select: { punchTime: true, punchType: true },
    });
    const lastPunch = punches[punches.length - 1] ?? null;
    const breakStats = computeBreakStats(punches);

    return {
      success: true,
      data: {
        user: { username: user.username, role: user.role },
        employee: user.employee,
        expected: {
          start: expected.scheduledStartMinutes,
          end: expected.scheduledEndMinutes,
          shiftName: expected.shift?.name ?? null,
          source: expected.source,
        },
        punches: punches.map((p) => serializePunch(p)),
        lastPunch: serializePunchNullable(lastPunch),
        breakCount: breakStats.breakCount,
        breakMinutes: breakStats.breakMinutes,
      },
    };
  } catch (error) {
    console.error("Failed to load kiosk status", error);
    return { success: false, error: "Failed to load status" };
  }
}

export async function recordKioskPunch(input: {
  username: string;
  password: string;
  punchType: string;
  date?: string;
}): Promise<{
  success: boolean;
  data?: { punch: { punchTime: string; punchType: string } };
  error?: string;
  reason?: string;
}> {
  try {
    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isIpAllowed(clientIp)) {
      return {
        success: false,
        error: "Punching not allowed from this device",
        reason: "ip_not_allowed",
      };
    }

    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const punchType =
      typeof input.punchType === "string" ? input.punchType : "";
    const dateParam = typeof input.date === "string" ? input.date : null;

    if (!username || !password) {
      return {
        success: false,
        error: "username and password are required",
        reason: "missing_credentials",
      };
    }

    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return {
        success: false,
        error: "Invalid punchType",
        reason: "invalid_punch_type",
      };
    }

    const user = await db.user.findUnique({
      where: { username },
      select: {
        userId: true,
        username: true,
        role: true,
        isDisabled: true,
        password: true,
        salt: true,
        employee: { select: { employeeId: true } },
      },
    });

    if (!user || user.isDisabled || !user.employee) {
      return {
        success: false,
        error: "User not eligible",
        reason: "user_not_eligible",
      };
    }

    const valid = await verifyPassword(password, user.password, user.salt);
    if (!valid) {
      return {
        success: false,
        error: "Invalid credentials",
        reason: "invalid_credentials",
      };
    }

    const now = zonedNow();
    const dayInput = dateParam ? `${dateParam}T00:00:00+08:00` : null;
    const baseDate = dayInput ? new Date(dayInput) : now;
    if (Number.isNaN(baseDate.getTime())) {
      return { success: false, error: "Invalid date", reason: "invalid_date" };
    }
    const dayStart = startOfZonedDay(baseDate);
    const dayEnd = endOfZonedDay(baseDate);

    const punchesToday = await db.punch.findMany({
      where: {
        employeeId: user.employee.employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: "asc" },
    });
    const lastType = punchesToday[punchesToday.length - 1]
      ?.punchType as PUNCH_TYPE | undefined;
    const allowedNext: Record<PUNCH_TYPE | "NONE", PUNCH_TYPE> = {
      NONE: PUNCH_TYPE.TIME_IN,
      TIME_OUT: PUNCH_TYPE.TIME_OUT,
      TIME_IN: PUNCH_TYPE.BREAK_IN,
      BREAK_IN: PUNCH_TYPE.BREAK_OUT,
      BREAK_OUT: PUNCH_TYPE.TIME_OUT,
    };
    const key = lastType ?? "NONE";
    const expectedNext = allowedNext[key as keyof typeof allowedNext];
    const lastPunchDate = punchesToday[punchesToday.length - 1]?.punchTime ?? null;
    const sameDay =
      lastPunchDate && lastPunchDate >= dayStart && lastPunchDate < dayEnd;

    if (punchType === PUNCH_TYPE.TIME_IN) {
      const expected = await getExpectedShiftForDate(
        user.employee.employeeId,
        dayStart
      );
      const todayStart = startOfZonedDay(now);

      if (dayStart.getTime() !== todayStart.getTime()) {
        return {
          success: false,
          error:
            "Clock in is only allowed on today's scheduled shift date.",
          reason: "wrong_date",
        };
      }

      if (expected.scheduledStartMinutes == null) {
        return {
          success: false,
          error: "No scheduled shift for today",
          reason: "no_shift_today",
        };
      }

      const minutesSinceStart = Math.round(
        (now.getTime() - dayStart.getTime()) / 60000
      );
      if (minutesSinceStart < expected.scheduledStartMinutes) {
        return {
          success: false,
          error:
            "Too early to clock in. Wait for your scheduled start time.",
          reason: "too_early",
        };
      }

      if (
        expected.scheduledEndMinutes != null &&
        minutesSinceStart > expected.scheduledEndMinutes
      ) {
        return {
          success: false,
          error: "Cannot clock in after your scheduled end time.",
          reason: "too_late",
        };
      }
    }

    if (lastType === PUNCH_TYPE.TIME_OUT && sameDay) {
      return {
        success: false,
        error: "Already clocked out today",
        reason: "already_clocked_out",
      };
    }

    if (expectedNext !== punchType) {
      return {
        success: false,
        error: `Next allowed punch is ${expectedNext
          .replace("_", " ")
          .toLowerCase()}`,
        reason: "invalid_sequence",
      };
    }

    const result = await createPunchAndMaybeRecompute({
      employeeId: user.employee.employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime: now,
      source: "KIOSK",
      recompute: true,
    });

    return {
      success: true,
      data: { punch: serializePunch(result.punch) },
    };
  } catch (error) {
    console.error("Failed to record kiosk punch", error);
    return { success: false, error: "Failed to record punch" };
  }
}
