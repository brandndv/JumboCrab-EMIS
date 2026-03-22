import "dotenv/config";
import crypto from "crypto";
import { faker } from "@faker-js/faker";
import {
  ATTENDANCE_STATUS,
  CIVIL_STATUS,
  CURRENT_STATUS,
  EMPLOYMENT_STATUS,
  GENDER,
  PUNCH_TYPE,
  Prisma,
  PrismaClient,
  Roles,
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

const DEFAULT_PASSWORD = "password";
const TZ = "Asia/Manila";
const TZ_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const RESTAURANT_NAME = "Jumbo Crab";
const RESTAURANT_LOCATION = "Alona, Panglao, Bohol";
const ESTABLISHED_AT = dateAtNoonUtc(2023, 8, 3);
const CONTRIBUTION_EFFECTIVE_AT = dateAtNoonUtc(2025, 8, 1);

type DepartmentName =
  | "Kitchen"
  | "Dining"
  | "Cashier"
  | "Transportation / Drivers"
  | "Management";

type StaffSeed = {
  employeeCode: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  img: string;
  sex: GENDER;
  civilStatus: CIVIL_STATUS;
  nationality: string;
  birthdate: Date;
  startDate: Date;
  employmentStatus: EMPLOYMENT_STATUS;
  currentStatus: CURRENT_STATUS;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  dailyRate: string;
  description?: string;
  departmentName: DepartmentName;
  positionName: string;
  userRole: Roles;
  supervisorUsername?: string | null;
};

type UserDirectory = Record<
  string,
  {
    userId: string;
    role: Roles;
  }
>;

type OrgMaps = {
  deptMap: Record<DepartmentName, string>;
  positionMap: Record<string, string>;
};

type SeededEmployee = StaffSeed & {
  employeeId: string;
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

function dateAtNoonUtc(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

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

const startOfManilaMonth = (date: Date) =>
  toManilaDayStart(
    dateAtNoonUtc(
      new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCFullYear(),
      new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCMonth(),
      1,
    ),
  );

const startOfManilaWeek = (date: Date) => {
  const dayStart = toManilaDayStart(date);
  const weekday = manilaWeekday(dayStart);
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dayStart, delta);
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

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

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function buildProfileImageUrl(firstName: string, lastName: string, username: string) {
  const seed = encodeURIComponent(`${firstName} ${lastName} ${username}`);
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=f97316,e2e8f0,cbd5e1`;
}

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

async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const quotedTables = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`,
  );
}

function buildDepartmentSeeds() {
  return [
    {
      name: "Kitchen" as const,
      description: `${RESTAURANT_NAME} kitchen brigade in ${RESTAURANT_LOCATION}.`,
    },
    {
      name: "Dining" as const,
      description: `${RESTAURANT_NAME} floor service team for dine-in guests and tourists.`,
    },
    {
      name: "Cashier" as const,
      description:
        "Cashiering, settlement handling, and payroll-clerk support duties.",
    },
    {
      name: "Transportation / Drivers" as const,
      description: "Transportation and driving team for restaurant logistics.",
    },
    {
      name: "Management" as const,
      description:
        "Operations and supervisory leadership supporting day-to-day restaurant activity.",
    },
  ];
}

function buildPositionSeeds(staff: StaffSeed[]) {
  const seen = new Set<string>();
  const positions: Array<{
    departmentName: DepartmentName;
    name: string;
    description: string;
  }> = [];

  for (const member of staff) {
    const key = `${member.departmentName}:${member.positionName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    positions.push({
      departmentName: member.departmentName,
      name: member.positionName,
      description: `${member.positionName} role for ${member.departmentName.toLowerCase()} operations at ${RESTAURANT_NAME}.`,
    });
  }

  return positions;
}

function buildStaffBlueprint() {
  faker.seed(9032023);

  let employeeCounter = 1;
  let regularIndex = 0;
  let probationaryIndex = 0;
  let phoneCounter = 1;
  const usernameCounters = new Map<string, number>();

  const staff: StaffSeed[] = [];

  const nextEmployeeCode = () =>
    `EMP-${String(employeeCounter++).padStart(3, "0")}`;

  const nextPhone = () =>
    `0917${String(1000000 + phoneCounter++ * 173).slice(-7)}`;

  const nextUsername = (prefix: string) => {
    const nextValue = (usernameCounters.get(prefix) ?? 0) + 1;
    usernameCounters.set(prefix, nextValue);
    return `${prefix}${String(nextValue).padStart(2, "0")}`;
  };

  const nextStartDate = (employmentStatus: EMPLOYMENT_STATUS) => {
    if (employmentStatus === EMPLOYMENT_STATUS.REGULAR) {
      return addDays(ESTABLISHED_AT, regularIndex++ * 18);
    }

    return addDays(dateAtNoonUtc(2025, 3, 1), probationaryIndex++ * 9);
  };

  const nextBirthdate = (
    employmentStatus: EMPLOYMENT_STATUS,
    minimumAge = 22,
    maximumAge = 46,
  ) =>
    faker.date.birthdate({
      min: employmentStatus === EMPLOYMENT_STATUS.PROBATIONARY ? minimumAge : minimumAge + 2,
      max: maximumAge,
      mode: "age",
    });

  const nextCivilStatus = (birthdate: Date) => {
    const age =
      nowInManila().getFullYear() - birthdate.getUTCFullYear();

    if (age >= 32) {
      return faker.helpers.arrayElement([
        CIVIL_STATUS.MARRIED,
        CIVIL_STATUS.SINGLE,
      ]);
    }

    return CIVIL_STATUS.SINGLE;
  };

  const buildAddress = () => {
    const barangay = faker.helpers.arrayElement([
      "Danao",
      "Tawala",
      "Poblacion",
      "Bolod",
      "Libaong",
    ]);
    return {
      address: `${faker.number.int({ min: 1, max: 120 })} ${barangay} Road`,
      city: "Panglao",
      state: "Bohol",
      postalCode: "6340",
      country: "Philippines",
    };
  };

  const pushStaff = (seed: Omit<StaffSeed, "employeeCode">) => {
    staff.push({
      ...seed,
      employeeCode: nextEmployeeCode(),
    });
  };

  const pushOperationalGroup = ({
    departmentName,
    positionName,
    count,
    regularCount,
    dailyRate,
    usernamePrefix,
    supervisorUsername,
    description,
  }: {
    departmentName: DepartmentName;
    positionName: string;
    count: number;
    regularCount: number;
    dailyRate: string;
    usernamePrefix: string;
    supervisorUsername?: string | null;
    description?: string;
  }) => {
    for (let index = 0; index < count; index += 1) {
      const employmentStatus =
        index < regularCount
          ? EMPLOYMENT_STATUS.REGULAR
          : EMPLOYMENT_STATUS.PROBATIONARY;
      const sex = faker.helpers.arrayElement([GENDER.MALE, GENDER.FEMALE]);
      const birthdate = nextBirthdate(
        employmentStatus,
        21,
        positionName.includes("Chef") ? 50 : 42,
      );
      const username = nextUsername(usernamePrefix);
      const home = buildAddress();
      const firstName = faker.person.firstName(
        sex === GENDER.MALE ? "male" : "female",
      );
      const lastName = faker.person.lastName();
      const img = buildProfileImageUrl(firstName, lastName, username);

      pushStaff({
        username,
        email: `${username}@jumbocrab.local`,
        firstName,
        lastName,
        img,
        sex,
        civilStatus: nextCivilStatus(birthdate),
        nationality: "Filipino",
        birthdate,
        startDate: nextStartDate(employmentStatus),
        employmentStatus,
        currentStatus: CURRENT_STATUS.ACTIVE,
        phone: nextPhone(),
        address: home.address,
        city: home.city,
        state: home.state,
        postalCode: home.postalCode,
        country: home.country,
        dailyRate,
        description,
        departmentName,
        positionName,
        userRole: Roles.Employee,
        supervisorUsername,
      });
    }
  };

  const managementHome = buildAddress();

  pushStaff({
    username: "ops.manager",
    email: "ops.manager@jumbocrab.local",
    firstName: "Luis",
    lastName: "Dela Cruz",
    img: buildProfileImageUrl("Luis", "Dela Cruz", "ops.manager"),
    sex: GENDER.MALE,
    civilStatus: CIVIL_STATUS.MARRIED,
    nationality: "Filipino",
    birthdate: dateAtNoonUtc(1986, 4, 12),
    startDate: dateAtNoonUtc(2023, 8, 3),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: managementHome.address,
    city: managementHome.city,
    state: managementHome.state,
    postalCode: managementHome.postalCode,
    country: managementHome.country,
    dailyRate: "1650.00",
    description:
      "Operations manager supervising kitchen and dining supervisors plus the cashier and drivers.",
    departmentName: "Management",
    positionName: "Operations Manager",
    userRole: Roles.Manager,
    supervisorUsername: "gm",
  });

  pushStaff({
    username: "minjun.kim",
    email: "minjun.kim@jumbocrab.local",
    firstName: "Minjun",
    lastName: "Kim",
    img: buildProfileImageUrl("Minjun", "Kim", "minjun.kim"),
    sex: GENDER.MALE,
    civilStatus: CIVIL_STATUS.SINGLE,
    nationality: "Korean",
    birthdate: dateAtNoonUtc(1991, 1, 8),
    startDate: dateAtNoonUtc(2024, 2, 4),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: managementHome.address,
    city: managementHome.city,
    state: managementHome.state,
    postalCode: managementHome.postalCode,
    country: managementHome.country,
    dailyRate: "1500.00",
    description:
      "Guest relations manager primarily assisting Korean-speaking customers.",
    departmentName: "Management",
    positionName: "Guest Relations Manager",
    userRole: Roles.Manager,
    supervisorUsername: "gm",
  });

  pushStaff({
    username: "seoyeon.park",
    email: "seoyeon.park@jumbocrab.local",
    firstName: "Seoyeon",
    lastName: "Park",
    img: buildProfileImageUrl("Seoyeon", "Park", "seoyeon.park"),
    sex: GENDER.FEMALE,
    civilStatus: CIVIL_STATUS.SINGLE,
    nationality: "Korean",
    birthdate: dateAtNoonUtc(1993, 6, 19),
    startDate: dateAtNoonUtc(2024, 5, 16),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: managementHome.address,
    city: managementHome.city,
    state: managementHome.state,
    postalCode: managementHome.postalCode,
    country: managementHome.country,
    dailyRate: "1500.00",
    description:
      "Guest relations manager supporting menu translation and customer communication.",
    departmentName: "Management",
    positionName: "Guest Relations Manager",
    userRole: Roles.Manager,
    supervisorUsername: "gm",
  });

  pushStaff({
    username: "kitchen.supervisor",
    email: "kitchen.supervisor@jumbocrab.local",
    firstName: "Rogelio",
    lastName: "Tan",
    img: buildProfileImageUrl("Rogelio", "Tan", "kitchen.supervisor"),
    sex: GENDER.MALE,
    civilStatus: CIVIL_STATUS.MARRIED,
    nationality: "Filipino",
    birthdate: dateAtNoonUtc(1988, 10, 3),
    startDate: dateAtNoonUtc(2023, 9, 15),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: managementHome.address,
    city: managementHome.city,
    state: managementHome.state,
    postalCode: managementHome.postalCode,
    country: managementHome.country,
    dailyRate: "1325.00",
    description: "Kitchen department supervisor under the operations manager.",
    departmentName: "Management",
    positionName: "Kitchen Supervisor",
    userRole: Roles.Supervisor,
    supervisorUsername: "ops.manager",
  });

  pushStaff({
    username: "dining.supervisor",
    email: "dining.supervisor@jumbocrab.local",
    firstName: "Andrea",
    lastName: "Flores",
    img: buildProfileImageUrl("Andrea", "Flores", "dining.supervisor"),
    sex: GENDER.FEMALE,
    civilStatus: CIVIL_STATUS.MARRIED,
    nationality: "Filipino",
    birthdate: dateAtNoonUtc(1990, 2, 27),
    startDate: dateAtNoonUtc(2023, 10, 5),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: managementHome.address,
    city: managementHome.city,
    state: managementHome.state,
    postalCode: managementHome.postalCode,
    country: managementHome.country,
    dailyRate: "1325.00",
    description: "Dining department supervisor under the operations manager.",
    departmentName: "Management",
    positionName: "Dining Supervisor",
    userRole: Roles.Supervisor,
    supervisorUsername: "ops.manager",
  });

  const cashierHome = buildAddress();
  pushStaff({
    username: "clerk",
    email: "clerk@jumbocrab.local",
    firstName: "Jessa",
    lastName: "Bautista",
    img: buildProfileImageUrl("Jessa", "Bautista", "clerk"),
    sex: GENDER.FEMALE,
    civilStatus: CIVIL_STATUS.SINGLE,
    nationality: "Filipino",
    birthdate: dateAtNoonUtc(1996, 7, 14),
    startDate: dateAtNoonUtc(2024, 1, 10),
    employmentStatus: EMPLOYMENT_STATUS.REGULAR,
    currentStatus: CURRENT_STATUS.ACTIVE,
    phone: nextPhone(),
    address: cashierHome.address,
    city: cashierHome.city,
    state: cashierHome.state,
    postalCode: cashierHome.postalCode,
    country: cashierHome.country,
    dailyRate: "925.00",
    description:
      "Cashier-clerk responsible for payroll encoding and receives a payroll-day allowance.",
    departmentName: "Cashier",
    positionName: "Cashier / Clerk",
    userRole: Roles.Clerk,
    supervisorUsername: "ops.manager",
  });

  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Head Chef",
    count: 1,
    regularCount: 1,
    dailyRate: "1450.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
    description: "Leads the kitchen team and coordinates production.",
  });
  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Sous Chef",
    count: 2,
    regularCount: 2,
    dailyRate: "1260.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Line Cook",
    count: 4,
    regularCount: 3,
    dailyRate: "980.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Prep Cook",
    count: 4,
    regularCount: 2,
    dailyRate: "860.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Grill Cook",
    count: 3,
    regularCount: 2,
    dailyRate: "940.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Kitchen",
    positionName: "Steward",
    count: 3,
    regularCount: 1,
    dailyRate: "720.00",
    usernamePrefix: "kitchen",
    supervisorUsername: "kitchen.supervisor",
  });

  pushOperationalGroup({
    departmentName: "Dining",
    positionName: "Dining Captain",
    count: 1,
    regularCount: 1,
    dailyRate: "1180.00",
    usernamePrefix: "dining",
    supervisorUsername: "dining.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Dining",
    positionName: "Senior Server",
    count: 2,
    regularCount: 2,
    dailyRate: "980.00",
    usernamePrefix: "dining",
    supervisorUsername: "dining.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Dining",
    positionName: "Server",
    count: 8,
    regularCount: 4,
    dailyRate: "830.00",
    usernamePrefix: "dining",
    supervisorUsername: "dining.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Dining",
    positionName: "Host",
    count: 2,
    regularCount: 1,
    dailyRate: "780.00",
    usernamePrefix: "dining",
    supervisorUsername: "dining.supervisor",
  });
  pushOperationalGroup({
    departmentName: "Dining",
    positionName: "Busser",
    count: 2,
    regularCount: 1,
    dailyRate: "730.00",
    usernamePrefix: "dining",
    supervisorUsername: "dining.supervisor",
  });

  pushOperationalGroup({
    departmentName: "Cashier",
    positionName: "Cashier",
    count: 2,
    regularCount: 2,
    dailyRate: "820.00",
    usernamePrefix: "cashier",
    supervisorUsername: "ops.manager",
  });

  pushOperationalGroup({
    departmentName: "Transportation / Drivers",
    positionName: "Driver",
    count: 4,
    regularCount: 3,
    dailyRate: "880.00",
    usernamePrefix: "driver",
    supervisorUsername: "ops.manager",
  });

  if (staff.length !== 44) {
    throw new Error(`Expected 44 staff records, got ${staff.length}`);
  }

  const regularCount = staff.filter(
    (member) => member.employmentStatus === EMPLOYMENT_STATUS.REGULAR,
  ).length;
  const probationaryCount = staff.filter(
    (member) => member.employmentStatus === EMPLOYMENT_STATUS.PROBATIONARY,
  ).length;

  if (regularCount !== 31 || probationaryCount !== 13) {
    throw new Error(
      `Expected 31 regular and 13 probationary staff, got ${regularCount} regular and ${probationaryCount} probationary`,
    );
  }

  return staff;
}

async function seedUsers(staff: StaffSeed[]) {
  const credentials = await hashPassword(DEFAULT_PASSWORD);
  const users: UserDirectory = {};

  const userSeeds = [
    {
      username: "admin",
      email: "admin@jumbocrab.local",
      role: Roles.Admin,
    },
    {
      username: "gm",
      email: "gm@jumbocrab.local",
      role: Roles.GeneralManager,
    },
    ...staff.map((member) => ({
      username: member.username,
      email: member.email,
      role: member.userRole,
    })),
  ];

  for (const seed of userSeeds) {
    const user = await prisma.user.create({
      data: {
        username: seed.username,
        email: seed.email,
        role: seed.role,
        password: credentials.hash,
        salt: credentials.salt,
        isDisabled: false,
      },
    });
    users[seed.username] = { userId: user.userId, role: user.role };
  }

  return users;
}

async function seedOrg(staff: StaffSeed[]) {
  const deptMap = {} as Record<DepartmentName, string>;

  for (const seed of buildDepartmentSeeds()) {
    const row = await prisma.department.create({
      data: {
        name: seed.name,
        description: seed.description,
        isActive: true,
      },
    });
    deptMap[seed.name] = row.departmentId;
  }

  const positionMap: Record<string, string> = {};
  for (const seed of buildPositionSeeds(staff)) {
    const row = await prisma.position.create({
      data: {
        name: seed.name,
        description: seed.description,
        departmentId: deptMap[seed.departmentName],
        isActive: true,
      },
    });
    positionMap[`${seed.departmentName}:${seed.name}`] = row.positionId;
  }

  return { deptMap, positionMap } satisfies OrgMaps;
}

function buildContributionValues(dailyRate: number) {
  const monthlyBase = dailyRate * 26;
  const sssEe = roundMoney(Math.min(900, Math.max(250, monthlyBase * 0.045)));
  const sssEr = roundMoney(sssEe * 1.8);
  const philHealthEe = roundMoney(
    Math.min(900, Math.max(150, monthlyBase * 0.015)),
  );
  const philHealthEr = philHealthEe;
  const pagIbigEe = roundMoney(Math.min(100, Math.max(50, monthlyBase * 0.02)));
  const pagIbigEr = pagIbigEe;
  const withholdingEe = roundMoney(
    monthlyBase >= 24000
      ? monthlyBase * 0.04
      : monthlyBase >= 18000
        ? monthlyBase * 0.02
        : monthlyBase >= 14000
          ? monthlyBase * 0.01
          : 0,
  );

  return {
    sssEe,
    sssEr,
    philHealthEe,
    philHealthEr,
    pagIbigEe,
    pagIbigEr,
    withholdingEe,
  };
}

async function seedEmployees(staff: StaffSeed[], users: UserDirectory, maps: OrgMaps) {
  const seededEmployees: SeededEmployee[] = [];
  const gmUserId = users.gm?.userId ?? null;

  for (const member of staff) {
    const row = await prisma.employee.create({
      data: {
        employeeCode: member.employeeCode,
        firstName: member.firstName,
        lastName: member.lastName,
        img: member.img,
        sex: member.sex,
        civilStatus: member.civilStatus,
        nationality: member.nationality,
        birthdate: member.birthdate,
        address: member.address,
        city: member.city,
        state: member.state,
        postalCode: member.postalCode,
        country: member.country,
        startDate: member.startDate,
        employmentStatus: member.employmentStatus,
        currentStatus: member.currentStatus,
        email: member.email,
        phone: member.phone,
        emergencyContactName: `${member.lastName} Family`,
        emergencyContactRelationship: "Relative",
        emergencyContactPhone: member.phone,
        emergencyContactEmail: member.email,
        dailyRate: new Prisma.Decimal(member.dailyRate),
        description: member.description,
        isArchived: false,
        userId: users[member.username]?.userId,
        departmentId: maps.deptMap[member.departmentName],
        positionId: maps.positionMap[`${member.departmentName}:${member.positionName}`],
        supervisorUserId: member.supervisorUsername
          ? users[member.supervisorUsername]?.userId
          : gmUserId,
      },
    });

    await prisma.governmentId.create({
      data: {
        employeeId: row.employeeId,
        sssNumber: `34${row.employeeCode.replace(/\D/g, "").padStart(8, "0")}`,
        philHealthNumber: `71${row.employeeCode.replace(/\D/g, "").padStart(8, "0")}`,
        tinNumber: `52${row.employeeCode.replace(/\D/g, "").padStart(7, "0")}`,
        pagIbigNumber: `12${row.employeeCode.replace(/\D/g, "").padStart(8, "0")}`,
      },
    });

    const contributions = buildContributionValues(Number(member.dailyRate));
    await prisma.employeeContribution.create({
      data: {
        employeeId: row.employeeId,
        sssEe: contributions.sssEe,
        sssEr: contributions.sssEr,
        philHealthEe: contributions.philHealthEe,
        philHealthEr: contributions.philHealthEr,
        pagIbigEe: contributions.pagIbigEe,
        pagIbigEr: contributions.pagIbigEr,
        withholdingEe: contributions.withholdingEe,
        withholdingEr: 0,
        isSssActive: true,
        isPhilHealthActive: true,
        isPagIbigActive: true,
        isWithholdingActive: true,
        effectiveDate: CONTRIBUTION_EFFECTIVE_AT,
        createdById: gmUserId,
        updatedById: gmUserId,
      },
    });

    await prisma.employeeRateHistory.create({
      data: {
        employeeId: row.employeeId,
        dailyRate: new Prisma.Decimal(member.dailyRate),
        effectiveFrom: member.startDate,
        reason: "Initial seed rate",
      },
    });

    seededEmployees.push({
      ...member,
      employeeId: row.employeeId,
    });
  }

  return seededEmployees;
}

async function seedDeductionTypes(users: UserDirectory) {
  const gmUserId = users.gm?.userId ?? null;

  const types = [
    {
      code: "CASH_ADVANCE",
      name: "Cash Advance",
      description: "Installment-based cash advances approved by management.",
      amountMode: "FIXED" as const,
      frequency: "INSTALLMENT" as const,
      defaultAmount: "3000.00",
      defaultPercent: null,
    },
    {
      code: "UNIFORM_REPLACEMENT",
      name: "Uniform Replacement",
      description: "One-time uniform replacement charge when needed.",
      amountMode: "FIXED" as const,
      frequency: "ONE_TIME" as const,
      defaultAmount: "500.00",
      defaultPercent: null,
    },
    {
      code: "MEAL_CHARGE",
      name: "Meal Charge",
      description: "Recurring staff meal charge deducted per payroll.",
      amountMode: "FIXED" as const,
      frequency: "PER_PAYROLL" as const,
      defaultAmount: "150.00",
      defaultPercent: null,
    },
  ];

  const result: Record<string, string> = {};

  for (const type of types) {
    const row = await prisma.deductionType.create({
      data: {
        code: type.code,
        name: type.name,
        description: type.description,
        amountMode: type.amountMode,
        frequency: type.frequency,
        defaultAmount: type.defaultAmount
          ? new Prisma.Decimal(type.defaultAmount)
          : null,
        defaultPercent: type.defaultPercent,
        isActive: true,
        createdByUserId: gmUserId,
        updatedByUserId: gmUserId,
      },
    });
    result[type.code] = row.id;
  }

  return result;
}

async function seedDeductionAssignments(
  employees: SeededEmployee[],
  users: UserDirectory,
  deductionTypeMap: Record<string, string>,
) {
  const clerkUserId = users.clerk?.userId ?? null;
  const opsManagerUserId = users["ops.manager"]?.userId ?? null;

  const driverCashAdvance = employees.find(
    (employee) => employee.username === "driver01",
  );
  const serverUniform = employees.find(
    (employee) => employee.username === "dining04",
  );
  const kitchenMeal = employees.find(
    (employee) => employee.username === "kitchen08",
  );

  if (driverCashAdvance) {
    const assignment = await prisma.employeeDeductionAssignment.create({
      data: {
        employeeId: driverCashAdvance.employeeId,
        deductionTypeId: deductionTypeMap.CASH_ADVANCE,
        effectiveFrom: dateAtNoonUtc(2026, 1, 16),
        amountOverride: new Prisma.Decimal("4000.00"),
        installmentTotal: new Prisma.Decimal("4000.00"),
        installmentPerPayroll: new Prisma.Decimal("500.00"),
        remainingBalance: new Prisma.Decimal("2500.00"),
        workflowStatus: "APPROVED",
        status: "ACTIVE",
        reason: "Approved motorcycle repair cash advance.",
        assignedByUserId: opsManagerUserId,
        updatedByUserId: clerkUserId,
        submittedAt: dateAtNoonUtc(2026, 1, 15),
        reviewedByUserId: opsManagerUserId,
        reviewedAt: dateAtNoonUtc(2026, 1, 15),
      },
    });

    await prisma.employeeDeductionPayment.create({
      data: {
        assignmentId: assignment.id,
        amount: new Prisma.Decimal("1500.00"),
        paymentDate: dateAtNoonUtc(2026, 2, 16),
        remarks: "Released payroll deductions posted before seed reset.",
        createdByUserId: clerkUserId,
      },
    });
  }

  if (serverUniform) {
    await prisma.employeeDeductionAssignment.create({
      data: {
        employeeId: serverUniform.employeeId,
        deductionTypeId: deductionTypeMap.UNIFORM_REPLACEMENT,
        effectiveFrom: dateAtNoonUtc(2026, 2, 1),
        amountOverride: new Prisma.Decimal("500.00"),
        workflowStatus: "APPROVED",
        status: "ACTIVE",
        reason: "Replacement apron and service uniform.",
        assignedByUserId: clerkUserId,
        updatedByUserId: clerkUserId,
        submittedAt: dateAtNoonUtc(2026, 1, 28),
        reviewedByUserId: opsManagerUserId,
        reviewedAt: dateAtNoonUtc(2026, 1, 29),
      },
    });
  }

  if (kitchenMeal) {
    await prisma.employeeDeductionAssignment.create({
      data: {
        employeeId: kitchenMeal.employeeId,
        deductionTypeId: deductionTypeMap.MEAL_CHARGE,
        effectiveFrom: dateAtNoonUtc(2026, 0, 16),
        amountOverride: new Prisma.Decimal("150.00"),
        workflowStatus: "APPROVED",
        status: "ACTIVE",
        reason: "Recurring staff meal charge.",
        assignedByUserId: clerkUserId,
        updatedByUserId: clerkUserId,
        submittedAt: dateAtNoonUtc(2026, 0, 15),
        reviewedByUserId: opsManagerUserId,
        reviewedAt: dateAtNoonUtc(2026, 0, 15),
      },
    });
  }
}

async function seedViolations(employees: SeededEmployee[], users: UserDirectory) {
  const opsManagerUserId = users["ops.manager"]?.userId ?? null;
  const clerkUserId = users.clerk?.userId ?? null;

  const violations = [
    {
      name: "Late For Duty",
      description: "Employee reported late for the assigned shift.",
      defaultStrikePoints: 1,
      maxStrikesPerEmployee: 3,
    },
    {
      name: "No Call / No Show",
      description: "Employee failed to report to work without notice.",
      defaultStrikePoints: 2,
      maxStrikesPerEmployee: 3,
    },
    {
      name: "Improper Uniform",
      description: "Employee failed to comply with the restaurant uniform policy.",
      defaultStrikePoints: 1,
      maxStrikesPerEmployee: 3,
    },
  ];

  const violationMap: Record<string, string> = {};
  for (const violation of violations) {
    const row = await prisma.violation.create({
      data: violation,
    });
    violationMap[violation.name] = row.violationId;
  }

  const samples = [
    {
      username: "dining05",
      violationName: "Late For Duty",
      date: dateAtNoonUtc(2026, 2, 4),
      status: "APPROVED" as const,
      remarks: "Arrived after shift briefing on a busy Friday.",
      isAcknowledged: true,
    },
    {
      username: "kitchen10",
      violationName: "Improper Uniform",
      date: dateAtNoonUtc(2026, 2, 8),
      status: "APPROVED" as const,
      remarks: "Missing apron during lunch prep.",
      isAcknowledged: false,
    },
    {
      username: "driver03",
      violationName: "No Call / No Show",
      date: dateAtNoonUtc(2026, 2, 12),
      status: "DRAFT" as const,
      remarks: "Pending manager review after missed delivery run.",
      isAcknowledged: false,
    },
  ];

  for (const sample of samples) {
    const employee = employees.find((member) => member.username === sample.username);
    if (!employee) continue;

    await prisma.employeeViolation.create({
      data: {
        employeeId: employee.employeeId,
        violationId: violationMap[sample.violationName],
        violationDate: sample.date,
        strikePointsSnapshot:
          sample.violationName === "No Call / No Show" ? 2 : 1,
        status: sample.status,
        draftedById: clerkUserId,
        submittedAt: sample.date,
        reviewedById: sample.status === "APPROVED" ? opsManagerUserId : null,
        reviewedAt: sample.status === "APPROVED" ? addDays(sample.date, 1) : null,
        reviewRemarks:
          sample.status === "APPROVED" ? "Recorded and acknowledged in seed data." : null,
        isAcknowledged: sample.isAcknowledged,
        acknowledgedAt: sample.isAcknowledged ? addDays(sample.date, 2) : null,
        remarks: sample.remarks,
        isCountedForStrike: true,
      },
    });
  }
}

async function seedShiftsAndPatterns() {
  const shifts = [
    {
      code: "AM_SHIFT",
      name: "Morning Shift",
      startMinutes: 10 * 60 + 30,
      endMinutes: 22 * 60,
      spansMidnight: false,
      breakStartMinutes: 14 * 60 + 30,
      breakEndMinutes: 18 * 60,
      breakMinutesUnpaid: 210,
      paidHoursPerDay: "8.00",
      notes: "10:30 AM to 10:00 PM with a 3.5-hour break.",
    },
    {
      code: "PM_SHIFT",
      name: "Afternoon Shift",
      startMinutes: 13 * 60,
      endMinutes: 22 * 60,
      spansMidnight: false,
      breakStartMinutes: 17 * 60,
      breakEndMinutes: 18 * 60,
      breakMinutesUnpaid: 60,
      paidHoursPerDay: "8.00",
      notes: "1:00 PM to 10:00 PM with a dinner break.",
    },
  ] as const;

  const shiftsByCode = new Map<string, Shift>();
  for (const seed of shifts) {
    const row = await prisma.shift.create({
      data: {
        code: seed.code,
        name: seed.name,
        startMinutes: seed.startMinutes,
        endMinutes: seed.endMinutes,
        spansMidnight: seed.spansMidnight,
        breakStartMinutes: seed.breakStartMinutes,
        breakEndMinutes: seed.breakEndMinutes,
        breakMinutesUnpaid: seed.breakMinutesUnpaid,
        paidHoursPerDay: new Prisma.Decimal(seed.paidHoursPerDay),
        isActive: true,
        notes: seed.notes,
      },
    });
    shiftsByCode.set(seed.code, row);
  }

  const amShiftId = shiftsByCode.get("AM_SHIFT")?.id ?? null;
  const pmShiftId = shiftsByCode.get("PM_SHIFT")?.id ?? null;

  const patternSeeds = [
    {
      code: "ROT-A",
      name: "Rotation A",
      sunShiftId: pmShiftId,
      monShiftId: null,
      tueShiftId: amShiftId,
      wedShiftId: amShiftId,
      thuShiftId: pmShiftId,
      friShiftId: amShiftId,
      satShiftId: pmShiftId,
    },
    {
      code: "ROT-B",
      name: "Rotation B",
      sunShiftId: amShiftId,
      monShiftId: pmShiftId,
      tueShiftId: null,
      wedShiftId: pmShiftId,
      thuShiftId: amShiftId,
      friShiftId: pmShiftId,
      satShiftId: amShiftId,
    },
    {
      code: "ROT-C",
      name: "Rotation C",
      sunShiftId: pmShiftId,
      monShiftId: amShiftId,
      tueShiftId: pmShiftId,
      wedShiftId: null,
      thuShiftId: amShiftId,
      friShiftId: pmShiftId,
      satShiftId: amShiftId,
    },
    {
      code: "ROT-D",
      name: "Rotation D",
      sunShiftId: amShiftId,
      monShiftId: pmShiftId,
      tueShiftId: amShiftId,
      wedShiftId: pmShiftId,
      thuShiftId: null,
      friShiftId: amShiftId,
      satShiftId: pmShiftId,
    },
  ] as const;

  const patterns: WeeklyPattern[] = [];
  for (const seed of patternSeeds) {
    const row = await prisma.weeklyPattern.create({
      data: {
        code: seed.code,
        name: seed.name,
        isActive: true,
        sunShiftId: seed.sunShiftId,
        monShiftId: seed.monShiftId,
        tueShiftId: seed.tueShiftId,
        wedShiftId: seed.wedShiftId,
        thuShiftId: seed.thuShiftId,
        friShiftId: seed.friShiftId,
        satShiftId: seed.satShiftId,
      },
    });
    patterns.push(row);
  }

  return { shiftsByCode, patterns };
}

async function seedPatternAssignments(
  employees: SeededEmployee[],
  patterns: WeeklyPattern[],
) {
  const now = nowInManila();
  const assignmentStart = startOfManilaWeek(addDays(startOfManilaMonth(now), -28));
  const assignmentEnd = startOfManilaWeek(addDays(now, 21));

  for (
    let cursor = new Date(assignmentStart);
    cursor.getTime() <= assignmentEnd.getTime();
    cursor = addDays(cursor, 7)
  ) {
    const weekIndex = Math.round(
      (cursor.getTime() - assignmentStart.getTime()) / (7 * DAY_MS),
    );

    for (const [employeeIndex, employee] of employees.entries()) {
      const pattern = patterns[(employeeIndex + weekIndex) % patterns.length];
      await prisma.employeePatternAssignment.create({
        data: {
          employeeId: employee.employeeId,
          patternId: pattern.id,
          effectiveDate: cursor,
          reason: "Weekly restaurant schedule rotation",
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

  return assignmentStart;
}

function resolvePatternForDay(
  employeeIndex: number,
  dayStart: Date,
  assignmentStart: Date,
  patterns: WeeklyPattern[],
) {
  const weekStart = startOfManilaWeek(dayStart);
  const weekIndex = Math.floor(
    (weekStart.getTime() - assignmentStart.getTime()) / (7 * DAY_MS),
  );
  const normalizedWeekIndex = Math.max(0, weekIndex);
  return patterns[(employeeIndex + normalizedWeekIndex) % patterns.length];
}

async function seedAttendance(
  employees: SeededEmployee[],
  patterns: WeeklyPattern[],
  shiftsByCode: Map<string, Shift>,
  assignmentStart: Date,
) {
  const now = nowInManila();
  const monthStart = startOfManilaMonth(now);
  const today = toManilaDayStart(now);
  const shiftsById = new Map<number, Shift>();
  shiftsByCode.forEach((shift) => shiftsById.set(shift.id, shift));

  for (const [employeeIndex, employee] of employees.entries()) {
    for (
      let cursor = new Date(monthStart);
      cursor.getTime() <= today.getTime();
      cursor = addDays(cursor, 1)
    ) {
      const dayStart = new Date(cursor);
      const pattern = resolvePatternForDay(
        employeeIndex,
        dayStart,
        assignmentStart,
        patterns,
      );
      const weekday = manilaWeekday(dayStart);
      const dayOfMonth = manilaDayOfMonth(dayStart);
      const shiftId = shiftIdForWeekday(pattern, weekday);
      const shift = shiftId ? shiftsById.get(shiftId) ?? null : null;
      const isBusyDay = weekday === 5 || weekday === 6 || weekday === 0;
      const isPastLocked = dayStart.getTime() < today.getTime();

      if (!shift) {
        await prisma.attendance.create({
          data: {
            employeeId: employee.employeeId,
            workDate: dayStart,
            status: ATTENDANCE_STATUS.REST,
            isLocked: isPastLocked,
          },
        });
        continue;
      }

      const absenceModulo =
        employee.userRole === Roles.Manager ||
        employee.userRole === Roles.Supervisor ||
        employee.userRole === Roles.Clerk
          ? 31
          : 19;
      const isAbsent =
        !isBusyDay && (employeeIndex + dayOfMonth + 1) % absenceModulo === 0;
      const isLate = !isAbsent && (employeeIndex + dayOfMonth) % 7 === 0;
      const overtimeSeed = employeeIndex + dayOfMonth;
      const approvedOvertimeMinutes = isAbsent
        ? 0
        : isBusyDay
          ? overtimeSeed % 4 === 0
            ? 45
            : overtimeSeed % 3 === 0
              ? 30
              : 0
          : overtimeSeed % 13 === 0
            ? 15
            : 0;

      if (isAbsent) {
        await prisma.attendance.create({
          data: {
            employeeId: employee.employeeId,
            workDate: dayStart,
            status: ATTENDANCE_STATUS.ABSENT,
            expectedShiftId: shift.id,
            scheduledStartMinutes: shift.startMinutes,
            scheduledEndMinutes: shift.endMinutes,
            paidHoursPerDay: shift.paidHoursPerDay,
            isLocked: isPastLocked,
          },
        });
        continue;
      }

      const lateMinutes = isLate ? 10 + ((employeeIndex + dayOfMonth) % 11) : 0;
      const breakStartMinutes =
        shift.breakStartMinutes ?? shift.startMinutes + 4 * 60;
      const breakEndMinutes =
        shift.breakEndMinutes ??
        breakStartMinutes + Math.max(shift.breakMinutesUnpaid, 30);
      const actualInMinutes = shift.startMinutes + lateMinutes;
      const actualOutMinutes = shift.endMinutes + approvedOvertimeMinutes;
      const workedMinutes = diffMinutes(actualInMinutes, actualOutMinutes);
      const actualBreakMinutes = diffMinutes(breakStartMinutes, breakEndMinutes);
      const deductedBreakMinutes = Math.max(
        shift.breakMinutesUnpaid,
        actualBreakMinutes,
      );
      const netWorkedMinutes = Math.max(0, workedMinutes - deductedBreakMinutes);
      const scheduledPaidMinutes =
        Number.parseFloat(shift.paidHoursPerDay.toString()) * 60;
      const undertimeMinutes = Math.max(0, scheduledPaidMinutes - netWorkedMinutes);
      const overtimeMinutesRaw = Math.max(
        0,
        netWorkedMinutes - scheduledPaidMinutes,
      );

      const actualInAt = minutesToDate(dayStart, actualInMinutes);
      const breakOutAt = minutesToDate(dayStart, breakStartMinutes);
      const breakInAt = minutesToDate(dayStart, breakEndMinutes);
      const actualOutAt = minutesToDate(dayStart, actualOutMinutes);

      const attendance = await prisma.attendance.create({
        data: {
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
          overtimeMinutesApproved: approvedOvertimeMinutes,
          nightMinutes: 0,
          isLocked: isPastLocked,
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
  console.log(`Resetting database and seeding ${RESTAURANT_NAME}...`);
  console.log(`Location: ${RESTAURANT_LOCATION}`);
  console.log(`Restaurant established: ${ESTABLISHED_AT.toISOString().slice(0, 10)}`);

  await resetDatabase();

  const staff = buildStaffBlueprint();
  const users = await seedUsers(staff);
  const orgMaps = await seedOrg(staff);
  const employees = await seedEmployees(staff, users, orgMaps);
  const deductionTypeMap = await seedDeductionTypes(users);
  await seedDeductionAssignments(employees, users, deductionTypeMap);
  await seedViolations(employees, users);
  const { shiftsByCode, patterns } = await seedShiftsAndPatterns();
  const assignmentStart = await seedPatternAssignments(employees, patterns);
  await seedAttendance(employees, patterns, shiftsByCode, assignmentStart);

  const departmentSummary = employees.reduce<Record<string, number>>((acc, employee) => {
    acc[employee.departmentName] = (acc[employee.departmentName] ?? 0) + 1;
    return acc;
  }, {});

  const roleSummary = employees.reduce<Record<string, number>>((acc, employee) => {
    const label = employee.userRole;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Seed complete.");
  console.log(`Default password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log(`Staff records seeded: ${employees.length}`);
  console.log(
    `Employment mix: ${employees.filter((employee) => employee.employmentStatus === EMPLOYMENT_STATUS.REGULAR).length} regular / ${employees.filter((employee) => employee.employmentStatus === EMPLOYMENT_STATUS.PROBATIONARY).length} probationary`,
  );
  console.log("Departments:", departmentSummary);
  console.log("Role-linked employee accounts:", roleSummary);
  console.log(
    "Management accounts:",
    ["admin", "gm", "ops.manager", "minjun.kim", "seoyeon.park", "kitchen.supervisor", "dining.supervisor", "clerk"].join(", "),
  );
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
