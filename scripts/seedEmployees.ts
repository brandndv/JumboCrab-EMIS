import "dotenv/config";
import crypto from "crypto";
import { PrismaClient, Roles } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Make sure DB connection string exists before running.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

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
    { username: "admin", email: "admin@demo.com", role: Roles.admin },
    { username: "gm", email: "gm@demo.com", role: Roles.generalManager },
    { username: "manager", email: "manager@demo.com", role: Roles.manager },
    { username: "supervisor", email: "supervisor@demo.com", role: Roles.supervisor },
    { username: "clerk", email: "clerk@demo.com", role: Roles.clerk },
    { username: "emp1", email: "emp1@demo.com", role: Roles.employee },
    { username: "emp2", email: "emp2@demo.com", role: Roles.employee },
    { username: "emp3", email: "emp3@demo.com", role: Roles.employee },
  ];

  const users: Record<string, { userId: string; role: Roles }> = {};

  for (const entry of entries) {
    const user = await prisma.user.upsert({
      where: { username: entry.username },
      update: {
        email: entry.email,
        role: entry.role,
        password: hash,
        salt,
        isDisabled: false,
      },
      create: {
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

async function seedEmployees(users: Record<string, { userId: string; role: Roles }>, maps: {
  deptMap: Record<string, string>;
  positionMap: Record<string, string>;
}) {
  const supervisorId = users["supervisor"]?.userId ?? null;

  // Small, explicit employee set so you can see assignments clearly.
  const employees = [
    {
      code: "EMP-001",
      first: "Brandon",
      last: "Lamagna",
      dept: "Engineering",
      pos: "Software Engineer",
      userKey: "emp1",
    },
    {
      code: "EMP-002",
      first: "Rosemary",
      last: "Rohan",
      dept: "Engineering",
      pos: "QA Analyst",
      userKey: "emp2",
    },
    {
      code: "EMP-003",
      first: "Alanis",
      last: "Graham",
      dept: "Operations",
      pos: "Ops Specialist",
      userKey: "emp3",
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
        isArchived: false,
        userId: users[emp.userKey]?.userId,
      },
      include: { contribution: true },
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
}

async function main() {
  console.log("Seeding users, org, and employees...");
  const users = await seedUsers();
  const maps = await seedOrg();
  await seedEmployees(users, maps);
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
