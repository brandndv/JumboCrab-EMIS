import "dotenv/config";
import crypto from "crypto";
import {
  ATTENDANCE_STATUS,
  PUNCH_TYPE,
  Prisma,
  PrismaClient,
  Roles,
  type Shift,
  type WeeklyPattern,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Make sure DB connection string exists before running.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const TZ_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

type OrgMaps = {
  deptMap: Record<string, string>;
  positionMap: Record<string, string>;
};

type SeededEmployee = {
  employeeId: string;
  employeeCode: string;
  departmentName: string;
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

// Simple scrypt wrapper; mirrors the app's auth hash.
async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) reject(err);
      else resolve(dk as Buffer);
    });
  });
  return { salt, hash: derivedKey.toString("hex") };
}

async function seedUsers() {
  const password = "password"; // as requested, all users share this password
  const { hash, salt } = await hashPassword(password);

  const entries: { username: string; email: string; role: Roles }[] = [
    { username: "admin", email: "admin@demo.com", role: Roles.Admin },
    { username: "gm", email: "gm@demo.com", role: Roles.GeneralManager },
    { username: "manager", email: "manager@demo.com", role: Roles.Manager },
    { username: "supervisor", email: "supervisor@demo.com", role: Roles.Supervisor },
    { username: "emp1", email: "emp1@demo.com", role: Roles.Employee },
    { username: "emp2", email: "emp2@demo.com", role: Roles.Employee },
    { username: "emp3", email: "emp3@demo.com", role: Roles.Employee },
  ];

  const users: Record<string, { userId: string; role: Roles }> = {};

  for (const entry of entries) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: entry.username }, { email: entry.email }],
      },
      select: { userId: true },
    });
    const user = existing
      ? await prisma.user.update({
          where: { userId: existing.userId },
          data: {
            username: entry.username,
            email: entry.email,
            role: entry.role,
            password: hash,
            salt,
            isDisabled: false,
          },
        })
      : await prisma.user.create({
          data: {
            username: entry.username,
            email: entry.email,
            role: entry.role,
            password: hash,
            salt,
            isDisabled: false,
          },
        });
    users[entry.username] = { userId: user.userId, role: user.role };
  }

  return users;
}

async function seedOrg() {
  // Departments with a couple of roles each to keep UI populated.
  const deptSeeds = [
    { name: "Engineering", description: "Builds and maintains products." },
    { name: "Operations", description: "Keeps the business running." },
    { name: "HR", description: "People operations and compliance." },
  ];

  const deptMap: Record<string, string> = {};
  for (const seed of deptSeeds) {
    const dept = await prisma.department.upsert({
      where: { name: seed.name },
      update: { description: seed.description, isActive: true },
      create: { name: seed.name, description: seed.description },
    });
    deptMap[seed.name] = dept.departmentId;
  }

  const positionSeeds = [
    { name: "Software Engineer", dept: "Engineering", description: "Feature delivery." },
    { name: "QA Analyst", dept: "Engineering", description: "Quality and testing." },
    { name: "Ops Specialist", dept: "Operations", description: "Day-to-day operations." },
    { name: "Facilities Lead", dept: "Operations", description: "Facilities & assets." },
    { name: "HR Generalist", dept: "HR", description: "Employee lifecycle." },
  ];

  const positionMap: Record<string, string> = {};
  for (const seed of positionSeeds) {
    const departmentId = deptMap[seed.dept];
    if (!departmentId) continue;
    const pos = await prisma.position.upsert({
      where: { name_departmentId: { name: seed.name, departmentId } },
      update: { description: seed.description, isActive: true },
      create: {
        name: seed.name,
        description: seed.description,
        departmentId,
      },
    });
    positionMap[`${seed.dept}:${seed.name}`] = pos.positionId;
  }

  return { deptMap, positionMap };
}

