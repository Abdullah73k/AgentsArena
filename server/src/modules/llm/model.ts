/**
 * Elysia TypeBox models for the LLM module.
 *
 * Single source of truth for validation AND TypeScript types.
 * Register on the controller via `.model()` and reference by name.
 */

import { t } from "elysia";

// ---------------------------------------------------------------------------
// Chat Message
// ---------------------------------------------------------------------------

/** Chat message role. */
export const MessageRoleModel = t.Union([
  t.Literal("system"),
  t.Literal("user"),
  t.Literal("assistant"),
]);
export type MessageRoleModel = typeof MessageRoleModel.static;

export const ChatMessageModel = t.Object({
  role: MessageRoleModel,
  content: t.String({ minLength: 1 }),
});
export type ChatMessageModel = typeof ChatMessageModel.static;

// ---------------------------------------------------------------------------
// Request Bodies
// ---------------------------------------------------------------------------

/**
 * Body for POST /api/llm/chat and /api/llm/chat/stream.
 *
 * `model` is an OpenRouter model ID, e.g.:
 *   - "deepseek/deepseek-chat-v3-0324:free"
 *   - "google/gemini-2.0-flash-exp:free"
 *   - "openai/gpt-4o-mini"
 *   - "anthropic/claude-sonnet-4"
 *
 * If omitted, the server default is used.
 */
export const ChatBody = t.Object({
  model: t.Optional(t.String()),
  system: t.Optional(t.String()),
  messages: t.Array(ChatMessageModel, { minItems: 1 }),
  temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
  maxTokens: t.Optional(t.Number({ minimum: 1 })),
});
export type ChatBody = typeof ChatBody.static;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Response for non-streaming chat completion. */
export const ChatResponse = t.Object({
  text: t.String(),
  model: t.String(),
  usage: t.Optional(
    t.Object({
      inputTokens: t.Optional(t.Number()),
      outputTokens: t.Optional(t.Number()),
      totalTokens: t.Optional(t.Number()),
    }),
  ),
  finishReason: t.Optional(t.String()),
});
export type ChatResponse = typeof ChatResponse.static;

/** Error response from the LLM module. */
export const LlmErrorResponse = t.Object({
  success: t.Literal(false),
  message: t.String(),
  code: t.Optional(t.String()),
});
export type LlmErrorResponse = typeof LlmErrorResponse.static;

/** Status response for GET /api/llm/status. */
export const LlmStatusResponse = t.Object({
  configured: t.Boolean(),
  defaultModel: t.String(),
});
export type LlmStatusResponse = typeof LlmStatusResponse.static;
