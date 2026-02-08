/**
 * Testing Repository — factory and re-exports.
 *
 * Reads the USE_DATABASE feature flag to decide whether to use the
 * Prisma-backed repository (Supabase PostgreSQL) or the in-memory
 * fallback.  Exports a singleton `testingRepository` that all
 * consumers should import.
 */

import { USE_DATABASE } from "../../../../constants/env.constants";
import { InMemoryTestingRepository } from "./in-memory";
import { PrismaTestingRepository } from "./prisma";
import type { ITestingRepository } from "./interface";

export type { ITestingRepository } from "./interface";

function createRepository(): ITestingRepository {
  if (USE_DATABASE) {
    console.log("[testing] Using Prisma repository (database)");
    return new PrismaTestingRepository();
  }

  console.log("[testing] Using in-memory repository");
  return new InMemoryTestingRepository();
}

/** Singleton repository instance — use this everywhere. */
export const testingRepository: ITestingRepository = createRepository();
