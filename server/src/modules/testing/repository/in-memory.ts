/**
 * In-Memory Testing Repository
 *
 * Data access layer for test runs and action logs using in-memory Maps.
 * Implements ITestingRepository so it can be swapped with Prisma.
 */

import type { TestRun, TestActionLog } from "../types";
import type { ITestingRepository } from "./interface";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const testRunsStore = new Map<string, TestRun>();
const actionLogsStore = new Map<string, TestActionLog[]>();

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class InMemoryTestingRepository implements ITestingRepository {
  /** Create a new test run. */
  async create(testRun: TestRun): Promise<TestRun> {
    testRunsStore.set(testRun.testId, testRun);
    actionLogsStore.set(testRun.testId, []);
    return testRun;
  }

  /** Find a test run by ID. */
  async findById(testId: string): Promise<TestRun | null> {
    return testRunsStore.get(testId) ?? null;
  }

  /** Find all test runs with optional filters. */
  async findAll(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<TestRun[]> {
    let runs = Array.from(testRunsStore.values());

    if (filters?.status) {
      runs = runs.filter((r) => r.status === filters.status);
    }

    if (filters?.scenarioType) {
      runs = runs.filter((r) => r.scenarioType === filters.scenarioType);
    }

    return runs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /** Update a test run's data. */
  async update(testId: string, data: Partial<TestRun>): Promise<void> {
    const testRun = testRunsStore.get(testId);
    if (!testRun) {
      throw new Error(`Test run ${testId} not found`);
    }

    const updated = { ...testRun, ...data };
    testRunsStore.set(testId, updated);
  }

  /** Delete a test run and its action logs. */
  async delete(testId: string): Promise<boolean> {
    const existed = testRunsStore.has(testId);
    testRunsStore.delete(testId);
    actionLogsStore.delete(testId);
    return existed;
  }

  /** Create an action log entry for a test run. */
  async createActionLog(log: TestActionLog): Promise<void> {
    const logs = actionLogsStore.get(log.testId) ?? [];
    logs.push(log);
    actionLogsStore.set(log.testId, logs);
  }

  /** Find action logs for a test run. */
  async findActionLogs(
    testId: string,
    limit: number = 200
  ): Promise<TestActionLog[]> {
    const logs = actionLogsStore.get(testId) ?? [];
    return logs
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  /** Count test runs with optional filters. */
  async count(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<number> {
    const runs = await this.findAll(filters);
    return runs.length;
  }

  /** Check if a test run exists. */
  async exists(testId: string): Promise<boolean> {
    return testRunsStore.has(testId);
  }

  /** Count currently active test runs (initializing, coordination, executing). */
  async countActive(): Promise<number> {
    let count = 0;
    for (const run of testRunsStore.values()) {
      if (
        run.status === "initializing" ||
        run.status === "coordination" ||
        run.status === "executing"
      ) {
        count++;
      }
    }
    return count;
  }
}
