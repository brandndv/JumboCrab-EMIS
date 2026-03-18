import "dotenv/config";
import {
  ATTENDANCE_STATUS,
  PUNCH_TYPE,
  Prisma,
  PrismaClient,
  type Shift,
  type WeeklyPattern,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const TZ_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

type ActiveEmployee = {
  employeeId: string;
  employeeCode: string;
  departmentName: string | null;
};

type DayShiftSnapshot = Pick<
  WeeklyPattern,
  | "sunShiftId"
  | "monShiftId"
  | "tueShiftId"
  | "wedShiftId"
  | "thuShiftId"
  | "friShiftId"
  | "satShiftId"
>;

const toManilaDayStart = (date: Date) => {
  const utcMs = date.getTime();
  const tzMs = utcMs + TZ_OFFSET_MINUTES * 60 * 1000;
  const tzDate = new Date(tzMs);
  const startTzMs = Date.UTC(
    tzDate.getUTCFullYear(),
    tzDate.getUTCMonth(),
    tzDate.getUTCDate(),
    0,
    0,
    0,
  );
  return new Date(startTzMs - TZ_OFFSET_MINUTES * 60 * 1000);
};

const nowInManila = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

const toDateKeyInManila = (value: Date) =>
  value.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const manilaWeekday = (dayStart: Date) =>
  new Date(dayStart.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCDay();

const manilaDayOfMonth = (dayStart: Date) =>
  new Date(dayStart.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCDate();

const minutesToDate = (dayStart: Date, totalMinutes: number) =>
  new Date(dayStart.getTime() + totalMinutes * 60 * 1000);

const diffMinutes = (startMinutes: number, endMinutes: number) => {
  let value = endMinutes - startMinutes;
  if (value < 0) value += 24 * 60;
  return value;
};

const shiftIdForWeekday = (snapshot: DayShiftSnapshot, weekday: number) => {
  switch (weekday) {
    case 0:
      return snapshot.sunShiftId;
    case 1:
      return snapshot.monShiftId;
    case 2:
      return snapshot.tueShiftId;
    case 3:
      return snapshot.wedShiftId;
    case 4:
      return snapshot.thuShiftId;
    case 5:
      return snapshot.friShiftId;
    case 6:
      return snapshot.satShiftId;
    default:
      return null;
  }
};

async function ensureShiftsAndPatterns() {
  const shiftSeeds = [
    {
      code: "AM_SHIFT",
      name: "Morning Shift",
      startMinutes: 10 * 60 + 30,
      endMinutes: 22 * 60,
      spansMidnight: false,
      breakStartMinutes: 16 * 60,
      breakEndMinutes: 17 * 60,
      breakMinutesUnpaid: 60,
      paidHoursPerDay: "10.50",
      notes: "10:30 AM to 10:00 PM",
    },
    {
      code: "PM_SHIFT",
      name: "Afternoon Shift",
      startMinutes: 13 * 60,
      endMinutes: 22 * 60,
      spansMidnight: false,
      breakStartMinutes: 17 * 60,
      breakEndMinutes: 17 * 60 + 45,
      breakMinutesUnpaid: 45,
      paidHoursPerDay: "8.25",
      notes: "1:00 PM to 10:00 PM",
    },
    {
      code: "MID_SHIFT",
      name: "Mid Shift",
      startMinutes: 9 * 60,
      endMinutes: 18 * 60,
      spansMidnight: false,
      breakStartMinutes: 13 * 60,
      breakEndMinutes: 13 * 60 + 45,
      breakMinutesUnpaid: 45,
      paidHoursPerDay: "8.25",
      notes: "9:00 AM to 6:00 PM",
    },
  ] as const;

  const shiftsByCode = new Map<string, Shift>();
  for (const seed of shiftSeeds) {
    const shift = await prisma.shift.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        startMinutes: seed.startMinutes,
        endMinutes: seed.endMinutes,
        spansMidnight: seed.spansMidnight,
        breakStartMinutes: seed.breakStartMinutes,
        breakEndMinutes: seed.breakEndMinutes,
        breakMinutesUnpaid: seed.breakMinutesUnpaid,
        paidHoursPerDay: new Prisma.Decimal(seed.paidHoursPerDay),
        notes: seed.notes,
        isActive: true,
      },
      create: {
        code: seed.code,
        name: seed.name,
        startMinutes: seed.startMinutes,
        endMinutes: seed.endMinutes,
        spansMidnight: seed.spansMidnight,
        breakStartMinutes: seed.breakStartMinutes,
        breakEndMinutes: seed.breakEndMinutes,
        breakMinutesUnpaid: seed.breakMinutesUnpaid,
        paidHoursPerDay: new Prisma.Decimal(seed.paidHoursPerDay),
        notes: seed.notes,
        isActive: true,
      },
    });
    shiftsByCode.set(seed.code, shift);
  }

  const engPattern = await prisma.weeklyPattern.upsert({
    where: { code: "ENG-ALT" },
    update: {
      name: "Engineering Alternating AM/PM",
      isActive: true,
      sunShiftId: null,
      monShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      tueShiftId: shiftsByCode.get("PM_SHIFT")?.id ?? null,
      wedShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      thuShiftId: shiftsByCode.get("PM_SHIFT")?.id ?? null,
      friShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      satShiftId: null,
    },
    create: {
      code: "ENG-ALT",
      name: "Engineering Alternating AM/PM",
      isActive: true,
      sunShiftId: null,
      monShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      tueShiftId: shiftsByCode.get("PM_SHIFT")?.id ?? null,
      wedShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      thuShiftId: shiftsByCode.get("PM_SHIFT")?.id ?? null,
      friShiftId: shiftsByCode.get("AM_SHIFT")?.id ?? null,
      satShiftId: null,
    },
  });

  const opsPattern = await prisma.weeklyPattern.upsert({
    where: { code: "OPS-MID" },
    update: {
      name: "Operations Mid Shift",
      isActive: true,
      sunShiftId: null,
      monShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      tueShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      wedShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      thuShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      friShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      satShiftId: null,
    },
    create: {
      code: "OPS-MID",
      name: "Operations Mid Shift",
      isActive: true,
      sunShiftId: null,
      monShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      tueShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      wedShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      thuShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      friShiftId: shiftsByCode.get("MID_SHIFT")?.id ?? null,
      satShiftId: null,
    },
  });

  return { shiftsByCode, engPattern, opsPattern };
}

