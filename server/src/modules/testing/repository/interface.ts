/**
 * ITestingRepository — storage abstraction for the Testing module.
 *
 * Both the in-memory and Prisma implementations conform to this
 * interface so the rest of the codebase stays storage-agnostic.
 */

import type { TestRun, TestActionLog } from "../types";

export interface ITestingRepository {
  /** Create a new test run. */
  create(testRun: TestRun): Promise<TestRun>;

  /** Find a test run by ID. */
  findById(testId: string): Promise<TestRun | null>;

  /** Find all test runs with optional filters. */
  findAll(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<TestRun[]>;

  /** Update a test run's data. */
  update(testId: string, data: Partial<TestRun>): Promise<void>;

  /** Delete a test run and its action logs. */
  delete(testId: string): Promise<boolean>;

  /** Create an action log entry for a test run. */
  createActionLog(log: TestActionLog): Promise<void>;

  /** Find action logs for a test run. */
  findActionLogs(testId: string, limit?: number): Promise<TestActionLog[]>;

  /** Count test runs with optional filters. */
  count(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<number>;

  /** Check if a test run exists. */
  exists(testId: string): Promise<boolean>;

  /** Count currently active test runs (initializing, coordination, executing). */
  countActive(): Promise<number>;
}
