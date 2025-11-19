import { PrismaClient, SUFFIX, GENDER, CIVIL_STATUS, EMPLOYMENT_STATUS, CURRENT_STATUS } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const departments = ['KITCHEN', 'DINING', 'SERVICE', 'MANAGEMENT'];
const positions = [
  'Head Chef',
  'Sous Chef',
  'Line Cook',
  'Waiter',
  'Waitress',
  'Host',
  'Manager',
  'Assistant Manager'
];

const firstNames = [
  'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa',
  'James', 'Jennifer', 'William', 'Elizabeth', 'Richard', 'Maria', 'Charles'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson'
];

const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];

const getRandomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const generateEmployeeCode = (index: number) => {
  return `EMP-${String(index + 1).padStart(3, '0')}`;
};

async function main() {
  console.log('Starting to seed employees...');
  
  // Create 10 employee records
  const employees = Array.from({ length: 10 }, (_, i) => {
    const gender: GENDER = Math.random() > 0.5 ? GENDER.MALE : GENDER.FEMALE;
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const position = positions[Math.floor(Math.random() * positions.length)];
    const startDate = getRandomDate(new Date(2020, 0, 1), new Date(2023, 11, 31));
    const birthdate = getRandomDate(new Date(1970, 0, 1), new Date(2000, 11, 31));
    const civilStatuses: CIVIL_STATUS[] = [
      CIVIL_STATUS.SINGLE, 
      CIVIL_STATUS.MARRIED, 
      CIVIL_STATUS.DIVORCED, 
      CIVIL_STATUS.WIDOWED
    ];
    const civilStatus = civilStatuses[Math.floor(Math.random() * civilStatuses.length)];
    const employmentStatuses: EMPLOYMENT_STATUS[] = [
      EMPLOYMENT_STATUS.REGULAR,
      EMPLOYMENT_STATUS.PROBATIONARY
    ];
    const employmentStatus = employmentStatuses[Math.floor(Math.random() * employmentStatuses.length)];
    
    return {
      id: randomUUID(),
      employeeCode: generateEmployeeCode(i),
      firstName,
      lastName,
      middleName: Math.random() > 0.7 ? 'A.' : null,
      suffix: Math.random() > 0.9 ? (Math.random() > 0.5 ? SUFFIX.JR : SUFFIX.SR) : null,
      sex: gender,
      civilStatus,
      nationality: 'Filipino',
      birthdate,
      address: `${Math.floor(Math.random() * 1000) + 1} ${['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln'][Math.floor(Math.random() * 4)]}`,
      city: cities[Math.floor(Math.random() * cities.length)],
      state: 'Metro Manila',
      postalCode: '1000',
      country: 'Philippines',
      startDate,
      isEnded: false,
      endDate: null,
      position,
      department,
      employmentStatus,
      currentStatus: CURRENT_STATUS.ACTIVE,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@jumbocrab.com`,
      phone: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      emergencyContactName: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      emergencyContactRelationship: ['Spouse', 'Parent', 'Sibling', 'Friend'][Math.floor(Math.random() * 4)],
      emergencyContactPhone: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      description: `Employee working as ${position} in the ${department} department.`,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // Insert employees into the database
  for (const employee of employees) {
    await prisma.employee.create({
      data: employee,
    });
    console.log(`Created employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
