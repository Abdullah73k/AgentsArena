/**
 * LlmService — business logic for LLM operations.
 *
 * Follows the Elysia MVC skill:
 *  - Abstract class with static methods (no instance needed).
 *  - Decoupled from HTTP / Elysia Context.
 *  - Returns errors instead of throwing.
 *
 * Uses the Vercel AI SDK (`ai`) with the OpenRouter provider
 * (`@openrouter/ai-sdk-provider`) so the app gets access to
 * 400+ models through a single API key.
 */

import { generateText, streamText, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  OPENROUTER_API_KEY,
  DEFAULT_LLM_MODEL,
} from "../../../constants/llm.constants";
import type { ChatBody, ChatResponse } from "./model";

// ---------------------------------------------------------------------------
// Provider setup
// ---------------------------------------------------------------------------

function getOpenRouter() {
  if (!OPENROUTER_API_KEY) {
    return null;
  }
  return createOpenRouter({ apiKey: OPENROUTER_API_KEY });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: string };

function toModelMessages(
  messages: ChatBody["messages"],
  system?: string,
): ModelMessage[] {
  const result: ModelMessage[] = [];
  if (system) {
    result.push({ role: "system", content: system });
  }
  for (const m of messages) {
    result.push({ role: m.role, content: m.content });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export abstract class LlmService {
  /**
   * Non-streaming chat completion.
   * Returns the full text once the LLM finishes.
   */
  static async chat(body: ChatBody): Promise<ServiceResult<ChatResponse>> {
    const openrouter = getOpenRouter();
    if (!openrouter) {
      return {
        ok: false,
        message: "OpenRouter is not configured — missing OPENROUTER_API_KEY",
        code: "NOT_CONFIGURED",
      };
    }

    const modelId = body.model ?? DEFAULT_LLM_MODEL;

    try {
      const result = await generateText({
        model: openrouter.chat(modelId),
        messages: toModelMessages(body.messages, body.system),
        temperature: body.temperature,
        maxOutputTokens: body.maxTokens,
      });

      return {
        ok: true,
        data: {
          text: result.text,
          model: modelId,
          usage: result.usage
            ? {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                totalTokens: result.usage.totalTokens,
              }
            : undefined,
          finishReason: result.finishReason ?? undefined,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown LLM error";
      return { ok: false, message, code: "LLM_ERROR" };
    }
  }

  /**
   * Streaming chat completion.
   * Returns the AI SDK stream result so the controller can return
   * stream.textStream directly (Elysia auto-handles ReadableStream).
   */
  static streamChat(body: ChatBody) {
    const openrouter = getOpenRouter();
    if (!openrouter) {
      return {
        ok: false as const,
        message: "OpenRouter is not configured — missing OPENROUTER_API_KEY",
        code: "NOT_CONFIGURED",
      };
    }

    const modelId = body.model ?? DEFAULT_LLM_MODEL;

    try {
      const stream = streamText({
        model: openrouter.chat(modelId),
        messages: toModelMessages(body.messages, body.system),
        temperature: body.temperature,
        maxOutputTokens: body.maxTokens,
      });

      return { ok: true as const, stream, model: modelId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown LLM error";
      return { ok: false as const, message, code: "LLM_ERROR" };
    }
  }

  /** Whether OpenRouter is configured (API key present). */
  static isConfigured(): boolean {
    return typeof OPENROUTER_API_KEY === "string" && OPENROUTER_API_KEY.length > 0;
  }
}
