/**
 * Prisma client singleton.
 *
 * Reuse a single PrismaClient instance across the entire server
 * to avoid exhausting database connections.
 *
 * In development, attach the client to `globalThis` so that
 * hot-reloads (bun --watch) don't create new connections.
 */

import { PrismaClient } from "../../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
