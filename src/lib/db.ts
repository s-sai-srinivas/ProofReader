import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const pool = new pg.Pool({ connectionString });
  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Resiliency: Drain PG pools on termination signals to prevent leaked active client handles
if (typeof process !== "undefined") {
  const gracefulShutdown = async () => {
    console.log("\nReceived shutdown signal. Draining connection pools...");
    try {
      if (globalForPrisma.prisma) {
        await globalForPrisma.prisma.$disconnect();
      }
      if (globalForPrisma.pool) {
        await globalForPrisma.pool.end();
      }
      console.log("Database connection pools drained successfully.");
    } catch (err) {
      console.error("Error during database graceful shutdown:", err);
    }
  };

  process.once("SIGTERM", gracefulShutdown);
  process.once("SIGINT", gracefulShutdown);
}