async function seedEmployees(
  users: Record<string, { userId: string; role: Roles }>,
  maps: OrgMaps,
) {
  const supervisorId = users["supervisor"]?.userId ?? null;
  const createdEmployees: SeededEmployee[] = [];

  // Small, explicit employee set so you can see assignments clearly.
  const employees = [
    {
      code: "EMP-001",
      first: "Brandon",
      last: "Lamagna",
      dept: "Engineering",
      pos: "Software Engineer",
      userKey: "emp1",
      dailyRate: "950.00",
    },
    {
      code: "EMP-002",
      first: "Rosemary",
      last: "Rohan",
      dept: "Engineering",
      pos: "QA Analyst",
      userKey: "emp2",
      dailyRate: "900.00",
    },
    {
      code: "EMP-003",
      first: "Alanis",
      last: "Graham",
      dept: "Operations",
      pos: "Ops Specialist",
      userKey: "emp3",
      dailyRate: "850.00",
    },
  ];

  for (const emp of employees) {
    const departmentId = maps.deptMap[emp.dept];
    const positionId = maps.positionMap[`${emp.dept}:${emp.pos}`];

    const created = await prisma.employee.upsert({
      where: { employeeCode: emp.code },
      update: {
        firstName: emp.first,
        lastName: emp.last,
        departmentId,
        positionId,
        supervisorUserId: supervisorId,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        sex: "MALE",
        civilStatus: "SINGLE",
        nationality: "Filipino",
        birthdate: new Date("1995-01-01"),
        address: "123 Demo St",
        city: "Metro Manila",
        country: "Philippines",
        startDate: new Date("2023-01-01"),
        dailyRate: new Prisma.Decimal(emp.dailyRate),
        isArchived: false,
        userId: users[emp.userKey]?.userId,
      },
      create: {
        employeeCode: emp.code,
        firstName: emp.first,
        lastName: emp.last,
        departmentId,
        positionId,
        supervisorUserId: supervisorId,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        sex: "MALE",
        civilStatus: "SINGLE",
        nationality: "Filipino",
        birthdate: new Date("1995-01-01"),
        address: "123 Demo St",
        city: "Metro Manila",
        country: "Philippines",
        startDate: new Date("2023-01-01"),
        dailyRate: new Prisma.Decimal(emp.dailyRate),
        isArchived: false,
        userId: users[emp.userKey]?.userId,
      },
      include: { contribution: true },
    });
    createdEmployees.push({
      employeeId: created.employeeId,
      employeeCode: created.employeeCode,
      departmentName: emp.dept,
    });

    // Seed government IDs for cards.
    await prisma.governmentId.upsert({
      where: { employeeId: created.employeeId },
      update: {
        sssNumber: `34${created.employeeCode.replace("EMP-", "")}123456`,
        philHealthNumber: `71${created.employeeCode.replace("EMP-", "")}987654`,
        tinNumber: `5${created.employeeCode.replace("EMP-", "")}321789`,
        pagIbigNumber: `12${created.employeeCode.replace("EMP-", "")}654321`,
      },
      create: {
        employeeId: created.employeeId,
        sssNumber: `34${created.employeeCode.replace("EMP-", "")}123456`,
        philHealthNumber: `71${created.employeeCode.replace("EMP-", "")}987654`,
        tinNumber: `5${created.employeeCode.replace("EMP-", "")}321789`,
        pagIbigNumber: `12${created.employeeCode.replace("EMP-", "")}654321`,
      },
    });

    // Seed contributions so the contributions directory has data.
    await prisma.employeeContribution.upsert({
      where: { employeeId: created.employeeId },
      update: {
        sssEe: 200,
        sssEr: 300,
        philHealthEe: 150,
        philHealthEr: 150,
        pagIbigEe: 100,
        pagIbigEr: 100,
        withholdingEe: 500,
        withholdingEr: 0,
        isSssActive: true,
        isPhilHealthActive: true,
        isPagIbigActive: true,
        isWithholdingActive: true,
      },
      create: {
        employeeId: created.employeeId,
        sssEe: 200,
        sssEr: 300,
        philHealthEe: 150,
        philHealthEr: 150,
        pagIbigEe: 100,
        pagIbigEr: 100,
        withholdingEe: 500,
        withholdingEr: 0,
        isSssActive: true,
        isPhilHealthActive: true,
        isPagIbigActive: true,
        isWithholdingActive: true,
      },
    });
  }

  return createdEmployees;
}

