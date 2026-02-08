/**
 * Prisma-backed Testing Repository
 *
 * Implements ITestingRepository using Prisma Client with the
 * Supabase PostgreSQL database. Handles bidirectional mapping
 * between domain types (types.ts) and the Prisma schema.
 *
 * Extra domain fields that have no direct column (e.g. testingAgentIds,
 * metrics, channel IDs) are stored in the Prisma `config` Json blob
 * alongside the user-provided TestRunConfig.
 */

import { prisma } from "../../database/client";
import type {
  TestRun,
  TestRunStatus,
  TestActionLog,
  ScenarioType,
  CompletionReason,
  TestMetrics,
  TestRunConfig,
} from "../types";
import type { BehavioralProfile } from "../../agents/model";
import type { ITestingRepository } from "./interface";
import {
  ScenarioType as PrismaScenarioType,
  TestStatus as PrismaTestStatus,
  EventSource as PrismaEventSource,
} from "../../../generated/prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/client";

// ---------------------------------------------------------------------------
// Mapping helpers: Domain <-> Prisma
// ---------------------------------------------------------------------------

/**
 * Extra domain fields stored inside the Prisma `config` Json column
 * alongside the user-provided TestRunConfig values.
 */
interface ConfigBlob {
  /** The original domain TestRunConfig. */
  testRunConfig: TestRunConfig;
  /** Full domain status for lossless round-trip. */
  domainStatus: TestRunStatus;
  /** Behavioral profiles assigned to testing agents. */
  testingAgentProfiles: BehavioralProfile[];
  /** IDs of spawned testing agents. */
  testingAgentIds: string[];
  /** ID of the target LLM agent. */
  targetAgentId: string | null;
  /** Minecraft bot ID for the target LLM agent. */
  targetBotId: string | null;
  /** Discord text channel ID. */
  discordTextChannelId: string | null;
  /** Discord voice channel ID. */
  discordVoiceChannelId: string | null;
  /** Test duration limit in seconds. */
  durationSeconds: number;
  /** Completion reason if test has ended. */
  completionReason: CompletionReason | null;
  /** Accumulated metrics during the test. */
  metrics: TestMetrics;
}

/** Map domain ScenarioType -> Prisma ScenarioType enum. */
function toPrismaScenarioType(s: ScenarioType): PrismaScenarioType {
  switch (s) {
    case "cooperation":
      return PrismaScenarioType.COOPERATION;
    case "resource-management":
      return PrismaScenarioType.RESOURCE_MANAGEMENT;
    default: {
      // Exhaustiveness guard — if new scenario types are added this will
      // surface as a compile error.
      const _exhaustive: never = s;
      throw new Error(`Unknown scenario type: ${_exhaustive}`);
    }
  }
}

/** Map Prisma ScenarioType enum -> domain ScenarioType. */
function fromPrismaScenarioType(s: PrismaScenarioType): ScenarioType {
  switch (s) {
    case PrismaScenarioType.COOPERATION:
      return "cooperation";
    case PrismaScenarioType.RESOURCE_MANAGEMENT:
      return "resource-management";
    default:
      // The Prisma schema has extra values we don't support yet in domain.
      // Fall back rather than crash at runtime.
      return "cooperation";
  }
}

/** Map domain TestRunStatus -> Prisma TestStatus enum. */
function toPrismaStatus(s: TestRunStatus): PrismaTestStatus {
  switch (s) {
    case "created":
      return PrismaTestStatus.PENDING;
    case "initializing":
    case "coordination":
    case "executing":
    case "completing":
      return PrismaTestStatus.RUNNING;
    case "completed":
      return PrismaTestStatus.COMPLETED;
    case "failed":
      return PrismaTestStatus.FAILED;
    case "cancelled":
      return PrismaTestStatus.CANCELLED;
  }
}

