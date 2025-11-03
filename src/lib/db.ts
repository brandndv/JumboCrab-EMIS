import { PrismaClient } from '@prisma/client';

// Create a single PrismaClient instance to be used throughout the app
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

declare const globalThis: {
  prisma: PrismaClientSingleton | undefined;
} & typeof global;

// Initialize the Prisma client
const db = globalThis.prisma ?? prismaClientSingleton();

// In development, store the Prisma client in a global variable to prevent
// creating multiple instances during hot-reloading
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

/**
 * Check if the database connection is active
 * @returns Promise<boolean> - True if the connection is active, false otherwise
 */
export const checkConnection = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

/**
 * Initialize the database connection
 */
const initializeDb = async (): Promise<void> => {
  try {
    await db.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    // Don't exit in development to allow for hot-reloading
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Initialize the database connection when this module is loaded
initializeDb().catch((error) => {
  console.error('Failed to initialize database:', error);
});

/**
 * Gracefully shut down the database connection
 * @param signal - The signal that triggered the shutdown
 */
const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received: closing database connections...`);
  try {
    await db.$disconnect();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error during database disconnection:', error);
  } finally {
    process.exit(0);
  }
};

// Handle different shutdown signals
const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
shutdownSignals.forEach((signal) => {
  process.on(signal, () => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    void shutdown(signal);
  });
});

export { db };

export default db;
