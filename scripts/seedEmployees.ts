import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { GENDER, CIVIL_STATUS, EMPLOYMENT_STATUS, CURRENT_STATUS, SUFFIX } from '../src/lib/validations/employees.js';

const prisma = new PrismaClient();

// Array of possible departments
const DEPARTMENTS = ["KITCHEN", "DINING"];

// Array of possible positions
const POSITIONS = [
  "Chef", "Sous Chef", "Line Cook", "Prep Cook", "Dishwasher",
  "Server", "Host/Hostess", "Bartender", "Barista", "Busser",
  "Manager", "Assistant Manager", "Cashier", "Delivery Driver"
];

// Function to generate a random employee
function createRandomEmployee(index: number) {
  const gender = faker.helpers.arrayElement(Object.values(GENDER));
  const firstName = faker.person.firstName(gender.toLowerCase() as any);
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName }).toLowerCase();
  
  return {
    id: faker.string.uuid(),
    employeeCode: `EMP-${String(index + 1).padStart(4, '0')}`,
    firstName,
    lastName,
    middleName: faker.helpers.maybe(() => faker.person.firstName(), { probability: 0.7 }) || null,
    suffix: faker.helpers.maybe(() => faker.helpers.arrayElement(Object.values(SUFFIX)) as any, { probability: 0.2 }) || null,
    sex: gender,
    civilStatus: faker.helpers.arrayElement(Object.values(CIVIL_STATUS)),
    nationality: faker.location.country(),
    birthdate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    postalCode: faker.location.zipCode(),
    country: faker.location.country(),
    img: null,
    startDate: faker.date.past({ years: 5 }),
    endDate: faker.helpers.maybe(() => {
      // Generate a date between now and 1 year from now
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + faker.number.int({ min: 1, max: 12 }));
      return futureDate;
    }, { probability: 0.2 }) || null,
    position: faker.helpers.arrayElement(POSITIONS),
    department: faker.helpers.arrayElement(DEPARTMENTS),
    employmentStatus: faker.helpers.arrayElement(Object.values(EMPLOYMENT_STATUS)),
    currentStatus: faker.helpers.arrayElement(Object.values(CURRENT_STATUS)),
    email: faker.helpers.maybe(() => email, { probability: 0.9 }) || null,
    phone: faker.phone.number(),
    emergencyContactName: faker.person.fullName(),
    emergencyContactRelationship: faker.helpers.arrayElement(["Spouse", "Parent", "Sibling", "Friend", "Relative"]),
    emergencyContactPhone: faker.phone.number(),
    emergencyContactEmail: faker.internet.email(),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }) || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function main() {
  console.log('🌱 Seeding database with 50 employees...');
  
  // Generate 50 random employees
  const employees = Array.from({ length: 50 }, (_, i) => createRandomEmployee(i));
  
  // Delete all existing employees first
  await prisma.employee.deleteMany({});
  console.log('🧹 Cleared existing employees');
  
  // Create all employees
  for (const employee of employees) {
    await prisma.employee.create({
      data: employee,
    });
  }
  
  console.log('✅ Successfully seeded 50 employees');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
