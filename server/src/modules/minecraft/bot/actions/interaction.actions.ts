/**
 * Interaction action handlers: use-item, open-container, interact-entity.
 *
 * Uses mineflayer's activateItem, openContainer (chest), and
 * entity interaction APIs.
 */

import { type Bot as MineflayerBot } from "mineflayer";
import type {
  ActionHandler,
  ActionResult,
  UseItemAction,
  OpenContainerAction,
  InteractEntityAction,
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
// use-item
// ---------------------------------------------------------------------------

export const useItemHandler: ActionHandler<UseItemAction> = {
  actionType: "use-item",

  async execute(bot: unknown, action: UseItemAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      mfBot.activateItem();

      return successResult(
        action.botId,
        action.type,
        "Used held item",
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// open-container
// ---------------------------------------------------------------------------

export const openContainerHandler: ActionHandler<OpenContainerAction> = {
  actionType: "open-container",

  async execute(
    bot: unknown,
    action: OpenContainerAction,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      const { Vec3 } = await import("vec3");
      const block = mfBot.blockAt(
        new Vec3(
          action.position.x,
          action.position.y,
          action.position.z,
        ),
      );

      if (!block) {
        return failResult(
          action.botId,
          action.type,
          `No block at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
          startTime,
        );
      }

      // Open the container (chest, furnace, etc.)
      const container = await mfBot.openContainer(block);

      // Close it immediately — the test framework observes the action,
      // not the container contents (for now)
      container.close();

      return successResult(
        action.botId,
        action.type,
        `Opened container (${block.name}) at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// interact-entity
// ---------------------------------------------------------------------------

export const interactEntityHandler: ActionHandler<InteractEntityAction> = {
  actionType: "interact-entity",

  async execute(
    bot: unknown,
    action: InteractEntityAction,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      const entity = Object.values(mfBot.entities).find(
        (e) =>
          e.username === action.target ||
          String(e.id) === action.target,
      );

      if (!entity) {
        return failResult(
          action.botId,
          action.type,
          `Entity "${action.target}" not found nearby`,
          startTime,
        );
      }

      // Right-click / interact with the entity
      mfBot.useOn(entity);

      return successResult(
        action.botId,
        action.type,
        `Interacted with ${action.target}`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};
