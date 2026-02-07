/**
 * Elysia TypeBox models for the Testing module.
 *
 * Single source of truth for both runtime validation and TypeScript types
 * at API boundaries. Register on Elysia via `.model({ ... })`.
 */

import { t } from "elysia";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ScenarioTypeSchema = t.Union([
  t.Literal("cooperation"),
  t.Literal("resource-management"),
]);
export type ScenarioTypeModel = typeof ScenarioTypeSchema.static;

export const TestRunStatusSchema = t.Union([
  t.Literal("created"),
  t.Literal("initializing"),
  t.Literal("coordination"),
  t.Literal("executing"),
  t.Literal("completing"),
  t.Literal("completed"),
  t.Literal("failed"),
  t.Literal("cancelled"),
]);
export type TestRunStatusModel = typeof TestRunStatusSchema.static;

export const CompletionReasonSchema = t.Union([
  t.Literal("success"),
  t.Literal("timeout"),
  t.Literal("manual-stop"),
  t.Literal("error"),
  t.Literal("all-agents-failed"),
]);
export type CompletionReasonModel = typeof CompletionReasonSchema.static;

// ---------------------------------------------------------------------------
// Test Metrics
// ---------------------------------------------------------------------------

export const TestMetricsSchema = t.Object({
  llmDecisionCount: t.Number(),
  targetActionCount: t.Number(),
  testingAgentActionCount: t.Number(),
  targetMessageCount: t.Number(),
  testingAgentMessageCount: t.Number(),
  llmErrorCount: t.Number(),
  totalLlmResponseTimeMs: t.Number(),
  lastLlmDecisionAt: t.Nullable(t.String()),
});
export type TestMetricsModel = typeof TestMetricsSchema.static;

// ---------------------------------------------------------------------------
// Test Run Config
// ---------------------------------------------------------------------------

export const TestRunConfigSchema = t.Object({
  llmPollingIntervalMs: t.Number(),
  behaviorIntensity: t.Number(),
  enableVoice: t.Boolean(),
  enableText: t.Boolean(),
  targetLlmSystemPromptOverride: t.Nullable(t.String()),
  minecraftServer: t.Object({
    host: t.String(),
    port: t.Number(),
    version: t.String(),
  }),
});
export type TestRunConfigModel = typeof TestRunConfigSchema.static;

// ---------------------------------------------------------------------------
// Test Run (full state)
// ---------------------------------------------------------------------------

export const TestRunSchema = t.Object({
  testId: t.String(),
  scenarioType: ScenarioTypeSchema,
  status: TestRunStatusSchema,
  targetLlmModel: t.String(),
  testingAgentProfiles: t.Array(t.String()),
  testingAgentIds: t.Array(t.String()),
  targetAgentId: t.Nullable(t.String()),
  targetBotId: t.Nullable(t.String()),
  discordTextChannelId: t.Nullable(t.String()),
  discordVoiceChannelId: t.Nullable(t.String()),
  durationSeconds: t.Number(),
  createdAt: t.String(),
  startedAt: t.Nullable(t.String()),
  endedAt: t.Nullable(t.String()),
  completionReason: t.Nullable(CompletionReasonSchema),
  config: TestRunConfigSchema,
  metrics: TestMetricsSchema,
});
export type TestRunModel = typeof TestRunSchema.static;

// ---------------------------------------------------------------------------
// API Request Bodies
// ---------------------------------------------------------------------------

export const CreateTestRequestSchema = t.Object({
  scenarioType: ScenarioTypeSchema,
  targetLlmModel: t.String({ minLength: 1 }),
  testingAgentProfiles: t.Optional(
    t.Array(t.String(), { minItems: 1, maxItems: 5 })
  ),
  durationSeconds: t.Optional(
    t.Number({ minimum: 60, maximum: 1800 })
  ),
  config: t.Optional(
    t.Object({
      llmPollingIntervalMs: t.Optional(
        t.Number({ minimum: 3000, maximum: 30000 })
      ),
      behaviorIntensity: t.Optional(
        t.Number({ minimum: 0, maximum: 1 })
      ),
      enableVoice: t.Optional(t.Boolean()),
      enableText: t.Optional(t.Boolean()),
      targetLlmSystemPromptOverride: t.Optional(t.String()),
      minecraftServer: t.Optional(
        t.Object({
          host: t.Optional(t.String()),
          port: t.Optional(t.Number({ minimum: 1, maximum: 65535 })),
          version: t.Optional(t.String()),
        })
      ),
    })
  ),
});
export type CreateTestRequestModel = typeof CreateTestRequestSchema.static;

// ---------------------------------------------------------------------------
// API Response Models
// ---------------------------------------------------------------------------

export const TestListResponseSchema = t.Object({
  tests: t.Array(TestRunSchema),
  count: t.Number(),
});
export type TestListResponseModel = typeof TestListResponseSchema.static;

export const ScenarioInfoSchema = t.Object({
  type: ScenarioTypeSchema,
  name: t.String(),
  description: t.String(),
  defaultProfiles: t.Array(t.String()),
  defaultDurationSeconds: t.Number(),
  relevantMetrics: t.Array(t.String()),
});
export type ScenarioInfoModel = typeof ScenarioInfoSchema.static;

export const ScenarioListResponseSchema = t.Object({
  scenarios: t.Array(ScenarioInfoSchema),
  count: t.Number(),
});
export type ScenarioListResponseModel = typeof ScenarioListResponseSchema.static;

// ---------------------------------------------------------------------------
// Action Log
// ---------------------------------------------------------------------------

export const TestActionLogSchema = t.Object({
  logId: t.String(),
  testId: t.String(),
  sourceAgentId: t.String(),
  sourceType: t.Union([t.Literal("target"), t.Literal("testing-agent")]),
  actionCategory: t.Union([
    t.Literal("minecraft"),
    t.Literal("discord"),
    t.Literal("llm-decision"),
  ]),
  actionDetail: t.String(),
  timestamp: t.String(),
  metadata: t.Record(t.String(), t.Unknown()),
});
export type TestActionLogModel = typeof TestActionLogSchema.static;

// ---------------------------------------------------------------------------
// Error / Success Responses
// ---------------------------------------------------------------------------

export const TestErrorResponseSchema = t.Object({
  success: t.Literal(false),
  message: t.String(),
  code: t.Optional(t.String()),
});
export type TestErrorResponseModel = typeof TestErrorResponseSchema.static;

export const TestSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  message: t.String(),
});
export type TestSuccessResponseModel = typeof TestSuccessResponseSchema.static;
