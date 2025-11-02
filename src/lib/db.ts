import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Optional: Test the connection
db.$connect()
  .then(() => console.log("Prisma Client connected successfully"))
  .catch((error: unknown) => console.error("Prisma Client connection error:", error));
