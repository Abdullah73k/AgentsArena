/**
 * Quick database connection verification script.
 *
 * Usage: bun run src/modules/database/test-connection.ts
 */

import { prisma } from "./client";

async function main() {
  try {
    await prisma.$connect();
    console.log("[db] Connection successful");

    const count = await prisma.testRun.count();
    console.log(`[db] TestRun count: ${count}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[db] Connection failed:", message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
