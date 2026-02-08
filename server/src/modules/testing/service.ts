/**
 * TestingService — business logic façade for the Testing module.
 *
 * Follows the Elysia MVC skill:
 *  - Abstract class with static methods (no instance needed).
 *  - Decoupled from HTTP / Elysia Context.
 *  - Returns discriminated ServiceResult objects.
 *
 * Delegates heavy lifting to TestRunner, TestingRepository,
 * and the scenario registry.
 */

import type {
  TestRun,
  CreateTestRequest,
  ServiceResult,
  TestActionLog,
} from "./types";
import { TestRunner } from "./coordinator/test-runner";
import { testingRepository } from "./repository";
import { getAllScenarios, getScenarioTypes } from "./scenarios";
import type { TestScenario } from "./scenarios/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export abstract class TestingService {
  /**
   * Create a new test run (does not start execution).
   */
  static async createTest(
    request: CreateTestRequest,
  ): Promise<ServiceResult<TestRun>> {
    return TestRunner.createTest(request);
  }

  /**
   * Start execution of a previously created test run.
   */
  static async startTest(
    testId: string,
  ): Promise<ServiceResult<TestRun>> {
    return TestRunner.startTest(testId);
  }

  /**
   * Manually stop a running test.
   */
  static async stopTest(
    testId: string,
  ): Promise<ServiceResult<TestRun>> {
    return TestRunner.stopTest(testId);
  }

  /**
   * Get a single test run by ID.
   */
  static async getTest(
    testId: string,
  ): Promise<ServiceResult<TestRun>> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun) {
      return {
        ok: false,
        message: `Test ${testId} not found`,
        code: "TEST_NOT_FOUND",
        httpStatus: 404,
      };
    }
    return { ok: true, data: testRun };
  }

  /**
   * List all test runs with optional filters.
   */
  static async listTests(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<ServiceResult<{ tests: TestRun[]; count: number }>> {
    const tests = await testingRepository.findAll(filters);
    return {
      ok: true,
      data: { tests, count: tests.length },
    };
  }

  /**
   * Delete a test run (only if not currently active).
   */
  static async deleteTest(
    testId: string,
  ): Promise<ServiceResult<{ message: string }>> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun) {
      return {
        ok: false,
        message: `Test ${testId} not found`,
        code: "TEST_NOT_FOUND",
        httpStatus: 404,
      };
    }

    const activeStates = ["initializing", "coordination", "executing"];
    if (activeStates.includes(testRun.status)) {
      return {
        ok: false,
        message: `Test ${testId} is currently ${testRun.status} — stop it first`,
        code: "TEST_ACTIVE",
        httpStatus: 409,
      };
    }

    await testingRepository.delete(testId);
    return {
      ok: true,
      data: { message: `Test ${testId} deleted` },
    };
  }

  /**
   * Get action logs for a test run.
   */
  static async getTestLogs(
    testId: string,
    limit: number = 200,
  ): Promise<ServiceResult<{ testId: string; logs: TestActionLog[]; count: number }>> {
    const exists = await testingRepository.exists(testId);
    if (!exists) {
      return {
        ok: false,
        message: `Test ${testId} not found`,
        code: "TEST_NOT_FOUND",
        httpStatus: 404,
      };
    }

    const logs = await testingRepository.findActionLogs(testId, limit);
    return {
      ok: true,
      data: { testId, logs, count: logs.length },
    };
  }

  /**
   * Get all available scenario definitions.
   */
  static getScenarios(): ServiceResult<TestScenario[]> {
    return { ok: true, data: getAllScenarios() };
  }

  /**
   * Get available scenario type identifiers.
   */
  static getScenarioTypes(): ServiceResult<string[]> {
    return { ok: true, data: getScenarioTypes() };
  }

  /**
   * Stop all active tests. Used during server shutdown.
   */
  static async stopAll(): Promise<void> {
    await TestRunner.stopAll();
  }
}
