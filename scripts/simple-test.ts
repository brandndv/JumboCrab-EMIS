import { PrismaClient } from "@prisma/client";

console.log("Creating Prisma client...");
const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function main() {
  try {
    console.log("Testing database connection...");
    
    // Test connection by querying the database version
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log("Database version:", result);
    
    // Try to count employees
    const employeeCount = await prisma.employee.count();
    console.log(`Found ${employeeCount} employees in the database.`);
    
    if (employeeCount > 0) {
      const sample = await prisma.employee.findFirst();
      console.log("Sample employee:", sample);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
