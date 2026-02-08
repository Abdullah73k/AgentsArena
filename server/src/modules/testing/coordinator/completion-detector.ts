/**
 * Completion Detector
 *
 * Monitors test runs for completion conditions:
 * - Timeout (duration exceeded)
 * - Success criteria met
 * - All agents failed
 * - Manual stop
 *
 * Runs as a periodic check during test execution.
 */

import type { TestRun, CompletionReason, TestMetrics } from "../types";
import type { TestScenario } from "../scenarios/types";
import { testingRepository } from "../repository";
import { testEvents } from "../events/event-emitter";

// ---------------------------------------------------------------------------
// Active timers
// ---------------------------------------------------------------------------

/** Maps testId to the timeout timer handle. */
const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Maps testId to the criteria check interval handle. */
const criteriaCheckers = new Map<string, ReturnType<typeof setInterval>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class CompletionDetector {
  /**
   * Start monitoring a test run for completion.
   * Sets up both timeout and periodic criteria checking.
   */
  static start(testRun: TestRun, scenario: TestScenario): void {
    const { testId, durationSeconds } = testRun;

    // Set up hard timeout
    const timeoutMs = durationSeconds * 1000;
    const timer = setTimeout(() => {
      this.triggerCompletion(testId, "timeout").catch((err) => {
        console.error(
          `[CompletionDetector] Error triggering timeout for ${testId}:`,
          err
        );
      });
    }, timeoutMs);
    timeoutTimers.set(testId, timer);

    // Set up periodic criteria checking (every 5 seconds)
    const checker = setInterval(() => {
      this.checkCriteria(testId, scenario).catch((err) => {
        console.error(
          `[CompletionDetector] Error checking criteria for ${testId}:`,
          err
        );
      });
    }, 5_000);
    criteriaCheckers.set(testId, checker);

    console.log(
      `[CompletionDetector] Monitoring test ${testId} ` +
        `(timeout: ${durationSeconds}s)`
    );
  }

  /**
   * Stop monitoring a test run.
   * Called during cleanup or when the test completes.
   */
  static stop(testId: string): void {
    const timer = timeoutTimers.get(testId);
    if (timer) {
      clearTimeout(timer);
      timeoutTimers.delete(testId);
    }

    const checker = criteriaCheckers.get(testId);
    if (checker) {
      clearInterval(checker);
      criteriaCheckers.delete(testId);
    }

    console.log(`[CompletionDetector] Stopped monitoring test ${testId}`);
  }

  /**
   * Trigger test completion with a specific reason.
   * Updates the repository and emits a completion event.
   */
  static async triggerCompletion(
    testId: string,
    reason: CompletionReason
  ): Promise<void> {
    // Stop monitoring first to prevent duplicate triggers
    this.stop(testId);

    const testRun = await testingRepository.findById(testId);
    if (!testRun) {
      console.warn(
        `[CompletionDetector] Test ${testId} not found for completion`
      );
      return;
    }

    // Ignore if already completed/cancelled/failed
    if (
      testRun.status === "completed" ||
      testRun.status === "cancelled" ||
      testRun.status === "failed"
    ) {
      return;
    }

    const endedAt = new Date().toISOString();
    const finalStatus = reason === "error" || reason === "all-agents-failed"
      ? "failed"
      : reason === "manual-stop"
        ? "cancelled"
        : "completed";

    await testingRepository.update(testId, {
      status: finalStatus,
      completionReason: reason,
      endedAt,
    });

    const startedAt = testRun.startedAt
      ? new Date(testRun.startedAt).getTime()
      : new Date(testRun.createdAt).getTime();
    const durationSeconds = Math.round(
      (new Date(endedAt).getTime() - startedAt) / 1000
    );

    testEvents.emitEvent("test-completed", {
      testId,
      scenarioType: testRun.scenarioType,
      reason,
      finalMetrics: testRun.metrics,
      durationSeconds,
      timestamp: endedAt,
    });

    testEvents.emitEvent("test-status-changed", {
      testId,
      previousStatus: testRun.status,
      newStatus: finalStatus,
      timestamp: endedAt,
    });

    console.log(
      `[CompletionDetector] Test ${testId} completed: ${reason} ` +
        `(${durationSeconds}s)`
    );
  }

  /**
   * Stop all active monitors. Used during server shutdown.
   */
  static stopAll(): void {
    for (const testId of timeoutTimers.keys()) {
      this.stop(testId);
    }
    console.log("[CompletionDetector] All monitors stopped");
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Check if success criteria are met for a test run.
   */
  private static async checkCriteria(
    testId: string,
    scenario: TestScenario
  ): Promise<void> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun || testRun.status !== "executing") {
      return;
    }

    const { metrics } = testRun;
    const { successCriteria } = scenario;

    // Check if minimum cooperative actions threshold is met
    if (
      successCriteria.minCooperativeActions !== null &&
      metrics.targetActionCount >= successCriteria.minCooperativeActions
    ) {
      // Check Discord communication requirement
      if (
        !successCriteria.requiresDiscordCommunication ||
        metrics.targetMessageCount > 0
      ) {
        await this.triggerCompletion(testId, "success");
        return;
      }
    }

    // Check if minimum tasks completed threshold is met
    if (
      successCriteria.minTasksCompleted !== null &&
      metrics.targetActionCount >= successCriteria.minTasksCompleted * 10
    ) {
      await this.triggerCompletion(testId, "success");
      return;
    }

    // Check LLM error rate
    if (successCriteria.maxLlmErrorRate !== null) {
      const totalDecisions = metrics.llmDecisionCount;
      if (totalDecisions > 10) {
        const errorRate = metrics.llmErrorCount / totalDecisions;
        if (errorRate > successCriteria.maxLlmErrorRate) {
          await this.triggerCompletion(testId, "all-agents-failed");
          return;
        }
      }
    }
  }
}
