/**
 * Movement action handlers: move-to, jump, sprint, sneak, look-at.
 *
 * Uses mineflayer-pathfinder for move-to, and direct mineflayer
 * APIs for jump, sprint, sneak, and look-at.
 */

import { type Bot as MineflayerBot } from "mineflayer";
import { goals, Movements } from "mineflayer-pathfinder";
import type {
  ActionHandler,
  ActionResult,
  MoveToAction,
  JumpAction,
  SprintAction,
  SneakAction,
  LookAtAction,
} from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function successResult(
  botId: string,
  actionType: string,
  message: string,
  startTime: number,
): ActionResult {
  return {
    botId,
    actionType: actionType as ActionResult["actionType"],
    status: "success",
    message,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

function failResult(
  botId: string,
  actionType: string,
  message: string,
  startTime: number,
): ActionResult {
  return {
    botId,
    actionType: actionType as ActionResult["actionType"],
    status: "failure",
    message,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// move-to
// ---------------------------------------------------------------------------

export const moveToHandler: ActionHandler<MoveToAction> = {
  actionType: "move-to",

  async execute(bot: unknown, action: MoveToAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      // Initialize pathfinder if not already loaded
      if (!mfBot.pathfinder) {
        const { pathfinder } = await import("mineflayer-pathfinder");
        mfBot.loadPlugin(pathfinder);
      }

      const mcData = require("minecraft-data")(mfBot.version);
      const movements = new Movements(mfBot);
      mfBot.pathfinder.setMovements(movements);

      const goal = new goals.GoalNear(
        action.position.x,
        action.position.y,
        action.position.z,
        1, // within 1 block
      );

      // Return a promise that resolves when the bot reaches the goal
      return new Promise<ActionResult>((resolve) => {
        mfBot.pathfinder.setGoal(goal);

        mfBot.once("goal_reached", () => {
          resolve(
            successResult(
              action.botId,
              action.type,
              `Reached position (${action.position.x}, ${action.position.y}, ${action.position.z})`,
              startTime,
            ),
          );
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          mfBot.pathfinder.setGoal(null);
          resolve(
            failResult(
              action.botId,
              action.type,
              "Movement timed out after 30 seconds",
              startTime,
            ),
          );
        }, 30000);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// jump
// ---------------------------------------------------------------------------

export const jumpHandler: ActionHandler<JumpAction> = {
  actionType: "jump",

  async execute(bot: unknown, action: JumpAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      mfBot.setControlState("jump", true);
      // Release jump after a short delay (single jump)
      await new Promise((r) => setTimeout(r, 200));
      mfBot.setControlState("jump", false);

      return successResult(action.botId, action.type, "Jumped", startTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// sprint
// ---------------------------------------------------------------------------

export const sprintHandler: ActionHandler<SprintAction> = {
  actionType: "sprint",

  async execute(bot: unknown, action: SprintAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      mfBot.setControlState("sprint", action.enabled);
      return successResult(
        action.botId,
        action.type,
        `Sprint ${action.enabled ? "enabled" : "disabled"}`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// sneak
// ---------------------------------------------------------------------------

export const sneakHandler: ActionHandler<SneakAction> = {
  actionType: "sneak",

  async execute(bot: unknown, action: SneakAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      mfBot.setControlState("sneak", action.enabled);
      return successResult(
        action.botId,
        action.type,
        `Sneak ${action.enabled ? "enabled" : "disabled"}`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// look-at
// ---------------------------------------------------------------------------

export const lookAtHandler: ActionHandler<LookAtAction> = {
  actionType: "look-at",

  async execute(bot: unknown, action: LookAtAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      const { Vec3 } = await import("vec3");
      const target = new Vec3(
        action.position.x,
        action.position.y,
        action.position.z,
      );
      await mfBot.lookAt(target);

      return successResult(
        action.botId,
        action.type,
        `Looking at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};