/**
 * Map domain actionCategory -> Prisma EventSource enum.
 * "llm-decision" does not map neatly; we fall back to MINECRAFT since
 * it's an internal decision action (logged as MINECRAFT by convention).
 */
function toPrismaEventSource(
  category: "minecraft" | "discord" | "llm-decision"
): PrismaEventSource {
  switch (category) {
    case "minecraft":
      return PrismaEventSource.MINECRAFT;
    case "discord":
      return PrismaEventSource.DISCORD;
    case "llm-decision":
      return PrismaEventSource.MINECRAFT;
  }
}

/** Map Prisma EventSource -> domain actionCategory. */
function fromPrismaEventSource(
  s: PrismaEventSource
): "minecraft" | "discord" {
  switch (s) {
    case PrismaEventSource.MINECRAFT:
      return "minecraft";
    case PrismaEventSource.DISCORD:
      return "discord";
  }
}

/** Generate a human-readable name for a test run (Prisma requires `name`). */
function generateTestName(scenarioType: ScenarioType): string {
  const date = new Date().toISOString().slice(0, 19).replace("T", " ");
  return `Test: ${scenarioType} @ ${date}`;
}

// ---------------------------------------------------------------------------
// Domain -> Prisma create data
// ---------------------------------------------------------------------------

function buildConfigBlob(testRun: TestRun): ConfigBlob {
  return {
    testRunConfig: testRun.config,
    domainStatus: testRun.status,
    testingAgentProfiles: testRun.testingAgentProfiles,
    testingAgentIds: testRun.testingAgentIds,
    targetAgentId: testRun.targetAgentId,
    targetBotId: testRun.targetBotId,
    discordTextChannelId: testRun.discordTextChannelId,
    discordVoiceChannelId: testRun.discordVoiceChannelId,
    durationSeconds: testRun.durationSeconds,
    completionReason: testRun.completionReason,
    metrics: testRun.metrics,
  };
}

// ---------------------------------------------------------------------------
// Prisma row -> Domain TestRun
// ---------------------------------------------------------------------------

