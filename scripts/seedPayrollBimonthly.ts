import "dotenv/config";
import crypto from "crypto";
import {
  ATTENDANCE_STATUS,
  ContributionCalculationMethod,
  ContributionType,
  PUNCH_TYPE,
  PayrollDeductionType,
  PayrollEmployeeStatus,
  PayrollEarningType,
  PayrollFrequency,
  PayrollLineSource,
  PayrollReferenceType,
  PayrollReviewDecision,
  PayrollStatus,
  PayrollType,
  Prisma,
  PrismaClient,
  Roles,
  type Shift,
  type WeeklyPattern,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedContributionBrackets } from "./shared/contribution-brackets";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const TZ = "Asia/Manila";
const TZ_OFFSET_MINUTES = 8 * 60;
const OVERTIME_RATE_MULTIPLIER = 1.25;

type UserDirectory = Record<string, { userId: string; role: Roles }>;

type OrgMaps = {
  deptMap: Record<string, string>;
  positionMap: Record<string, string>;
};

type SeededEmployee = {
  employeeId: string;
  employeeCode: string;
  departmentName: string;
  dailyRate: number;
  monthlyRate: number;
  positionId: string;
  positionName: string;
  currencyCode: string;
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

type PayrollPeriod = {
  startDay: Date;
  endDay: Date;
  startKey: string;
  endKey: string;
};

type ContributionBracketRow = {
  id: string;
  contributionType: ContributionType;
  payrollFrequency: PayrollFrequency | null;
  calculationMethod: ContributionCalculationMethod;
  lowerBound: number;
  upperBound: number | null;
  employeeFixedAmount: number | null;
  employerFixedAmount: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  baseTax: number | null;
  marginalRate: number | null;
  referenceCode: string | null;
  metadata:
    | {
        appliedBaseAmount?: number;
        monthlySalaryCredit?: number;
      }
    | null;
};

const toDateKeyInManila = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

const parseIsoDateAtNoonUtc = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const nowInManila = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

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

const shiftDateByDays = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};

