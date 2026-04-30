import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

declare global {
  var prisma: PrismaClient | undefined;
}

const REQUIRED_DELEGATES = [
  "cashAdvanceRequest",
  "dayOffRequest",
  "leaveRequest",
  "notification",
  "scheduleChangeRequest",
  "scheduleSwapRequest",
  "userNotification",
] as const;

const createPrismaClient = () =>
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

const isUsablePrismaClient = (
  client: PrismaClient | undefined,
): client is PrismaClient => {
  if (!client) return false;
  return REQUIRED_DELEGATES.every((delegate) => delegate in client);
};

export const getPrismaClient = (): PrismaClient => {
  // In development, recreate the cached client if it predates newly added
  // Prisma models so long-lived server action modules do not keep stale delegates.
  const cachedClient = global.prisma;
  if (!isUsablePrismaClient(cachedClient)) {
    if (cachedClient) {
      void (cachedClient as PrismaClient).$disconnect().catch(() => undefined);
    }
    global.prisma = createPrismaClient();
  }

  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }

  return global.prisma;
};

// Singleton Prisma client with adapter. This is kept for direct imports, while
// `getPrismaClient()` is the safer access path when runtime schema changes are possible.
export const prisma: PrismaClient = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
