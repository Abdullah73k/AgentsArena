/**
 * Evaluation Service
 *
 * Business logic for evaluation operations.
 * Following ElysiaJS MVC pattern: Abstract class with static methods, decoupled from HTTP.
 */

import type { GenerateReportRequest, EvaluationReport, GetMetricsRequest, BaseMetric, MetricSummary } from "./model";
import { EvaluationRepository } from "./repository";
import { ReportGenerator } from "./report/generator";
import { testingRepository } from "../testing/repository";
import { metricRegistry } from "./metrics";
import type { MetricContext } from "./metrics";

/**
 * Service result type (following ElysiaJS pattern)
 */
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/**
 * Evaluation Service
 */
export abstract class EvaluationService {
  /**
   * Generate an evaluation report for a completed test run
   */
  static async generateReport(
    request: GenerateReportRequest
  ): Promise<ServiceResult<EvaluationReport>> {
    try {
      const { testRunId } = request;

      console.log(`[EvaluationService] Generating report for test ${testRunId}`);

      // Fetch test run data from testing module
      const testRun = await testingRepository.findById(testRunId);
      if (!testRun) {
        return { ok: false, error: "Test run not found", code: "NOT_FOUND" };
      }

      // Check if test is completed
      if (testRun.status !== "completed" && testRun.status !== "failed") {
        return {
          ok: false,
          error: `Test run is not completed (status: ${testRun.status})`,
          code: "INVALID_STATUS",
        };
      }

      // Fetch action logs for this test run
      const events = await testingRepository.findActionLogs(testRunId);
      console.log(`[EvaluationService] Fetched ${events.length} events`);

      // Get test metadata
      const testStartTime = testRun.startedAt
        ? new Date(testRun.startedAt)
        : new Date(testRun.createdAt);
      const testEndTime = testRun.endedAt
        ? new Date(testRun.endedAt)
        : new Date();
      const testDuration =
        (testEndTime.getTime() - testStartTime.getTime()) / 1000;

      // Build agent info from test run data (TestRun doesn't have an agents array)
      const agents: { agentId: string; profile: string }[] = [];

      // Add target LLM agent
      if (testRun.targetAgentId) {
        agents.push({
          agentId: testRun.targetAgentId,
          profile: "target-llm",
        });
      }

      // Add testing agents (map IDs to their profiles)
      for (let i = 0; i < testRun.testingAgentIds.length; i++) {
        agents.push({
          agentId: testRun.testingAgentIds[i],
          profile: testRun.testingAgentProfiles[i] ?? "unknown",
        });
      }

      // Generate report
      const report = await ReportGenerator.generate(
        testRunId,
        events,
        agents,
        testDuration,
        testStartTime,
        testEndTime
      );

      // Save report to repository
      await EvaluationRepository.saveReport(report);

      console.log(`[EvaluationService] Report generated successfully: ${report.reportId}`);

      return { ok: true, data: report };
    } catch (error) {
      console.error("[EvaluationService] Error generating report:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
    }
  }

  /**
   * Get a report by ID
   */
  static async getReport(reportId: string): Promise<ServiceResult<EvaluationReport>> {
    try {
      const report = await EvaluationRepository.getReport(reportId);

      if (!report) {
        return { ok: false, error: "Report not found", code: "NOT_FOUND" };
      }

      return { ok: true, data: report };
    } catch (error) {
      console.error("[EvaluationService] Error fetching report:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      };
    }
  }

  /**
   * Get report by test run ID
   */
  static async getReportByTestRun(
    testRunId: string
  ): Promise<ServiceResult<EvaluationReport>> {
    try {
      const report = await EvaluationRepository.getReportByTestRun(testRunId);

      if (!report) {
        return {
          ok: false,
          error: "No report found for this test run",
          code: "NOT_FOUND",
        };
      }

      return { ok: true, data: report };
    } catch (error) {
      console.error("[EvaluationService] Error fetching report:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      };
    }
  }

  /**
   * List all reports
   */
  static async listReports(): Promise<ServiceResult<EvaluationReport[]>> {
    try {
      const reports = await EvaluationRepository.listReports();
      return { ok: true, data: reports };
    } catch (error) {
      console.error("[EvaluationService] Error listing reports:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      };
    }
  }

  /**
   * Get metrics for a test run
   */
  static async getMetrics(
    request: GetMetricsRequest
  ): Promise<ServiceResult<{ metrics: BaseMetric[]; summary: Record<string, MetricSummary> }>> {
    try {
      const { testRunId, metricTypes, agentIds } = request;

      // Fetch metrics from repository
      const metrics = await EvaluationRepository.getMetrics(testRunId, {
        metricTypes,
        agentIds,
      });

      // Calculate summaries by metric type
      const summary: Record<string, MetricSummary> = {};

      for (const calculator of metricRegistry.getAll()) {
        const metricsForType = metrics.filter(
          (m) => m.metricType === calculator.metricType
        );
        if (metricsForType.length > 0) {
          summary[calculator.metricType] = await calculator.aggregate(
            metricsForType as any
          );
        }
      }

      return {
        ok: true,
        data: {
          metrics,
          summary,
        },
      };
    } catch (error) {
      console.error("[EvaluationService] Error fetching metrics:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      };
    }
  }

  /**
   * Delete a report
   */
  static async deleteReport(reportId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    try {
      const deleted = await EvaluationRepository.deleteReport(reportId);

      if (!deleted) {
        return { ok: false, error: "Report not found", code: "NOT_FOUND" };
      }

      return { ok: true, data: { deleted: true } };
    } catch (error) {
      console.error("[EvaluationService] Error deleting report:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "DELETE_ERROR",
      };
    }
  }

  /**
   * Get repository statistics
   */
  static async getStats(): Promise<ServiceResult<any>> {
    try {
      const stats = await EvaluationRepository.getStats();
      return { ok: true, data: stats };
    } catch (error) {
      console.error("[EvaluationService] Error fetching stats:", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "FETCH_ERROR",
      };
    }
  }
}