async function getActiveEmployees() {
  const rows = await prisma.employee.findMany({
    where: {
      isArchived: false,
      currentStatus: {
        notIn: ["INACTIVE", "ENDED"],
      },
    },
    select: {
      employeeId: true,
      employeeCode: true,
      department: { select: { name: true } },
    },
    orderBy: [{ employeeCode: "asc" }],
  });

  return rows.map(
    (row): ActiveEmployee => ({
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      departmentName: row.department?.name ?? null,
    }),
  );
}

async function ensurePatternAssignments(
  employees: ActiveEmployee[],
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
  effectiveDate: Date,
) {
  const effectiveTo = new Date(effectiveDate.getTime() + DAY_MS);

  for (const employee of employees) {
    const pattern =
      employee.departmentName === "Operations"
        ? patterns.opsPattern
        : patterns.engPattern;

    await prisma.employeePatternAssignment.deleteMany({
      where: {
        employeeId: employee.employeeId,
        effectiveDate: { gte: effectiveDate, lt: effectiveTo },
      },
    });

    await prisma.employeePatternAssignment.create({
      data: {
        employeeId: employee.employeeId,
        patternId: pattern.id,
        effectiveDate,
        reason: "SEEDED_2_BIMONTHLY_ATTENDANCE",
        sunShiftIdSnapshot: pattern.sunShiftId,
        monShiftIdSnapshot: pattern.monShiftId,
        tueShiftIdSnapshot: pattern.tueShiftId,
        wedShiftIdSnapshot: pattern.wedShiftId,
        thuShiftIdSnapshot: pattern.thuShiftId,
        friShiftIdSnapshot: pattern.friShiftId,
        satShiftIdSnapshot: pattern.satShiftId,
      },
    });
  }
}

