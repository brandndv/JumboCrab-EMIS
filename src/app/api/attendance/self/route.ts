import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { PUNCH_TYPE } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPunchAndMaybeRecompute, getExpectedShiftForDate } from "@/lib/attendance";
import { startOfZonedDay, endOfZonedDay, zonedNow } from "@/lib/timezone";

const isIpAllowed = (ip: string | null) => {
  const raw = process.env.ALLOWED_PUNCH_IPS;
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return ip && list.includes(ip);
};

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", reason: "unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const day = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date", reason: "invalid_date" },
        { status: 400 }
      );
    }
    const dayStart = startOfZonedDay(day);
    const dayEnd = endOfZonedDay(day);

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found for user", reason: "employee_not_found" },
        { status: 404 }
      );
    }

    const expected = await getExpectedShiftForDate(employee.employeeId, dayStart);
    const punches = await db.punch.findMany({
      where: { employeeId: employee.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { punchTime: "asc" },
    });

    // Breaks
    let breakCount = 0;
    let breakMinutes = 0;
    let breakStart: Date | null = null;
    punches.forEach((p) => {
      if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
        if (!breakStart) {
          breakStart = p.punchTime;
        } else {
          breakCount += 1;
          breakMinutes += Math.max(0, Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000));
          breakStart = null;
        }
      }
    });

    const lastPunch = punches[punches.length - 1] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        employee,
        expected: {
          start: expected.scheduledStartMinutes,
          end: expected.scheduledEndMinutes,
          shiftName: expected.shift?.name ?? null,
          source: expected.source,
        },
        punches,
        lastPunch,
        breakCount,
        breakMinutes,
      },
    });
  } catch (error) {
    console.error("Failed to fetch self attendance status", error);
    return NextResponse.json(
      { success: false, error: "Failed to load attendance status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const hdr = await headers();
    const clientIp =
      hdr.get("x-forwarded-for")?.split(",")[0].trim() ||
      hdr.get("x-real-ip") ||
      null;
    if (!isIpAllowed(clientIp)) {
      return NextResponse.json(
        { success: false, error: "Punching not allowed from this device", reason: "ip_not_allowed" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const punchType = typeof body?.punchType === "string" ? body.punchType : "";
    if (!Object.values(PUNCH_TYPE).includes(punchType as PUNCH_TYPE)) {
      return NextResponse.json(
        { success: false, error: "Invalid punchType", reason: "invalid_punch_type" },
        { status: 400 }
      );
    }

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: { employeeId: true },
    });
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found for user", reason: "employee_not_found" },
        { status: 404 }
      );
    }

    const now = zonedNow();
    const todayStart = startOfZonedDay(now);
    const expected = await getExpectedShiftForDate(employee.employeeId, todayStart);

    if (punchType === PUNCH_TYPE.TIME_IN) {
      if (expected.scheduledStartMinutes == null) {
        return NextResponse.json(
          { success: false, error: "No scheduled shift for today", reason: "no_shift_today" },
          { status: 400 }
        );
      }
      const minutesSinceStart = Math.round((now.getTime() - todayStart.getTime()) / 60000);
      if (minutesSinceStart < expected.scheduledStartMinutes) {
        return NextResponse.json(
          {
            success: false,
            error: "Too early to clock in. You can time in at the scheduled start time.",
            reason: "too_early",
          },
          { status: 400 }
        );
      }
      if (
        expected.scheduledEndMinutes != null &&
        minutesSinceStart > expected.scheduledEndMinutes
      ) {
        return NextResponse.json(
          { success: false, error: "Cannot clock in after your scheduled end time.", reason: "too_late" },
          { status: 400 }
        );
      }
    }

    const punch = await createPunchAndMaybeRecompute({
      employeeId: employee.employeeId,
      punchType: punchType as PUNCH_TYPE,
      punchTime: now,
      source: "WEB_SELF",
      recompute: true,
    });

    return NextResponse.json({ success: true, data: punch });
  } catch (error) {
    console.error("Failed to record self punch", error);
    return NextResponse.json({ success: false, error: "Failed to record punch" }, { status: 500 });
  }
}
