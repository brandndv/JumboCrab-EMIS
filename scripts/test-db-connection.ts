import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function testConnection() {
  try {
    console.log("Testing database connection...");
    
    // Test connection by counting employees
    const employeeCount = await db.employee.count();
    console.log(`Successfully connected to database. Found ${employeeCount} employees.`);
    
    // If we have employees, log the first few
    if (employeeCount > 0) {
      const sampleEmployees = await db.employee.findMany({
        take: 3,
        select: { id: true, firstName: true, lastName: true, email: true }
      });
      console.log("Sample employees:", JSON.stringify(sampleEmployees, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error testing database connection:", error);
    process.exit(1);
  }
}

testConnection();
