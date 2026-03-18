import "dotenv/config";
import crypto from "crypto";
import { Prisma, PrismaClient, Roles } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const EMPLOYEE_COUNT = 43;
const DEFAULT_PASSWORD = "password";

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
  return { salt, hash: derivedKey.toString("hex") };
}

async function upsertUser(
  username: string,
  email: string,
  role: Roles,
  password: { hash: string; salt: string },
) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { userId: true },
  });

  return existing
    ? prisma.user.update({
        where: { userId: existing.userId },
        data: {
          username,
          email,
          role,
          password: password.hash,
          salt: password.salt,
          isDisabled: false,
        },
      })
    : prisma.user.create({
        data: {
          username,
          email,
          role,
          password: password.hash,
          salt: password.salt,
          isDisabled: false,
        },
      });
}

async function main() {
  faker.seed(43001);
  console.log("Seeding 1 GM account + 43 employees...");

  const password = await hashPassword(DEFAULT_PASSWORD);

  const gmUser = await upsertUser(
    "gm",
    "gm@demo.com",
    Roles.GeneralManager,
    password,
  );

  const engineeringDepartment = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {
      isActive: true,
      description: "Seeded engineering department",
    },
    create: {
      name: "Engineering",
      description: "Seeded engineering department",
      isActive: true,
    },
  });

  const staffPosition = await prisma.position.upsert({
    where: {
      name_departmentId: {
        name: "Staff",
        departmentId: engineeringDepartment.departmentId,
      },
    },
    update: {
      isActive: true,
      description: "Seeded staff role",
    },
    create: {
      name: "Staff",
      description: "Seeded staff role",
      isActive: true,
      departmentId: engineeringDepartment.departmentId,
    },
  });

  const baseStartDate = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));

  for (let index = 1; index <= EMPLOYEE_COUNT; index += 1) {
    const code = `EMP-${index.toString().padStart(3, "0")}`;
    const username = `emp${index.toString().padStart(3, "0")}`;
    const email = `${username}@demo.com`;

    const user = await upsertUser(username, email, Roles.Employee, password);

    const sex = faker.helpers.arrayElement(["MALE", "FEMALE"] as const);
    const firstName = faker.person.firstName(
      sex === "MALE" ? "male" : "female",
    );
    const lastName = faker.person.lastName();

    const employeeStartDate = new Date(baseStartDate);
    employeeStartDate.setUTCDate(employeeStartDate.getUTCDate() + index);

    await prisma.employee.upsert({
      where: { employeeCode: code },
      update: {
        firstName,
        lastName,
        sex,
        civilStatus: "SINGLE",
        birthdate: faker.date.birthdate({ min: 21, max: 45, mode: "age" }),
        startDate: employeeStartDate,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        email,
        phone: `0917${(1000000 + index * 1234).toString().slice(0, 7)}`,
        dailyRate: new Prisma.Decimal((700 + index * 12).toFixed(2)),
        isArchived: false,
        userId: user.userId,
        departmentId: engineeringDepartment.departmentId,
        positionId: staffPosition.positionId,
      },
      create: {
        employeeCode: code,
        firstName,
        lastName,
        sex,
        civilStatus: "SINGLE",
        birthdate: faker.date.birthdate({ min: 21, max: 45, mode: "age" }),
        startDate: employeeStartDate,
        employmentStatus: "REGULAR",
        currentStatus: "ACTIVE",
        email,
        phone: `0917${(1000000 + index * 1234).toString().slice(0, 7)}`,
        dailyRate: new Prisma.Decimal((700 + index * 12).toFixed(2)),
        isArchived: false,
        userId: user.userId,
        departmentId: engineeringDepartment.departmentId,
        positionId: staffPosition.positionId,
      },
    });
  }

  console.log(
    `Seed complete. GM: ${gmUser.username}. Employees seeded: ${EMPLOYEE_COUNT}.`,
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