async function seedShiftsAndPatterns() {
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

async function seedPatternAssignments(
  employees: SeededEmployee[],
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
) {
  const now = nowInManila();
  const effectiveFrom = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const effectiveTo = new Date(effectiveFrom.getTime() + DAY_MS);

  for (const emp of employees) {
    const pattern =
      emp.departmentName === "Operations"
        ? patterns.opsPattern
        : patterns.engPattern;

    await prisma.employeePatternAssignment.deleteMany({
      where: {
        employeeId: emp.employeeId,
        effectiveDate: { gte: effectiveFrom, lt: effectiveTo },
      },
    });

    await prisma.employeePatternAssignment.create({
      data: {
        employeeId: emp.employeeId,
        patternId: pattern.id,
        effectiveDate: effectiveFrom,
        reason: "SEEDED_DEFAULT_PATTERN",
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
  employees: SeededEmployee[],
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
  shiftsByCode: Map<string, Shift>,
) {
  const now = nowInManila();
  const monthStart = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const monthEnd = toManilaDayStart(now);
  const shiftsById = new Map<number, Shift>();
  shiftsByCode.forEach((shift) => {
    shiftsById.set(shift.id, shift);
  });

  for (const emp of employees) {
    const pattern =
      emp.departmentName === "Operations"
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
          employeeId: emp.employeeId,
          punchTime: { gte: dayStart, lt: dayEnd },
        },
      });

      if (!shift) {
        await prisma.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: emp.employeeId,
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
          },
          create: {
            employeeId: emp.employeeId,
            workDate: dayStart,
            status: ATTENDANCE_STATUS.REST,
          },
        });
        continue;
      }

      const isAbsent = dayOfMonth % 11 === 0;
      const isLate = !isAbsent && dayOfMonth % 6 === 0;
      const withOvertime = !isAbsent && dayOfMonth % 10 === 0;

      if (isAbsent) {
        await prisma.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: emp.employeeId,
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
          },
          create: {
            employeeId: emp.employeeId,
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

      const lateMinutes = isLate ? 15 : 0;
      const overtimeMinutes = withOvertime ? 30 : 0;
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
            employeeId: emp.employeeId,
            workDate: dayStart,
          },
        },
        update: {
          status: isLate ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT,
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
          overtimeMinutesApproved: 0,
          nightMinutes: 0,
          isLocked: false,
          payrollPeriodId: null,
        },
        create: {
          employeeId: emp.employeeId,
          workDate: dayStart,
          status: isLate ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT,
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
          overtimeMinutesApproved: 0,
          nightMinutes: 0,
          isLocked: false,
        },
      });

      await prisma.punch.createMany({
        data: [
          {
            employeeId: emp.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.TIME_IN,
            punchTime: actualInAt,
            source: "SEED",
          },
          {
            employeeId: emp.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.BREAK_OUT,
            punchTime: breakOutAt,
            source: "SEED",
          },
          {
            employeeId: emp.employeeId,
            attendanceId: attendance.id,
            punchType: PUNCH_TYPE.BREAK_IN,
            punchTime: breakInAt,
            source: "SEED",
          },
          {
            employeeId: emp.employeeId,
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
  console.log("Seeding users, org, employees, shifts, and attendance...");
  const users = await seedUsers();
  const maps = await seedOrg();
  const employees = await seedEmployees(users, maps);
  const { shiftsByCode, engPattern, opsPattern } = await seedShiftsAndPatterns();
  await seedPatternAssignments(employees, { engPattern, opsPattern });
  await seedAttendance(employees, { engPattern, opsPattern }, shiftsByCode);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
