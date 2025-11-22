import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const departments = ["KITCHEN", "DINING"] as const;
const employmentStatuses = ["REGULAR", "PROBATIONARY", "TRAINING"] as const;
const currentStatuses = [
  "ACTIVE",
  "ON_LEAVE",
  "VACATION",
  "SICK_LEAVE",
  "INACTIVE",
] as const;
const genders = ["MALE", "FEMALE"] as const;
const civilStatuses = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;

async function main() {
  console.log("Seeding 50 employees...");

  // Generate deterministic employee codes EMP-001 ... EMP-050
  const codes = Array.from({ length: 50 }, (_, i) =>
    `EMP-${String(i + 1).padStart(3, "0")}`
  );

  const employees = codes.map((code) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const startDate = faker.date.past({ years: 3 });
    const birthdate = faker.date.birthdate({ min: 20, max: 50, mode: "age" });
    const isInactive = faker.datatype.boolean({ probability: 0.1 });
    return {
      employeeId: faker.string.uuid(),
      employeeCode: code,
      firstName,
      lastName,
      middleName: faker.datatype.boolean({ probability: 0.3 })
        ? faker.person.middleName()
        : null,
      suffix: null,
      sex: faker.helpers.arrayElement(genders),
      civilStatus: faker.helpers.arrayElement(civilStatuses),
      nationality: "Filipino",
      birthdate,
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country(),
      img: faker.image.avatarGitHub(),
      startDate,
      isEnded: isInactive,
      endDate: isInactive ? faker.date.soon({ days: 30, refDate: startDate }) : null,
      position: faker.person.jobTitle(),
      department: faker.helpers.arrayElement(departments),
      employmentStatus: faker.helpers.arrayElement(employmentStatuses),
      currentStatus: isInactive
        ? faker.helpers.arrayElement(["INACTIVE", "ENDED"] as const)
        : faker.helpers.arrayElement(currentStatuses),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      phone: faker.phone.number(),
      emergencyContactName: faker.person.fullName(),
      emergencyContactRelationship: "Relative",
      emergencyContactPhone: faker.phone.number(),
      emergencyContactEmail: faker.internet.email(),
      description: faker.lorem.sentence(),
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // createMany skips relation writes; that's fine for standalone employees
  await prisma.employee.createMany({
    data: employees,
    skipDuplicates: true,
  });

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
