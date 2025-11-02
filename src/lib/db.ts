import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Initialize Prisma Client
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Store in global in development to prevent hot-reload issues
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Export the Prisma Client
export const db = prisma;

// Optional: Add a function to test the connection
export async function testConnection() {
  try {
    await db.$connect();
    console.log("Successfully connected to the database");
    return true;
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    return false;
  } finally {
    await db.$disconnect();
  }
}

// Test the connection on startup in development
if (process.env.NODE_ENV === "development") {
  testConnection().catch(console.error);
}