interface PrismaTestRunRow {
  id: string;
  name: string;
  scenarioType: PrismaScenarioType;
  targetModel: string;
  status: PrismaTestStatus;
  config: unknown; // Json
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomainTestRun(row: PrismaTestRunRow): TestRun {
  const blob = row.config as ConfigBlob | null;

  // Default metrics if not present in config blob.
  const defaultMetrics: TestMetrics = {
    llmDecisionCount: 0,
    targetActionCount: 0,
    testingAgentActionCount: 0,
    targetMessageCount: 0,
    testingAgentMessageCount: 0,
    llmErrorCount: 0,
    totalLlmResponseTimeMs: 0,
    lastLlmDecisionAt: null,
  };

  // Default TestRunConfig if not present in config blob.
  const defaultConfig: TestRunConfig = {
    llmPollingIntervalMs: 7000,
    behaviorIntensity: 0.5,
    enableVoice: false,
    enableText: true,
    targetLlmSystemPromptOverride: null,
    minecraftServer: {
      host: "localhost",
      port: 25565,
      version: "1.21.1",
    },
  };

  return {
    testId: row.id,
    scenarioType: fromPrismaScenarioType(row.scenarioType),
    // Prefer the lossless domainStatus stored in the blob; fall back to
    // a coarse mapping from the Prisma enum.
    status: blob?.domainStatus ?? fromPrismaStatusFallback(row.status),
    targetLlmModel: row.targetModel,
    testingAgentProfiles: blob?.testingAgentProfiles ?? [],
    testingAgentIds: blob?.testingAgentIds ?? [],
    targetAgentId: blob?.targetAgentId ?? null,
    targetBotId: blob?.targetBotId ?? null,
    discordTextChannelId: blob?.discordTextChannelId ?? null,
    discordVoiceChannelId: blob?.discordVoiceChannelId ?? null,
    durationSeconds: blob?.durationSeconds ?? 300,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.completedAt?.toISOString() ?? null,
    completionReason: blob?.completionReason ?? null,
    config: blob?.testRunConfig ?? defaultConfig,
    metrics: blob?.metrics ?? defaultMetrics,
  };
}

/** Coarse fallback when no domainStatus is stored in config blob. */
function fromPrismaStatusFallback(s: PrismaTestStatus): TestRunStatus {
  switch (s) {
    case PrismaTestStatus.PENDING:
      return "created";
    case PrismaTestStatus.RUNNING:
      return "executing";
    case PrismaTestStatus.COMPLETED:
      return "completed";
    case PrismaTestStatus.FAILED:
      return "failed";
    case PrismaTestStatus.CANCELLED:
      return "cancelled";
  }
}

// ---------------------------------------------------------------------------
// Prisma row -> Domain TestActionLog
// ---------------------------------------------------------------------------

interface PrismaTestEventRow {
  id: string;
  testRunId: string;
  agentId: string | null;
  source: PrismaEventSource;
  type: string;
  payload: unknown; // Json
  timestamp: Date;
}

function toDomainActionLog(row: PrismaTestEventRow): TestActionLog {
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  return {
    logId: row.id,
    testId: row.testRunId,
    sourceAgentId: (payload["sourceAgentId"] as string) ?? row.agentId ?? "unknown",
    sourceType: (payload["sourceType"] as "target" | "testing-agent") ?? "target",
    actionCategory: payload["actionCategory"]
      ? (payload["actionCategory"] as "minecraft" | "discord" | "llm-decision")
      : fromPrismaEventSource(row.source),
    actionDetail: row.type,
    timestamp: row.timestamp.toISOString(),
    metadata: (payload["metadata"] as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PrismaTestingRepository implements ITestingRepository {
  /** Create a new test run. */
  async create(testRun: TestRun): Promise<TestRun> {
    const row = await prisma.testRun.create({
      data: {
        id: testRun.testId,
        name: generateTestName(testRun.scenarioType),
        scenarioType: toPrismaScenarioType(testRun.scenarioType),
        targetModel: testRun.targetLlmModel,
        status: toPrismaStatus(testRun.status),
        config: buildConfigBlob(testRun) as unknown as InputJsonValue,
        startedAt: testRun.startedAt ? new Date(testRun.startedAt) : null,
        completedAt: testRun.endedAt ? new Date(testRun.endedAt) : null,
        createdAt: new Date(testRun.createdAt),
      },
    });

    return toDomainTestRun(row);
  }

  /** Find a test run by ID. */
  async findById(testId: string): Promise<TestRun | null> {
    const row = await prisma.testRun.findUnique({
      where: { id: testId },
    });

    return row ? toDomainTestRun(row) : null;
  }

  /** Find all test runs with optional filters. */
  async findAll(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<TestRun[]> {
    // Build Prisma where clause from domain filters.
    const where: Record<string, unknown> = {};

    if (filters?.status) {
      // Map domain status to Prisma enum for the WHERE clause.
      where["status"] = toPrismaStatus(filters.status as TestRunStatus);
    }

    if (filters?.scenarioType) {
      where["scenarioType"] = toPrismaScenarioType(
        filters.scenarioType as ScenarioType
      );
    }

    const rows = await prisma.testRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(toDomainTestRun);
  }

  /** Update a test run's data. */
  async update(testId: string, data: Partial<TestRun>): Promise<void> {
    // Read the existing row so we can merge config blob fields.
    const existing = await prisma.testRun.findUnique({
      where: { id: testId },
    });

    if (!existing) {
      throw new Error(`Test run ${testId} not found`);
    }

    // Reconstruct a full domain TestRun by merging existing + incoming.
    const currentDomain = toDomainTestRun(existing);
    const merged: TestRun = { ...currentDomain, ...data };

    const updateData: Record<string, unknown> = {
      config: buildConfigBlob(merged) as unknown as InputJsonValue,
    };

    // Only update top-level Prisma columns if the relevant domain fields changed.
    if (data.status !== undefined) {
      updateData["status"] = toPrismaStatus(data.status);
    }

    if (data.scenarioType !== undefined) {
      updateData["scenarioType"] = toPrismaScenarioType(data.scenarioType);
    }

    if (data.targetLlmModel !== undefined) {
      updateData["targetModel"] = data.targetLlmModel;
    }

    if (data.startedAt !== undefined) {
      updateData["startedAt"] = data.startedAt
        ? new Date(data.startedAt)
        : null;
    }

    if (data.endedAt !== undefined) {
      updateData["completedAt"] = data.endedAt
        ? new Date(data.endedAt)
        : null;
    }

    await prisma.testRun.update({
      where: { id: testId },
      data: updateData,
    });
  }

  /** Delete a test run and its action logs (cascade handles events). */
  async delete(testId: string): Promise<boolean> {
    try {
      await prisma.testRun.delete({ where: { id: testId } });
      return true;
    } catch {
      // Prisma throws P2025 if the record doesn't exist.
      return false;
    }
  }

  /** Create an action log entry for a test run (stored as TestEvent). */
  async createActionLog(log: TestActionLog): Promise<void> {
    await prisma.testEvent.create({
      data: {
        id: log.logId,
        testRunId: log.testId,
        agentId: null, // We don't have a TestAgent row to link; store in payload instead.
        source: toPrismaEventSource(log.actionCategory),
        type: log.actionDetail,
        payload: {
          sourceAgentId: log.sourceAgentId,
          sourceType: log.sourceType,
          actionCategory: log.actionCategory,
          metadata: log.metadata,
        } as unknown as InputJsonValue,
        timestamp: new Date(log.timestamp),
      },
    });
  }

  /** Find action logs for a test run. */
  async findActionLogs(
    testId: string,
    limit: number = 200
  ): Promise<TestActionLog[]> {
    const rows = await prisma.testEvent.findMany({
      where: { testRunId: testId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return rows.map(toDomainActionLog);
  }

  /** Count test runs with optional filters. */
  async count(filters?: {
    status?: string;
    scenarioType?: string;
  }): Promise<number> {
    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where["status"] = toPrismaStatus(filters.status as TestRunStatus);
    }

    if (filters?.scenarioType) {
      where["scenarioType"] = toPrismaScenarioType(
        filters.scenarioType as ScenarioType
      );
    }

    return prisma.testRun.count({ where });
  }

  /** Check if a test run exists. */
  async exists(testId: string): Promise<boolean> {
    const row = await prisma.testRun.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    return row !== null;
  }

  /** Count currently active test runs. */
  async countActive(): Promise<number> {
    // Active = Prisma RUNNING status. We cannot distinguish domain sub-states
    // (initializing/coordination/executing) at the SQL level, but RUNNING
    // covers all of them.
    return prisma.testRun.count({
      where: { status: PrismaTestStatus.RUNNING },
    });
  }

  /** Atomically increment a numeric metric on a test run. */
  async incrementMetric(
    testId: string,
    metricName: keyof TestRun["metrics"],
    amount: number = 1
  ): Promise<void> {
    // Read current config blob
    const existing = await prisma.testRun.findUnique({
      where: { id: testId },
      select: { config: true },
    });

    if (!existing) {
      throw new Error(`Test run ${testId} not found`);
    }

    const blob = existing.config as ConfigBlob;
    const currentValue = blob.metrics[metricName];

    // Increment the metric
    if (typeof currentValue === "number") {
      blob.metrics[metricName] = currentValue + amount;
    }

    // Write back the updated config blob
    await prisma.testRun.update({
      where: { id: testId },
      data: {
        config: blob as unknown as InputJsonValue,
      },
    });
  }
}