async function seedAttendance(
  employees: ActiveEmployee[],
  monthStart: Date,
  monthEnd: Date,
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
  shiftsByCode: Map<string, Shift>,
) {
  const shiftsById = new Map<number, Shift>();
  shiftsByCode.forEach((shift) => shiftsById.set(shift.id, shift));

  for (let empIndex = 0; empIndex < employees.length; empIndex += 1) {
    const employee = employees[empIndex];
    const pattern =
      employee.departmentName === "Operations"
        ? patterns.opsPattern
        : patterns.engPattern;

    for (
      let cursor = new Date(monthStart);
      cursor.getTime() <= monthEnd.getTime();
      cursor = new Date(cursor.getTime() + DAY_MS)
    ) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const weekday = manilaWeekday(dayStart);
      const dayOfMonth = manilaDayOfMonth(dayStart);
      const shiftId = shiftIdForWeekday(pattern, weekday);
      const shift = shiftId ? shiftsById.get(shiftId) ?? null : null;

      await prisma.punch.deleteMany({
        where: {
          employeeId: employee.employeeId,
          punchTime: { gte: dayStart, lt: dayEnd },
        },
      });

      if (!shift) {
        await prisma.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: employee.employeeId,
              workDate: dayStart,
            },
          },
          update: {
            status: ATTENDANCE_STATUS.REST,
            expectedShiftId: null,
            scheduledStartMinutes: null,
            scheduledEndMinutes: null,
            paidHoursPerDay: null,
            actualInAt: null,
            actualOutAt: null,
            workedMinutes: null,
            breakMinutes: 0,
            deductedBreakMinutes: 0,
            netWorkedMinutes: null,
            breakCount: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            overtimeMinutesRaw: 0,
            overtimeMinutesApproved: 0,
            nightMinutes: 0,
            isLocked: false,
            payrollPeriodId: null,
            payrollEmployeeId: null,
          },
          create: {
            employeeId: employee.employeeId,
            workDate: dayStart,
            status: ATTENDANCE_STATUS.REST,
          },
        });
        continue;
      }

      const absent = (dayOfMonth + empIndex) % 14 === 0;
      const late = !absent && (dayOfMonth + empIndex) % 6 === 0;
      const overtime = !absent && (dayOfMonth + empIndex) % 9 === 0;

      if (absent) {
        await prisma.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: employee.employeeId,
              workDate: dayStart,
            },
          },
          update: {
            status: ATTENDANCE_STATUS.ABSENT,
            expectedShiftId: shift.id,
            scheduledStartMinutes: shift.startMinutes,
            scheduledEndMinutes: shift.endMinutes,
            paidHoursPerDay: shift.paidHoursPerDay,
            actualInAt: null,
            actualOutAt: null,
            workedMinutes: null,
            breakMinutes: 0,
            deductedBreakMinutes: 0,
            netWorkedMinutes: null,
            breakCount: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            overtimeMinutesRaw: 0,
            overtimeMinutesApproved: 0,
            nightMinutes: 0,
            isLocked: false,
            payrollPeriodId: null,
            payrollEmployeeId: null,
          },
          create: {
            employeeId: employee.employeeId,
            workDate: dayStart,
            status: ATTENDANCE_STATUS.ABSENT,
            expectedShiftId: shift.id,
            scheduledStartMinutes: shift.startMinutes,
            scheduledEndMinutes: shift.endMinutes,
            paidHoursPerDay: shift.paidHoursPerDay,
          },
        });
        continue;
      }

      const lateMinutes = late ? 15 : 0;
      const overtimeMinutes = overtime ? 45 : 0;
      const breakStartMinutes =
        shift.breakStartMinutes ?? shift.startMinutes + 4 * 60;
      const breakEndMinutes =
        shift.breakEndMinutes ??
        breakStartMinutes + Math.max(shift.breakMinutesUnpaid, 30);
      const timeInMinutes = shift.startMinutes + lateMinutes;
      const timeOutMinutes = shift.endMinutes + overtimeMinutes;
      const workedMinutes = diffMinutes(timeInMinutes, timeOutMinutes);
      const actualBreakMinutes = diffMinutes(breakStartMinutes, breakEndMinutes);
      const deductedBreakMinutes = Math.max(
        shift.breakMinutesUnpaid,
        actualBreakMinutes,
      );
      const netWorkedMinutes = Math.max(0, workedMinutes - deductedBreakMinutes);
      const scheduledPaidMinutes =
        Number.parseFloat(shift.paidHoursPerDay.toString()) * 60;
      const undertimeMinutes = Math.max(0, scheduledPaidMinutes - netWorkedMinutes);
      const overtimeMinutesRaw = Math.max(0, netWorkedMinutes - scheduledPaidMinutes);
      const actualInAt = minutesToDate(dayStart, timeInMinutes);
      const breakOutAt = minutesToDate(dayStart, breakStartMinutes);
      const breakInAt = minutesToDate(dayStart, breakEndMinutes);
      const actualOutAt = minutesToDate(dayStart, timeOutMinutes);

      const attendance = await prisma.attendance.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.employeeId,
            workDate: dayStart,
          },
        },
        update: {
          status: late ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT,
          expectedShiftId: shift.id,
          scheduledStartMinutes: shift.startMinutes,
          scheduledEndMinutes: shift.endMinutes,
          paidHoursPerDay: shift.paidHoursPerDay,
          actualInAt,
          actualOutAt,
          workedMinutes,
          breakMinutes: actualBreakMinutes,
          deductedBreakMinutes,
          netWorkedMinutes,
          breakCount: 1,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutesRaw,
          overtimeMinutesApproved: overtime ? overtimeMinutesRaw : 0,
          nightMinutes: 0,
          isLocked: false,
          payrollPeriodId: null,
          payrollEmployeeId: null,
        },
        create: {
          employeeId: employee.employeeId,
          workDate: dayStart,
          status: late ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT,
          expectedShiftId: shift.id,
          scheduledStartMinutes: shift.startMinutes,
          scheduledEndMinutes: shift.endMinutes,
          paidHoursPerDay: shift.paidHoursPerDay,
          actualInAt,
          actualOutAt,
          workedMinutes,
          breakMinutes: actualBreakMinutes,
          deductedBreakMinutes,
          netWorkedMinutes,
          breakCount: 1,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutesRaw,
          overtimeMinutesApproved: overtime ? overtimeMinutesRaw : 0,
          nightMinutes: 0,
          isLocked: false,
        },
      });

      await prisma.punch.createMany({
        data: [
          {
            employeeId: employee.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.TIME_IN,
            punchTime: actualInAt,
            source: "SEED",
          },
          {
            employeeId: employee.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.BREAK_OUT,
            punchTime: breakOutAt,
            source: "SEED",
          },
          {
            employeeId: employee.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.BREAK_IN,
            punchTime: breakInAt,
            source: "SEED",
          },
          {
            employeeId: employee.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.TIME_OUT,
            punchTime: actualOutAt,
            source: "SEED",
          },
        ],
      });
    }
  }
}

async function main() {
  const now = nowInManila();
  const monthStart = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  );
  const monthEnd = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth(), 0),
  );

  console.log(
    `Seeding attendance for 2 bi-monthly windows: ${toDateKeyInManila(monthStart)} to ${toDateKeyInManila(monthEnd)}...`,
  );

  const employees = await getActiveEmployees();
  if (employees.length === 0) {
    console.log("No active employees found. Nothing to seed.");
    return;
  }

  const { shiftsByCode, engPattern, opsPattern } = await ensureShiftsAndPatterns();
  await ensurePatternAssignments(employees, { engPattern, opsPattern }, monthStart);
  await seedAttendance(
    employees,
    monthStart,
    monthEnd,
    { engPattern, opsPattern },
    shiftsByCode,
  );

  const totalAttendance = await prisma.attendance.count({
    where: {
      employeeId: { in: employees.map((employee) => employee.employeeId) },
      workDate: { gte: monthStart, lte: monthEnd },
    },
  });

  console.log(
    `Attendance seeded. Employees: ${employees.length}, Rows in range: ${totalAttendance}.`,
  );
}

main()
  .catch((error) => {
    console.error("Attendance seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
