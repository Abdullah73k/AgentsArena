/**
 * Elysia TypeBox models for the Testing Agent module.
 *
 * These serve as the single source of truth for both runtime validation
 * and TypeScript types at API boundaries.
 *
 * Convention: export the TypeBox schema AND its static type together.
 * Register on Elysia via `.model({ ... })` and reference by name.
 */

import { t } from "elysia";

// ---------------------------------------------------------------------------
// Behavioral Profile Types
// ---------------------------------------------------------------------------

export const BehavioralProfileSchema = t.Union([
  t.Literal("cooperative"),
  t.Literal("non-cooperator"),
  t.Literal("confuser"),
  t.Literal("resource-hoarder"),
  t.Literal("task-abandoner"),
  t.Literal("over-communicator"),
]);
export type BehavioralProfile = typeof BehavioralProfileSchema.static;

// ---------------------------------------------------------------------------
// Agent Status Types
// ---------------------------------------------------------------------------

export const AgentStatusSchema = t.Union([
  t.Literal("idle"),
  t.Literal("spawning"),
  t.Literal("active"),
  t.Literal("paused"),
  t.Literal("terminated"),
  t.Literal("error"),
]);
export type AgentStatus = typeof AgentStatusSchema.static;

// ---------------------------------------------------------------------------
// Agent Configuration
// ---------------------------------------------------------------------------

export const AgentConfigSchema = t.Object({
  profile: BehavioralProfileSchema,
  minecraftBot: t.Object({
    username: t.String({ minLength: 1, maxLength: 16 }),
    host: t.String(),
    port: t.Number({ minimum: 1, maximum: 65535 }),
    version: t.String(),
  }),
  discordConfig: t.Optional(
    t.Object({
      guildId: t.String(),
      channelId: t.String(),
      voiceEnabled: t.Boolean(),
    })
  ),
  customPromptOverrides: t.Optional(t.Record(t.String(), t.String())),
  behaviorIntensity: t.Number({ minimum: 0, maximum: 1 }),
});
export type AgentConfig = typeof AgentConfigSchema.static;

// ---------------------------------------------------------------------------
// Agent Instance State
// ---------------------------------------------------------------------------

export const AgentInstanceSchema = t.Object({
  agentId: t.String(),
  profile: BehavioralProfileSchema,
  status: AgentStatusSchema,
  minecraftBotId: t.String(),
  discordUserId: t.Optional(t.String()),
  systemPrompt: t.String(),
  spawnedAt: t.String(),
  lastActionAt: t.Nullable(t.String()),
  actionCount: t.Number(),
  metadata: t.Record(t.String(), t.Unknown()),
});
export type AgentInstance = typeof AgentInstanceSchema.static;

// ---------------------------------------------------------------------------
// Behavioral Action Log
// ---------------------------------------------------------------------------

export const BehavioralActionSchema = t.Object({
  actionId: t.String(),
  agentId: t.String(),
  actionType: t.String(),
  timestamp: t.String(),
  minecraftAction: t.Optional(t.String()),
  discordAction: t.Optional(t.String()),
  targetLLMId: t.Optional(t.String()),
  success: t.Boolean(),
  notes: t.Optional(t.String()),
});
export type BehavioralAction = typeof BehavioralActionSchema.static;

// ---------------------------------------------------------------------------
// API Request/Response Models
// ---------------------------------------------------------------------------

export const CreateAgentRequestSchema = t.Object({
  testRunId: t.Optional(t.String()),
  profile: BehavioralProfileSchema,
  minecraftServer: t.Object({
    host: t.String(),
    port: t.Number(),
    version: t.String(),
  }),
  behaviorIntensity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  customPromptOverrides: t.Optional(t.Record(t.String(), t.String())),
});
export type CreateAgentRequest = typeof CreateAgentRequestSchema.static;

export const ListAgentsResponseSchema = t.Object({
  agents: t.Array(AgentInstanceSchema),
  count: t.Number(),
});
export type ListAgentsResponse = typeof ListAgentsResponseSchema.static;

export const AgentActionResultSchema = t.Object({
  agentId: t.String(),
  actionType: t.String(),
  status: t.Union([t.Literal("success"), t.Literal("failure")]),
  message: t.String(),
  executedAt: t.String(),
});
export type AgentActionResult = typeof AgentActionResultSchema.static;

export const AgentActionsResponseSchema = t.Object({
  agentId: t.String(),
  actions: t.Array(BehavioralActionSchema),
  count: t.Number(),
});
export type AgentActionsResponse = typeof AgentActionsResponseSchema.static;

// ---------------------------------------------------------------------------
// Error Response (reuse from minecraft module)
// ---------------------------------------------------------------------------

export const AgentErrorResponseSchema = t.Object({
  success: t.Literal(false),
  message: t.String(),
  code: t.Optional(t.String()),
});
export type AgentErrorResponse = typeof AgentErrorResponseSchema.static;

// ---------------------------------------------------------------------------
// Success Response
// ---------------------------------------------------------------------------

export const AgentSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  message: t.String(),
});
export type AgentSuccessResponse = typeof AgentSuccessResponseSchema.static;
