/**
 * Prisma client singleton.
 *
 * Reuse a single PrismaClient instance across the entire server
 * to avoid exhausting database connections.
 *
 * Prisma 7 requires a driver adapter — we use @prisma/adapter-pg
 * with the pg library for PostgreSQL connections.
 *
 * In development, attach the client to `globalThis` so that
 * hot-reloads (bun --watch) don't create new connections.
 */

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Build the connection string used at runtime.
 *
 * Prefer DATABASE_URL (PgBouncer pooler, port 6543) for runtime traffic.
 * Fall back to DIRECT_URL if DATABASE_URL is not set.
 */
function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"] ?? process.env["DIRECT_URL"];
  if (!url) {
    throw new Error(
      "[db] Neither DATABASE_URL nor DIRECT_URL is set. " +
        "Cannot initialize Prisma client."
    );
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
