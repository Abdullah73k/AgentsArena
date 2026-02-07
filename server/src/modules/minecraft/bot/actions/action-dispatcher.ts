/**
 * ActionDispatcher validates and executes bot actions using registered handlers.
 *
 * It is the single entry point for all action execution:
 * 1. Validates the bot exists and is in a valid state
 * 2. Looks up the appropriate handler from the registry
 * 3. Executes the action with rate limiting
 * 4. Returns a typed ActionResult
 */

import { botManager } from "../bot-manager";
import { actionRegistry } from "./action-registry";
import { MAX_ACTIONS_PER_SECOND } from "../../../../../constants/minecraft.constants";
import type { BotAction, ActionResult, ActionType } from "../../types";

// ---------------------------------------------------------------------------
// Rate limiter (simple token bucket per bot)
// ---------------------------------------------------------------------------

const rateLimitBuckets = new Map<string, { tokens: number; lastRefill: number }>();

function checkRateLimit(botId: string): boolean {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(botId);

  if (!bucket) {
    bucket = { tokens: MAX_ACTIONS_PER_SECOND, lastRefill: now };
    rateLimitBuckets.set(botId, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    MAX_ACTIONS_PER_SECOND,
    bucket.tokens + elapsed * MAX_ACTIONS_PER_SECOND,
  );
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Build a failure ActionResult helper.
 */
function failResult(
  botId: string,
  actionType: ActionType | string,
  message: string,
  startTime: number,
): ActionResult {
  return {
    botId,
    actionType: actionType as ActionType,
    status: "failure",
    message,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Dispatch an action to the appropriate handler.
 *
 * @param action - The fully validated action to execute.
 * @returns ActionResult describing the outcome.
 */
export async function dispatchAction(action: BotAction): Promise<ActionResult> {
  const startTime = Date.now();

  // 1. Check rate limit
  if (!checkRateLimit(action.botId)) {
    return failResult(
      action.botId,
      action.type,
      "Rate limit exceeded — too many actions per second",
      startTime,
    );
  }

  // 2. Verify bot exists and is in a valid state
  const instance = botManager.getBot(action.botId);
  if (!instance) {
    return failResult(
      action.botId,
      action.type,
      `Bot "${action.botId}" not found`,
      startTime,
    );
  }

  if (instance.status !== "spawned") {
    return failResult(
      action.botId,
      action.type,
      `Bot "${action.botId}" is not spawned (current status: ${instance.status})`,
      startTime,
    );
  }

  const mfBot = instance.mineflayerBot;
  if (!mfBot) {
    return failResult(
      action.botId,
      action.type,
      `Bot "${action.botId}" has no active mineflayer instance`,
      startTime,
    );
  }

  // 3. Look up handler
  const handler = actionRegistry.get(action.type);
  if (!handler) {
    return failResult(
      action.botId,
      action.type,
      `No handler registered for action type "${action.type}"`,
      startTime,
    );
  }

  // 4. Execute
  try {
    const result = await handler.execute(mfBot, action);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failResult(action.botId, action.type, message, startTime);
  }
}
