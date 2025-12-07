import { ATTENDANCE_STATUS, PUNCH_TYPE, Shift } from "@prisma/client";
import { db } from "./db";
import { startOfZonedDay, endOfZonedDay, TZ } from "./timezone";

type ExpectedShift = {
  shift: Shift | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
  source: "override" | "pattern" | "none";
};

const minutesBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 60000);

const dayKey = (date: Date) => {
  const dayStr = date.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }).toLowerCase();
  switch (dayStr.slice(0, 3)) {
    case "sun":
      return "sun";
    case "mon":
      return "mon";
    case "tue":
      return "tue";
    case "wed":
      return "wed";
    case "thu":
      return "thu";
    case "fri":
      return "fri";
    case "sat":
      return "sat";
    default:
      return "sun";
  }
};

export async function getExpectedShiftForDate(employeeId: string, workDate: Date): Promise<ExpectedShift> {
  const dayStart = startOfZonedDay(workDate);
  const dayEnd = endOfZonedDay(workDate);

  const override = await db.employeeShiftOverride.findFirst({
    where: { employeeId, workDate: { gte: dayStart, lt: dayEnd } },
    include: { shift: true },
  });
  if (override) {
    const shift = override.shift;
    return {
      shift,
      scheduledStartMinutes: shift?.startMinutes ?? null,
      scheduledEndMinutes: shift?.endMinutes ?? null,
      source: "override",
    };
  }

  const patternAssignment = await db.employeePatternAssignment.findFirst({
    where: { employeeId, effectiveDate: { lte: dayStart } },
    orderBy: { effectiveDate: "desc" },
    include: { pattern: true },
  });

  if (!patternAssignment?.pattern) {
    return { shift: null, scheduledStartMinutes: null, scheduledEndMinutes: null, source: "none" };
  }

  const pattern = patternAssignment.pattern;
  const key = dayKey(dayStart);
  const shiftId = (pattern as any)[`${key}ShiftId`] as number | null | undefined;

  if (!shiftId) {
    return { shift: null, scheduledStartMinutes: null, scheduledEndMinutes: null, source: "none" };
  }

  const shift = await db.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    return { shift: null, scheduledStartMinutes: null, scheduledEndMinutes: null, source: "none" };
  }

  return {
    shift,
    scheduledStartMinutes: shift.startMinutes,
    scheduledEndMinutes: shift.endMinutes,
    source: "pattern",
  };
}

export async function recomputeAttendanceForDay(
  employeeId: string,
  workDate: Date
) {
  const dayStart = startOfZonedDay(workDate);
  const dayEnd = endOfZonedDay(workDate);
  const now = new Date();
  const nowMinutes = minutesBetween(dayStart, now);

  const punches = await db.punch.findMany({
    where: {
      employeeId,
      punchTime: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { punchTime: "asc" },
  });

  // Compute breaks by pairing consecutive break punches (BREAK_IN/OUT in any order)
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;
  punches.forEach((p) => {
    if (p.punchType === PUNCH_TYPE.BREAK_IN || p.punchType === PUNCH_TYPE.BREAK_OUT) {
      if (!breakStart) {
        breakStart = p.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(0, minutesBetween(breakStart, p.punchTime));
        breakStart = null;
      }
    }
  });

  const expected = await getExpectedShiftForDate(employeeId, dayStart);
  const paidHoursPerDay = expected.shift?.paidHoursPerDay ?? null;
  // Lock and mark incomplete once we're 5 minutes after scheduled end (clamped to 0).
  const cutoffMinutes =
    expected.scheduledEndMinutes != null ? Math.max(0, expected.scheduledEndMinutes + 5) : null;
  const cutoffPassed = cutoffMinutes != null ? nowMinutes >= cutoffMinutes : false;

  const firstClockIn = punches.find((p) => p.punchType === PUNCH_TYPE.TIME_IN) ?? null;
  const lastClockOut =
    [...punches].reverse().find((p) => p.punchType === PUNCH_TYPE.TIME_OUT) ?? null;

  const actualInAt = firstClockIn?.punchTime ?? punches[0]?.punchTime ?? null;
  const actualOutAt = lastClockOut?.punchTime ?? null;
  const actualInMinutes = actualInAt ? minutesBetween(dayStart, actualInAt) : null;
  const actualOutMinutes = actualOutAt ? minutesBetween(dayStart, actualOutAt) : null;

  const workedMinutes =
    actualInAt && actualOutAt ? Math.max(0, minutesBetween(actualInAt, actualOutAt)) : null;

  const lateMinutes =
    expected.scheduledStartMinutes != null && actualInMinutes != null
      ? Math.max(0, actualInMinutes - expected.scheduledStartMinutes)
      : 0;

  const undertimeMinutes =
    expected.scheduledEndMinutes != null && actualOutMinutes != null
      ? Math.max(0, expected.scheduledEndMinutes - actualOutMinutes)
      : 0;

  const overtimeMinutesRaw =
    expected.scheduledEndMinutes != null && actualOutMinutes != null
      ? Math.max(0, actualOutMinutes - expected.scheduledEndMinutes)
      : 0;

  let status: ATTENDANCE_STATUS = ATTENDANCE_STATUS.ABSENT;
  if (actualInAt || actualOutAt) {
    if (!actualOutAt && cutoffPassed) {
      status = ATTENDANCE_STATUS.INCOMPLETE;
    } else {
      status = lateMinutes > 0 ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT;
    }
  }

  const shouldLock = cutoffPassed;

  const attendance = await db.attendance.upsert({
    where: { employeeId_workDate: { employeeId, workDate: dayStart } },
    update: {
      status,
      expectedShiftId: expected.shift?.id ?? null,
      scheduledStartMinutes: expected.scheduledStartMinutes,
      scheduledEndMinutes: expected.scheduledEndMinutes,
      paidHoursPerDay,
      actualInAt,
      actualOutAt,
      workedMinutes,
      breakMinutes,
      breakCount,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutesRaw,
      isLocked: shouldLock,
    },
    create: {
      employeeId,
      workDate: dayStart,
      status,
      expectedShiftId: expected.shift?.id ?? null,
      scheduledStartMinutes: expected.scheduledStartMinutes,
      scheduledEndMinutes: expected.scheduledEndMinutes,
      paidHoursPerDay,
      actualInAt,
      actualOutAt,
      workedMinutes,
      breakMinutes,
      breakCount,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutesRaw,
      isLocked: shouldLock,
    },
  });

  // Link punches to the attendance record for traceability
  if (attendance?.id) {
    await db.punch.updateMany({
      where: { employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
      data: { attendanceId: attendance.id },
    });
  }

  return { attendance, punches };
}

export async function createPunchAndMaybeRecompute(options: {
  employeeId: string;
  punchType: PUNCH_TYPE;
  punchTime: Date;
  source?: string | null;
  recompute?: boolean;
}) {
  const { employeeId, punchType, punchTime, source, recompute } = options;
  const punch = await db.punch.create({
    data: {
      employeeId,
      punchType,
      punchTime,
      source: source ?? "WEB",
    },
  });

  let attendance = null;
  if (recompute) {
    const { attendance: updated } = await recomputeAttendanceForDay(employeeId, punchTime);
    attendance = updated;
  }

  return { punch, attendance };
}
