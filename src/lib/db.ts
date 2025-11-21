import { prisma } from "./prisma";

export const db = prisma;

export const checkConnection = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
};
