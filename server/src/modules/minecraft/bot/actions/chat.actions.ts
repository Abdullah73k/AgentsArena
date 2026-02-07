/**
 * Chat action handler: send-chat.
 *
 * Sends a message to the Minecraft server chat.
 */

import { type Bot as MineflayerBot } from "mineflayer";
import type {
  ActionHandler,
  ActionResult,
  SendChatAction,
} from "../../types";

// ---------------------------------------------------------------------------
// send-chat
// ---------------------------------------------------------------------------

export const sendChatHandler: ActionHandler<SendChatAction> = {
  actionType: "send-chat",

  async execute(bot: unknown, action: SendChatAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      mfBot.chat(action.message);

      return {
        botId: action.botId,
        actionType: action.type,
        status: "success",
        message: `Sent chat: "${action.message}"`,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        botId: action.botId,
        actionType: action.type,
        status: "failure",
        message,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    }
  },
};