const roundCurrency = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const roundSixDecimals = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    const parsed = Number.parseFloat(
      (value as { toString: () => string }).toString(),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNumber = (value: unknown, fallback = 0) =>
  toNumberOrNull(value) ?? fallback;

const diffMinutes = (startMinutes: number, endMinutes: number) => {
  let value = endMinutes - startMinutes;
  if (value < 0) value += 24 * 60;
  return value;
};

const minutesToDate = (dayStart: Date, totalMinutes: number) =>
  new Date(dayStart.getTime() + totalMinutes * 60 * 1000);

const manilaWeekday = (dayStart: Date) =>
  new Date(dayStart.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCDay();

const manilaDayOfMonth = (dayStart: Date) =>
  new Date(dayStart.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCDate();

const manilaParts = (date: Date) => {
  const tzDate = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
  return {
    year: tzDate.getUTCFullYear(),
    month: tzDate.getUTCMonth(),
    day: tzDate.getUTCDate(),
  };
};

const fromManilaYmd = (year: number, month: number, day: number) =>
  toManilaDayStart(new Date(Date.UTC(year, month, day, 12, 0, 0)));

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

const isDateKeyInRange = (value: string, start: string, end: string) =>
  value >= start && value <= end;

const computeScheduledPaidMinutes = (
  paidHoursPerDay: unknown,
  scheduledStartMinutes: number | null,
  scheduledEndMinutes: number | null,
) => {
  const paidHours = toNumberOrNull(paidHoursPerDay);
  if (paidHours != null && paidHours > 0) {
    return Math.round(paidHours * 60);
  }
  if (scheduledStartMinutes == null || scheduledEndMinutes == null) {
    return null;
  }
  return Math.max(0, diffMinutes(scheduledStartMinutes, scheduledEndMinutes));
};

const deriveCompensationRates = (dailyRate: number) => ({
  dailyRate: roundCurrency(dailyRate),
  hourlyRate: roundCurrency(dailyRate / 8),
  monthlyRate: roundCurrency(dailyRate * 26),
});

const findApplicableContributionBracket = (input: {
  rows: ContributionBracketRow[];
  contributionType: ContributionType;
  basisAmount: number;
  payrollFrequency?: PayrollFrequency;
}) =>
  input.rows.find((row) => {
    if (row.contributionType !== input.contributionType) return false;
    if (input.contributionType === ContributionType.WITHHOLDING) {
      if (row.payrollFrequency !== (input.payrollFrequency ?? null)) return false;
    } else if (row.payrollFrequency !== null) {
      return false;
    }

    if (input.basisAmount < row.lowerBound) return false;
    return row.upperBound == null || input.basisAmount <= row.upperBound;
  }) ?? null;

const calculateContributionFromBracket = (
  bracket: ContributionBracketRow,
  basisAmount: number,
) => {
  const appliedBasis =
    bracket.metadata?.appliedBaseAmount ??
    bracket.metadata?.monthlySalaryCredit ??
    basisAmount;

  if (bracket.calculationMethod === ContributionCalculationMethod.FIXED_AMOUNTS) {
    return {
      basisAmount: roundCurrency(appliedBasis),
      employeeShare: roundCurrency(bracket.employeeFixedAmount ?? 0),
      employerShare: roundCurrency(bracket.employerFixedAmount ?? 0),
      baseTax: bracket.baseTax,
      marginalRate: bracket.marginalRate,
    };
  }

  if (bracket.calculationMethod === ContributionCalculationMethod.PERCENT_OF_BASE) {
    return {
      basisAmount: roundCurrency(appliedBasis),
      employeeShare: roundCurrency(appliedBasis * (bracket.employeeRate ?? 0)),
      employerShare: roundCurrency(appliedBasis * (bracket.employerRate ?? 0)),
      baseTax: bracket.baseTax,
      marginalRate: bracket.marginalRate,
    };
  }

  const taxableExcess = Math.max(0, basisAmount - bracket.lowerBound);
  return {
    basisAmount: roundCurrency(basisAmount),
    employeeShare: roundCurrency(
      (bracket.baseTax ?? 0) + taxableExcess * (bracket.marginalRate ?? 0),
    ),
    employerShare: roundCurrency(
      (bracket.employerFixedAmount ?? 0) +
        taxableExcess * (bracket.employerRate ?? 0),
    ),
    baseTax: bracket.baseTax,
    marginalRate: bracket.marginalRate,
  };
};

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

async function ensureUsers() {
  const password = "password";
  const { hash, salt } = await hashPassword(password);

  const coreUsers: Array<{ username: string; email: string; role: Roles }> = [
    { username: "admin", email: "admin@demo.com", role: Roles.Admin },
    { username: "gm", email: "gm@demo.com", role: Roles.GeneralManager },
    { username: "manager", email: "manager@demo.com", role: Roles.Manager },
    { username: "supervisor", email: "supervisor@demo.com", role: Roles.Supervisor },
  ];

  const employeeUsers = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    return {
      username: `emp${number}`,
      email: `emp${number}@demo.com`,
      role: Roles.Employee,
    };
  });

  const usersToSeed = [...coreUsers, ...employeeUsers];
  const users: UserDirectory = {};

  for (const entry of usersToSeed) {
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

async function ensureOrg() {
  const deptSeeds = [
    { name: "Engineering", description: "Builds and maintains products." },
    { name: "Operations", description: "Keeps the business running." },
    { name: "HR", description: "People operations and compliance." },
  ];

  const deptMap: Record<string, string> = {};
  for (const seed of deptSeeds) {
    const row = await prisma.department.upsert({
      where: { name: seed.name },
      update: { description: seed.description, isActive: true },
      create: { name: seed.name, description: seed.description, isActive: true },
    });
    deptMap[seed.name] = row.departmentId;
  }

  const positionSeeds = [
    {
      name: "Software Engineer I",
      dept: "Engineering",
      description: "Feature delivery.",
      dailyRate: 950,
    },
    {
      name: "Software Engineer II",
      dept: "Engineering",
      description: "Feature delivery.",
      dailyRate: 980,
    },
    {
      name: "Software Engineer III",
      dept: "Engineering",
      description: "Feature delivery.",
      dailyRate: 1000,
    },
    {
      name: "Senior Software Engineer",
      dept: "Engineering",
      description: "Feature delivery.",
      dailyRate: 1050,
    },
    {
      name: "QA Analyst I",
      dept: "Engineering",
      description: "Quality and testing.",
      dailyRate: 900,
    },
    {
      name: "QA Analyst II",
      dept: "Engineering",
      description: "Quality and testing.",
      dailyRate: 920,
    },
    {
      name: "Ops Specialist I",
      dept: "Operations",
      description: "Day-to-day operations.",
      dailyRate: 850,
    },
    {
      name: "Ops Specialist II",
      dept: "Operations",
      description: "Day-to-day operations.",
      dailyRate: 860,
    },
    {
      name: "Facilities Lead",
      dept: "Operations",
      description: "Facilities and assets.",
      dailyRate: 870,
    },
    {
      name: "HR Generalist",
      dept: "HR",
      description: "Employee lifecycle.",
      dailyRate: 880,
    },
  ];

  const positionMap: Record<string, string> = {};
  for (const seed of positionSeeds) {
    const departmentId = deptMap[seed.dept];
    if (!departmentId) continue;
    const rates = deriveCompensationRates(seed.dailyRate);
    const row = await prisma.position.upsert({
      where: { name_departmentId: { name: seed.name, departmentId } },
      update: {
        description: seed.description,
        isActive: true,
        dailyRate: new Prisma.Decimal(rates.dailyRate.toFixed(2)),
        hourlyRate: new Prisma.Decimal(rates.hourlyRate.toFixed(2)),
        monthlyRate: new Prisma.Decimal(rates.monthlyRate.toFixed(2)),
        currencyCode: "PHP",
      },
      create: {
        name: seed.name,
        departmentId,
        description: seed.description,
        isActive: true,
        dailyRate: new Prisma.Decimal(rates.dailyRate.toFixed(2)),
        hourlyRate: new Prisma.Decimal(rates.hourlyRate.toFixed(2)),
        monthlyRate: new Prisma.Decimal(rates.monthlyRate.toFixed(2)),
        currencyCode: "PHP",
      },
    });
    await prisma.positionRateHistory.upsert({
      where: {
        positionId_effectiveFrom: {
          positionId: row.positionId,
          effectiveFrom: new Date(Date.UTC(2023, 0, 1, 0, 0, 0)),
        },
      },
      update: {
        dailyRate: new Prisma.Decimal(rates.dailyRate.toFixed(2)),
        hourlyRate: new Prisma.Decimal(rates.hourlyRate.toFixed(2)),
        monthlyRate: new Prisma.Decimal(rates.monthlyRate.toFixed(2)),
        currencyCode: "PHP",
        reason: "Initial seeded position rate",
      },
      create: {
        positionId: row.positionId,
        dailyRate: new Prisma.Decimal(rates.dailyRate.toFixed(2)),
        hourlyRate: new Prisma.Decimal(rates.hourlyRate.toFixed(2)),
        monthlyRate: new Prisma.Decimal(rates.monthlyRate.toFixed(2)),
        currencyCode: "PHP",
        effectiveFrom: new Date(Date.UTC(2023, 0, 1, 0, 0, 0)),
        reason: "Initial seeded position rate",
      },
    });
    positionMap[`${seed.dept}:${seed.name}`] = row.positionId;
  }

  return { deptMap, positionMap };
}

async function ensureEmployees(users: UserDirectory, maps: OrgMaps) {
  const supervisorId = users["supervisor"]?.userId ?? null;

  const employees = [
    {
      code: "EMP-001",
      first: "Brandon",
      last: "Lamagna",
      dept: "Engineering",
      pos: "Software Engineer I",
      sex: "MALE" as const,
      userKey: "emp1",
      dailyRate: 950,
    },
    {
      code: "EMP-002",
      first: "Rosemary",
      last: "Rohan",
      dept: "Engineering",
      pos: "QA Analyst I",
      sex: "FEMALE" as const,
      userKey: "emp2",
      dailyRate: 900,
    },
    {
      code: "EMP-003",
      first: "Alanis",
      last: "Graham",
      dept: "Operations",
      pos: "Ops Specialist I",
      sex: "FEMALE" as const,
      userKey: "emp3",
      dailyRate: 850,
    },
    {
      code: "EMP-004",
      first: "Maria",
      last: "Santos",
      dept: "Engineering",
      pos: "Software Engineer II",
      sex: "FEMALE" as const,
      userKey: "emp4",
      dailyRate: 980,
    },
    {
      code: "EMP-005",
      first: "John",
      last: "Cruz",
      dept: "Operations",
      pos: "Facilities Lead",
      sex: "MALE" as const,
      userKey: "emp5",
      dailyRate: 870,
    },
    {
      code: "EMP-006",
      first: "Erika",
      last: "Dela Cruz",
      dept: "Engineering",
      pos: "QA Analyst II",
      sex: "FEMALE" as const,
      userKey: "emp6",
      dailyRate: 920,
    },
    {
      code: "EMP-007",
      first: "Carlo",
      last: "Reyes",
      dept: "Engineering",
      pos: "Software Engineer III",
      sex: "MALE" as const,
      userKey: "emp7",
      dailyRate: 1000,
    },
    {
      code: "EMP-008",
      first: "Nina",
      last: "Flores",
      dept: "Operations",
      pos: "Ops Specialist II",
      sex: "FEMALE" as const,
      userKey: "emp8",
      dailyRate: 860,
    },
    {
      code: "EMP-009",
      first: "Paolo",
      last: "Mendoza",
      dept: "Engineering",
      pos: "Senior Software Engineer",
      sex: "MALE" as const,
      userKey: "emp9",
      dailyRate: 1050,
    },
    {
      code: "EMP-010",
      first: "Hazel",
      last: "Navarro",
      dept: "HR",
      pos: "HR Generalist",
      sex: "FEMALE" as const,
      userKey: "emp10",
      dailyRate: 880,
    },
  ] as const;

  const seededEmployees: SeededEmployee[] = [];

  for (let i = 0; i < employees.length; i += 1) {
    const seed = employees[i];
    const departmentId = maps.deptMap[seed.dept];
    const positionId = maps.positionMap[`${seed.dept}:${seed.pos}`];
    const startDate = new Date(Date.UTC(2023, 0, 1 + i, 0, 0, 0));
    const birthdate = new Date(Date.UTC(1990 + (i % 8), i % 12, 10 + (i % 15)));

    const employee = await prisma.employee.upsert({
      where: { employeeCode: seed.code },
      update: {
        firstName: seed.first,
        lastName: seed.last,
        middleName: null,
        suffix: null,
        sex: seed.sex,
        civilStatus: "SINGLE",
        nationality: "Filipino",
        birthdate,
        address: "Metro Manila",
        city: "Quezon City",
        state: "NCR",
        postalCode: "1100",
        country: "Philippines",
        startDate,
        isEnded: false,
        endDate: null,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        email: `${seed.userKey}@demo.com`,
        phone: `0917${(1000000 + i * 11111).toString().slice(0, 7)}`,
        emergencyContactName: "Emergency Contact",
        emergencyContactRelationship: "Sibling",
        emergencyContactPhone: "09171234567",
        emergencyContactEmail: `ec.${seed.userKey}@demo.com`,
        description: "Seeded for payroll demo",
        isArchived: false,
        userId: users[seed.userKey]?.userId ?? null,
        departmentId,
        positionId,
        supervisorUserId: supervisorId,
      },
      create: {
        employeeCode: seed.code,
        firstName: seed.first,
        lastName: seed.last,
        middleName: null,
        suffix: null,
        sex: seed.sex,
        civilStatus: "SINGLE",
        nationality: "Filipino",
        birthdate,
        address: "Metro Manila",
        city: "Quezon City",
        state: "NCR",
        postalCode: "1100",
        country: "Philippines",
        startDate,
        isEnded: false,
        endDate: null,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        email: `${seed.userKey}@demo.com`,
        phone: `0917${(1000000 + i * 11111).toString().slice(0, 7)}`,
        emergencyContactName: "Emergency Contact",
        emergencyContactRelationship: "Sibling",
        emergencyContactPhone: "09171234567",
        emergencyContactEmail: `ec.${seed.userKey}@demo.com`,
        description: "Seeded for payroll demo",
        isArchived: false,
        userId: users[seed.userKey]?.userId ?? null,
        departmentId,
        positionId,
        supervisorUserId: supervisorId,
      },
    });

    await prisma.governmentId.upsert({
      where: { employeeId: employee.employeeId },
      update: {
        sssNumber: `34${seed.code.replace("EMP-", "")}123456`,
        philHealthNumber: `71${seed.code.replace("EMP-", "")}987654`,
        tinNumber: `5${seed.code.replace("EMP-", "")}321789`,
        pagIbigNumber: `12${seed.code.replace("EMP-", "")}654321`,
      },
      create: {
        employeeId: employee.employeeId,
        sssNumber: `34${seed.code.replace("EMP-", "")}123456`,
        philHealthNumber: `71${seed.code.replace("EMP-", "")}987654`,
        tinNumber: `5${seed.code.replace("EMP-", "")}321789`,
        pagIbigNumber: `12${seed.code.replace("EMP-", "")}654321`,
      },
    });

    await prisma.employeePositionHistory.deleteMany({
      where: { employeeId: employee.employeeId },
    });
    await prisma.employeePositionHistory.create({
      data: {
        employeeId: employee.employeeId,
        departmentId,
        positionId,
        effectiveFrom: startDate,
        reason: "Initial seeded assignment",
        createdByUserId: supervisorId,
      },
    });

    const rates = deriveCompensationRates(seed.dailyRate);

    seededEmployees.push({
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      departmentName: seed.dept,
      dailyRate: rates.dailyRate,
      monthlyRate: rates.monthlyRate,
      positionId,
      positionName: seed.pos,
      currencyCode: "PHP",
    });
  }

  return seededEmployees;
}

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

async function ensurePatternAssignments(
  employees: SeededEmployee[],
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
  effectiveDate: Date,
) {
  for (const employee of employees) {
    const pattern =
      employee.departmentName === "Operations"
        ? patterns.opsPattern
        : patterns.engPattern;

    await prisma.employeePatternAssignment.deleteMany({
      where: { employeeId: employee.employeeId },
    });

    await prisma.employeePatternAssignment.create({
      data: {
        employeeId: employee.employeeId,
        patternId: pattern.id,
        effectiveDate,
        reason: "SEEDED_6_MONTH_PATTERN",
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
  rangeStart: Date,
  rangeEnd: Date,
  patterns: { engPattern: WeeklyPattern; opsPattern: WeeklyPattern },
  shiftsByCode: Map<string, Shift>,
) {
  const shiftsById = new Map<number, Shift>();
  shiftsByCode.forEach((shift) => {
    shiftsById.set(shift.id, shift);
  });

  const rangeEndExclusive = shiftDateByDays(rangeEnd, 1);

  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index];
    const pattern =
      employee.departmentName === "Operations"
        ? patterns.opsPattern
        : patterns.engPattern;

    await prisma.punch.deleteMany({
      where: {
        employeeId: employee.employeeId,
        punchTime: { gte: rangeStart, lt: rangeEndExclusive },
      },
    });

    for (
      let cursor = new Date(rangeStart);
      cursor.getTime() <= rangeEnd.getTime();
      cursor = shiftDateByDays(cursor, 1)
    ) {
      const dayStart = new Date(cursor);
      const dayEnd = shiftDateByDays(dayStart, 1);
      const weekday = manilaWeekday(dayStart);
      const dayOfMonth = manilaDayOfMonth(dayStart);
      const shiftId = shiftIdForWeekday(pattern, weekday);
      const shift = shiftId ? shiftsById.get(shiftId) ?? null : null;

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

      const isAbsent = (dayOfMonth + index) % 17 === 0;
      const isLate = !isAbsent && (dayOfMonth + index) % 7 === 0;
      const hasOvertime = !isAbsent && (dayOfMonth + index) % 9 === 0;
      const leavesEarly = !isAbsent && !hasOvertime && (dayOfMonth + index) % 11 === 0;

      if (isAbsent) {
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

      const lateMinutes = isLate ? 15 : 0;
      const overtimeSeed = hasOvertime ? 45 : 0;
      const undertimeSeed = leavesEarly ? 20 : 0;
      const breakStartMinutes =
        shift.breakStartMinutes ?? shift.startMinutes + 4 * 60;
      const breakEndMinutes =
        shift.breakEndMinutes ??
        breakStartMinutes + Math.max(shift.breakMinutesUnpaid, 30);
      const timeInMinutes = shift.startMinutes + lateMinutes;
      const timeOutMinutes = shift.endMinutes + overtimeSeed - undertimeSeed;
      const workedMinutes = diffMinutes(timeInMinutes, timeOutMinutes);
      const actualBreakMinutes = diffMinutes(breakStartMinutes, breakEndMinutes);
      const deductedBreakMinutes = Math.max(
        shift.breakMinutesUnpaid,
        actualBreakMinutes,
      );
      const netWorkedMinutes = Math.max(0, workedMinutes - deductedBreakMinutes);
      const scheduledPaidMinutes = Math.round(
        toNumber(shift.paidHoursPerDay, 8) * 60,
      );
      const undertimeMinutes = Math.max(0, scheduledPaidMinutes - netWorkedMinutes);
      const overtimeMinutesRaw = Math.max(0, netWorkedMinutes - scheduledPaidMinutes);
      const overtimeMinutesApproved = hasOvertime ? overtimeMinutesRaw : 0;

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
          overtimeMinutesApproved,
          nightMinutes: 0,
          isLocked: false,
          payrollPeriodId: null,
          payrollEmployeeId: null,
        },
        create: {
          employeeId: employee.employeeId,
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
          overtimeMinutesApproved,
          nightMinutes: 0,
          isLocked: false,
        },
      });

      await prisma.punch.deleteMany({
        where: {
          employeeId: employee.employeeId,
          punchTime: { gte: dayStart, lt: dayEnd },
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

const buildBiMonthlyPeriods = (rangeStart: Date, rangeEnd: Date) => {
  const periods: PayrollPeriod[] = [];
  const startParts = manilaParts(rangeStart);
  const endParts = manilaParts(rangeEnd);

  let year = startParts.year;
  let month = startParts.month;

  while (year < endParts.year || (year === endParts.year && month <= endParts.month)) {
    const monthStart = fromManilaYmd(year, month, 1);
    const firstHalfEnd = fromManilaYmd(year, month, 15);
    const secondHalfStart = fromManilaYmd(year, month, 16);
    const monthEnd = fromManilaYmd(year, month + 1, 0);

    const firstStart = monthStart < rangeStart ? rangeStart : monthStart;
    const firstEnd = firstHalfEnd > rangeEnd ? rangeEnd : firstHalfEnd;
    if (firstStart.getTime() <= firstEnd.getTime()) {
      periods.push({
        startDay: firstStart,
        endDay: firstEnd,
        startKey: toDateKeyInManila(firstStart),
        endKey: toDateKeyInManila(firstEnd),
      });
    }

    const secondStart = secondHalfStart < rangeStart ? rangeStart : secondHalfStart;
    const secondEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
    if (secondStart.getTime() <= secondEnd.getTime()) {
      periods.push({
        startDay: secondStart,
        endDay: secondEnd,
        startKey: toDateKeyInManila(secondStart),
        endKey: toDateKeyInManila(secondEnd),
      });
    }

    if (month === 11) {
      month = 0;
      year += 1;
    } else {
      month += 1;
    }
  }

  return periods;
};

async function seedPayroll(
  employees: SeededEmployee[],
  periods: PayrollPeriod[],
  users: UserDirectory,
) {
  const employeeIds = employees.map((employee) => employee.employeeId);
  console.log(
    `Preparing payroll seeding for ${employeeIds.length} employees across ${periods.length} periods...`,
  );

  const existingRuns = await prisma.payroll.findMany({
    where: { payrollType: PayrollType.BIMONTHLY },
    select: {
      payrollId: true,
      payrollPeriodStart: true,
      payrollPeriodEnd: true,
    },
  });
  console.log(`Found ${existingRuns.length} existing bi-monthly payroll runs.`);

  const existingRunByPeriod = new Map<
    string,
    { payrollId: string; payrollPeriodStart: Date; payrollPeriodEnd: Date }
  >();
  existingRuns.forEach((run) => {
    const key = `${toDateKeyInManila(run.payrollPeriodStart)}|${toDateKeyInManila(
      run.payrollPeriodEnd,
    )}`;
    existingRunByPeriod.set(key, run);
  });

  const managerUserId = users["manager"]?.userId ?? users["admin"]?.userId ?? null;
  const gmUserId = users["gm"]?.userId ?? users["admin"]?.userId ?? null;
  const contributionBrackets = await prisma.contributionBracket.findMany({
    orderBy: [
      { contributionType: "asc" },
      { payrollFrequency: "asc" },
      { lowerBound: "asc" },
    ],
    select: {
      id: true,
      contributionType: true,
      payrollFrequency: true,
      calculationMethod: true,
      lowerBound: true,
      upperBound: true,
      employeeFixedAmount: true,
      employerFixedAmount: true,
      employeeRate: true,
      employerRate: true,
      baseTax: true,
      marginalRate: true,
      referenceCode: true,
      metadata: true,
    },
  });
  const bracketRows: ContributionBracketRow[] = contributionBrackets.map((row) => ({
    id: row.id,
    contributionType: row.contributionType,
    payrollFrequency: row.payrollFrequency,
    calculationMethod: row.calculationMethod,
    lowerBound: toNumber(row.lowerBound),
    upperBound: toNumberOrNull(row.upperBound),
    employeeFixedAmount: toNumberOrNull(row.employeeFixedAmount),
    employerFixedAmount: toNumberOrNull(row.employerFixedAmount),
    employeeRate: toNumberOrNull(row.employeeRate),
    employerRate: toNumberOrNull(row.employerRate),
    baseTax: toNumberOrNull(row.baseTax),
    marginalRate: toNumberOrNull(row.marginalRate),
    referenceCode: row.referenceCode ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? {
            appliedBaseAmount: toNumberOrNull(
              (row.metadata as { appliedBaseAmount?: unknown }).appliedBaseAmount,
            ) ?? undefined,
            monthlySalaryCredit: toNumberOrNull(
              (row.metadata as { monthlySalaryCredit?: unknown }).monthlySalaryCredit,
            ) ?? undefined,
          }
        : null,
  }));

  const employeesWithProfile = await prisma.employee.findMany({
    where: { employeeId: { in: employeeIds } },
    select: {
      employeeId: true,
      employeeCode: true,
      position: {
        select: {
          positionId: true,
          name: true,
          dailyRate: true,
          hourlyRate: true,
          monthlyRate: true,
          currencyCode: true,
        },
      },
      governmentId: {
        select: {
          sssNumber: true,
          philHealthNumber: true,
          pagIbigNumber: true,
          tinNumber: true,
        },
      },
    },
  });
  console.log(
    `Loaded ${employeesWithProfile.length} employee profiles for payroll computation.`,
  );

  const employeeMap = new Map(
    employeesWithProfile.map((employee) => [employee.employeeId, employee]),
  );

  for (const period of periods) {
    const periodKey = `${period.startKey}|${period.endKey}`;
    console.log(`Seeding payroll period ${period.startKey} to ${period.endKey}...`);

    const periodStart = parseIsoDateAtNoonUtc(period.startKey);
    const periodEnd = parseIsoDateAtNoonUtc(period.endKey);
    if (!periodStart || !periodEnd) {
      continue;
    }

    const existingRun = existingRunByPeriod.get(periodKey);
    let payrollId: string;
    if (existingRun) {
      payrollId = existingRun.payrollId;
      await prisma.payroll.update({
        where: { payrollId },
        data: {
          status: PayrollStatus.RELEASED,
          managerDecision: PayrollReviewDecision.APPROVED,
          gmDecision: PayrollReviewDecision.APPROVED,
          managerReviewedAt: new Date(),
          gmReviewedAt: new Date(),
          releasedAt: new Date(),
          managerReviewRemarks: "Approved (seeded)",
          gmReviewRemarks: "Approved (seeded)",
          notes: "Auto-seeded bimonthly payroll run",
          createdByUserId: managerUserId,
          managerReviewedByUserId: managerUserId,
          gmReviewedByUserId: gmUserId,
          releasedByUserId: gmUserId,
        },
      });

      await prisma.attendance.updateMany({
        where: { payrollPeriodId: payrollId },
        data: {
          payrollPeriodId: null,
          payrollEmployeeId: null,
        },
      });

      await prisma.payrollEmployee.deleteMany({
        where: { payrollId },
      });
    } else {
      const created = await prisma.payroll.create({
        data: {
          payrollPeriodStart: periodStart,
          payrollPeriodEnd: periodEnd,
          payrollType: PayrollType.BIMONTHLY,
          status: PayrollStatus.RELEASED,
          managerDecision: PayrollReviewDecision.APPROVED,
          gmDecision: PayrollReviewDecision.APPROVED,
          managerReviewedAt: new Date(),
          gmReviewedAt: new Date(),
          releasedAt: new Date(),
          managerReviewRemarks: "Approved (seeded)",
          gmReviewRemarks: "Approved (seeded)",
          notes: "Auto-seeded bimonthly payroll run",
          createdByUserId: managerUserId,
          managerReviewedByUserId: managerUserId,
          gmReviewedByUserId: gmUserId,
          releasedByUserId: gmUserId,
        },
      });
      payrollId = created.payrollId;
    }

    const broadStart = shiftDateByDays(period.startDay, -2);
    const broadEnd = shiftDateByDays(period.endDay, 2);

    const attendanceRows = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: broadStart, lte: broadEnd },
      },
      orderBy: [{ workDate: "asc" }],
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        status: true,
        paidHoursPerDay: true,
        scheduledStartMinutes: true,
        scheduledEndMinutes: true,
        workedMinutes: true,
        netWorkedMinutes: true,
        lateMinutes: true,
        undertimeMinutes: true,
        overtimeMinutesRaw: true,
        overtimeMinutesApproved: true,
      },
    });

    const attendanceByEmployee = new Map<string, typeof attendanceRows>();
    attendanceRows.forEach((row) => {
      const key = toDateKeyInManila(row.workDate);
      if (!isDateKeyInRange(key, period.startKey, period.endKey)) return;
      if (!attendanceByEmployee.has(row.employeeId)) {
        attendanceByEmployee.set(row.employeeId, []);
      }
      attendanceByEmployee.get(row.employeeId)!.push(row);
    });

    for (const seededEmployee of employees) {
      const employee = employeeMap.get(seededEmployee.employeeId);
      if (!employee) continue;
      if (!employee.position) {
        throw new Error(
          `Employee ${seededEmployee.employeeCode} is missing a position assignment.`,
        );
      }

      const rows = attendanceByEmployee.get(seededEmployee.employeeId) ?? [];
      const dailyRate =
        toNumberOrNull(employee.position.dailyRate) ?? seededEmployee.dailyRate;
      const hourlyRate =
        toNumberOrNull(employee.position.hourlyRate) ??
        roundCurrency(dailyRate / 8);
      const monthlyRate =
        toNumberOrNull(employee.position.monthlyRate) ??
        seededEmployee.monthlyRate;
      const currencyCode = employee.position.currencyCode ?? seededEmployee.currencyCode;

      const minutesWorked = rows.reduce(
        (sum, row) => sum + Math.max(0, row.workedMinutes ?? 0),
        0,
      );
      const minutesNetWorked = rows.reduce(
        (sum, row) => sum + Math.max(0, row.netWorkedMinutes ?? 0),
        0,
      );
      const minutesOvertime = rows.reduce((sum, row) => {
        const approved = Math.max(0, row.overtimeMinutesApproved ?? 0);
        const raw = Math.max(0, row.overtimeMinutesRaw ?? 0);
        return sum + (approved > 0 ? approved : raw);
      }, 0);
      const minutesUndertime = rows.reduce(
        (sum, row) => sum + Math.max(0, row.undertimeMinutes ?? 0),
        0,
      );

      let daysPresent = 0;
      let daysAbsent = 0;
      let daysLate = 0;
      for (const row of rows) {
        if (row.status === ATTENDANCE_STATUS.ABSENT) {
          daysAbsent += 1;
        } else if (row.status !== ATTENDANCE_STATUS.REST) {
          daysPresent += 1;
        }
        if (row.status === ATTENDANCE_STATUS.LATE || (row.lateMinutes ?? 0) > 0) {
          daysLate += 1;
        }
      }

      const baselinePaidMinutes =
        rows
          .map((row) =>
            computeScheduledPaidMinutes(
              row.paidHoursPerDay,
              row.scheduledStartMinutes,
              row.scheduledEndMinutes,
            ),
          )
          .find((minutes): minutes is number => typeof minutes === "number" && minutes > 0) ??
        8 * 60;

      const ratePerMinuteSnapshot =
        dailyRate == null
          ? null
          : roundSixDecimals(dailyRate / Math.max(1, baselinePaidMinutes));

      let basePay = 0;
      for (const row of rows) {
        const scheduledPaidMinutes =
          computeScheduledPaidMinutes(
            row.paidHoursPerDay,
            row.scheduledStartMinutes,
            row.scheduledEndMinutes,
          ) ?? baselinePaidMinutes;

        const ratePerMinute =
          dailyRate == null ? null : dailyRate / Math.max(1, scheduledPaidMinutes);
        if (ratePerMinute == null || row.netWorkedMinutes == null) continue;
        basePay += Math.max(0, row.netWorkedMinutes) * Math.max(0, ratePerMinute);
      }
      basePay = roundCurrency(basePay);

      const overtimePay =
        ratePerMinuteSnapshot == null
          ? 0
          : roundCurrency(
              minutesOvertime * ratePerMinuteSnapshot * OVERTIME_RATE_MULTIPLIER,
            );
      const undertimeDeduction =
        ratePerMinuteSnapshot == null
          ? 0
          : roundCurrency(minutesUndertime * ratePerMinuteSnapshot);

      const earnings: Array<{
        earningType: PayrollEarningType;
        amount: number;
        minutes: number | null;
        rateSnapshot: number | null;
        source: PayrollLineSource;
        isManual: boolean;
        referenceType: PayrollReferenceType;
        referenceId: string;
        remarks: string;
      }> = [];

      if (basePay > 0) {
        earnings.push({
          earningType: PayrollEarningType.BASE_PAY,
          amount: basePay,
          minutes: minutesNetWorked,
          rateSnapshot: ratePerMinuteSnapshot,
          source: PayrollLineSource.SYSTEM,
          isManual: false,
          referenceType: PayrollReferenceType.ATTENDANCE,
          referenceId: payrollId,
          remarks: "Computed from attendance net worked minutes",
        });
      }

      if (overtimePay > 0) {
        earnings.push({
          earningType: PayrollEarningType.OVERTIME_PAY,
          amount: overtimePay,
          minutes: minutesOvertime,
          rateSnapshot: ratePerMinuteSnapshot,
          source: PayrollLineSource.SYSTEM,
          isManual: false,
          referenceType: PayrollReferenceType.ATTENDANCE,
          referenceId: payrollId,
          remarks: `Overtime multiplier (${OVERTIME_RATE_MULTIPLIER}x)`,
        });
      }

      const deductions: Array<{
        deductionType: PayrollDeductionType;
        amount: number;
        minutes: number | null;
        rateSnapshot: number | null;
        source: PayrollLineSource;
        isManual: boolean;
        referenceType: PayrollReferenceType;
        referenceId: string;
        remarks: string;
        contributionType?: ContributionType | null;
        bracketIdSnapshot?: string | null;
        bracketReferenceSnapshot?: string | null;
        payrollFrequency?: PayrollFrequency | null;
        periodStartSnapshot?: Date | null;
        periodEndSnapshot?: Date | null;
        compensationBasisSnapshot?: number | null;
        employeeShareSnapshot?: number | null;
        employerShareSnapshot?: number | null;
        baseTaxSnapshot?: number | null;
        marginalRateSnapshot?: number | null;
        quantitySnapshot?: number | null;
        unitLabelSnapshot?: string | null;
        metadata?: Prisma.InputJsonValue | null;
      }> = [];

      if (undertimeDeduction > 0) {
        deductions.push({
          deductionType: PayrollDeductionType.UNDERTIME_DEDUCTION,
          amount: undertimeDeduction,
          minutes: minutesUndertime,
          rateSnapshot: ratePerMinuteSnapshot,
          source: PayrollLineSource.SYSTEM,
          isManual: false,
          referenceType: PayrollReferenceType.ATTENDANCE,
          referenceId: payrollId,
          remarks: "Computed from attendance undertime minutes",
        });
      }
      const governmentId = employee.governmentId;
      const isFirstPayrollOfMonth = manilaDayOfMonth(period.startDay) <= 15;

      if (isFirstPayrollOfMonth) {
        const monthlyContributionConfigs = [
          {
            contributionType: ContributionType.SSS,
            deductionType: PayrollDeductionType.CONTRIBUTION_SSS,
            governmentNumber: governmentId?.sssNumber?.trim() || null,
          },
          {
            contributionType: ContributionType.PHILHEALTH,
            deductionType: PayrollDeductionType.CONTRIBUTION_PHILHEALTH,
            governmentNumber: governmentId?.philHealthNumber?.trim() || null,
          },
          {
            contributionType: ContributionType.PAGIBIG,
            deductionType: PayrollDeductionType.CONTRIBUTION_PAGIBIG,
            governmentNumber: governmentId?.pagIbigNumber?.trim() || null,
          },
        ] as const;

        for (const config of monthlyContributionConfigs) {
          if (!config.governmentNumber) continue;
          const bracket = findApplicableContributionBracket({
            rows: bracketRows,
            contributionType: config.contributionType,
            basisAmount: monthlyRate,
          });
          if (!bracket) {
            throw new Error(
              `Missing ${config.contributionType} bracket for basis ${monthlyRate.toFixed(2)}.`,
            );
          }

          const calculation = calculateContributionFromBracket(bracket, monthlyRate);
          if (calculation.employeeShare <= 0) continue;

          deductions.push({
            deductionType: config.deductionType,
            amount: calculation.employeeShare,
            minutes: null,
            rateSnapshot: null,
            source: PayrollLineSource.CONTRIBUTION_ENGINE,
            isManual: false,
            referenceType: PayrollReferenceType.CONTRIBUTION,
            referenceId: bracket.id,
            remarks: `${config.contributionType} statutory contribution`,
            contributionType: config.contributionType,
            bracketIdSnapshot: bracket.id,
            bracketReferenceSnapshot: bracket.referenceCode,
            payrollFrequency: PayrollFrequency.BIMONTHLY,
            periodStartSnapshot: periodStart,
            periodEndSnapshot: periodEnd,
            compensationBasisSnapshot: calculation.basisAmount,
            employeeShareSnapshot: calculation.employeeShare,
            employerShareSnapshot: calculation.employerShare,
            baseTaxSnapshot: calculation.baseTax,
            marginalRateSnapshot: calculation.marginalRate,
            quantitySnapshot: 1,
            unitLabelSnapshot: "monthly bracket",
            metadata: {
              governmentNumber: config.governmentNumber,
              seededFrom: "seedPayrollBimonthly",
              ...(bracket.metadata ?? {}),
            },
          });
        }
      }

      const earningsSubtotal = roundCurrency(
        earnings.reduce((sum, line) => sum + line.amount, 0),
      );
      const withholdingBracket = findApplicableContributionBracket({
        rows: bracketRows,
        contributionType: ContributionType.WITHHOLDING,
        payrollFrequency: PayrollFrequency.BIMONTHLY,
        basisAmount: earningsSubtotal,
      });
      if (!withholdingBracket) {
        throw new Error(
          `Missing withholding bracket for basis ${earningsSubtotal.toFixed(2)}.`,
        );
      }
      const withholding = calculateContributionFromBracket(
        withholdingBracket,
        earningsSubtotal,
      );
      if (withholding.employeeShare > 0) {
        deductions.push({
          deductionType: PayrollDeductionType.WITHHOLDING_TAX,
          amount: withholding.employeeShare,
          minutes: null,
          rateSnapshot: null,
          source: PayrollLineSource.CONTRIBUTION_ENGINE,
          isManual: false,
          referenceType: PayrollReferenceType.CONTRIBUTION,
          referenceId: withholdingBracket.id,
          remarks: "Employee withholding tax",
          contributionType: ContributionType.WITHHOLDING,
          bracketIdSnapshot: withholdingBracket.id,
          bracketReferenceSnapshot: withholdingBracket.referenceCode,
          payrollFrequency: PayrollFrequency.BIMONTHLY,
          periodStartSnapshot: periodStart,
          periodEndSnapshot: periodEnd,
          compensationBasisSnapshot: withholding.basisAmount,
          employeeShareSnapshot: withholding.employeeShare,
          employerShareSnapshot: withholding.employerShare,
          baseTaxSnapshot: withholding.baseTax,
          marginalRateSnapshot: withholding.marginalRate,
          quantitySnapshot: 1,
          unitLabelSnapshot: "tax bracket",
          metadata: {
            governmentNumber: governmentId?.tinNumber?.trim() || null,
            seededFrom: "seedPayrollBimonthly",
            ...(withholdingBracket.metadata ?? {}),
          },
        });
      }

      const totalEarnings = roundCurrency(
        earnings.reduce((sum, line) => sum + line.amount, 0),
      );
      const totalDeductions = roundCurrency(
        deductions.reduce((sum, line) => sum + line.amount, 0),
      );
      const grossPay = totalEarnings;
      const netPay = roundCurrency(totalEarnings - totalDeductions);

      const payrollEmployee = await prisma.payrollEmployee.create({
        data: {
          payrollId,
          employeeId: seededEmployee.employeeId,
          attendanceStart: periodStart,
          attendanceEnd: periodEnd,
          daysPresent,
          daysAbsent,
          daysLate,
          minutesWorked,
          minutesNetWorked,
          minutesOvertime,
          minutesUndertime,
          positionIdSnapshot: employee.position.positionId,
          positionNameSnapshot: employee.position.name,
          dailyRateSnapshot: dailyRate,
          hourlyRateSnapshot: hourlyRate,
          monthlyRateSnapshot: monthlyRate,
          currencyCodeSnapshot: currencyCode,
          ratePerMinuteSnapshot,
          grossPay,
          totalEarnings,
          totalDeductions,
          netPay,
          status: PayrollEmployeeStatus.RELEASED,
          createdByUserId: managerUserId,
          updatedByUserId: managerUserId,
        },
      });

      if (rows.length > 0) {
        await prisma.attendance.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: {
            payrollPeriodId: payrollId,
            payrollEmployeeId: payrollEmployee.id,
          },
        });
      }

      if (earnings.length > 0) {
        await prisma.payrollEarning.createMany({
          data: earnings.map((line) => ({
            payrollEmployeeId: payrollEmployee.id,
            earningType: line.earningType,
            amount: line.amount,
            minutes: line.minutes,
            rateSnapshot: line.rateSnapshot,
            source: line.source,
            isManual: line.isManual,
            referenceType: line.referenceType,
            referenceId: line.referenceId,
            remarks: line.remarks,
            createdByUserId: managerUserId,
          })),
        });
      }

      if (deductions.length > 0) {
        await prisma.payrollDeduction.createMany({
          data: deductions.map((line) => ({
            payrollEmployeeId: payrollEmployee.id,
            deductionType: line.deductionType,
            contributionType: line.contributionType ?? null,
            bracketIdSnapshot: line.bracketIdSnapshot ?? null,
            bracketReferenceSnapshot: line.bracketReferenceSnapshot ?? null,
            payrollFrequency: line.payrollFrequency ?? null,
            periodStartSnapshot: line.periodStartSnapshot ?? null,
            periodEndSnapshot: line.periodEndSnapshot ?? null,
            compensationBasisSnapshot: line.compensationBasisSnapshot ?? null,
            employeeShareSnapshot: line.employeeShareSnapshot ?? null,
            employerShareSnapshot: line.employerShareSnapshot ?? null,
            baseTaxSnapshot: line.baseTaxSnapshot ?? null,
            marginalRateSnapshot: line.marginalRateSnapshot ?? null,
            quantitySnapshot: line.quantitySnapshot ?? null,
            unitLabelSnapshot: line.unitLabelSnapshot ?? null,
            metadata: line.metadata ?? undefined,
            amount: line.amount,
            minutes: line.minutes,
            rateSnapshot: line.rateSnapshot,
            source: line.source,
            isManual: line.isManual,
            referenceType: line.referenceType,
            referenceId: line.referenceId,
            remarks: line.remarks,
            createdByUserId: managerUserId,
          })),
        });
      }
    }
  }
}

async function main() {
  console.log("Seeding 10 employees, 6 months attendance, and bi-monthly payroll...");
  const payrollOnly = process.env.SEED_PAYROLL_ONLY === "1";

  const users = await ensureUsers();
  await seedContributionBrackets(prisma, {
    sssEffectiveFrom: new Date(Date.UTC(2025, 0, 1, 12, 0, 0)),
    philHealthEffectiveFrom: new Date(Date.UTC(2024, 0, 1, 12, 0, 0)),
    pagIbigEffectiveFrom: new Date(Date.UTC(2024, 0, 1, 12, 0, 0)),
    withholdingEffectiveFrom: new Date(Date.UTC(2023, 0, 1, 12, 0, 0)),
  });
  const maps = await ensureOrg();
  const employees = await ensureEmployees(users, maps);
  const { shiftsByCode, engPattern, opsPattern } = await ensureShiftsAndPatterns();

  const now = nowInManila();
  const rangeStart = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth() - 5, 1),
  );
  const rangeEnd = toManilaDayStart(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );

  if (!payrollOnly) {
    await ensurePatternAssignments(employees, { engPattern, opsPattern }, rangeStart);
    await seedAttendance(
      employees,
      rangeStart,
      rangeEnd,
      { engPattern, opsPattern },
      shiftsByCode,
    );
  } else {
    console.log("Skipping attendance generation (SEED_PAYROLL_ONLY=1).");
  }

  const periods = buildBiMonthlyPeriods(rangeStart, rangeEnd);
  await seedPayroll(employees, periods, users);

  console.log(
    `Seed complete. Employees: ${employees.length}, Attendance range: ${toDateKeyInManila(rangeStart)} to ${toDateKeyInManila(rangeEnd)}, Payroll runs: ${periods.length}.`,
  );
}

main()
  .catch((error) => {
    console.error("Payroll seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
