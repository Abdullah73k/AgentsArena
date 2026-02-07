/**
 * Combat action handlers: attack, equip.
 *
 * Uses mineflayer's attack and equip APIs.
 */

import { type Bot as MineflayerBot } from "mineflayer";
import type {
  ActionHandler,
  ActionResult,
  AttackAction,
  EquipAction,
  EquipDestination,
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

/** Map our EquipDestination to mineflayer's destination string. */
function mapEquipDestination(
  dest: EquipDestination,
): "hand" | "off-hand" | "head" | "torso" | "legs" | "feet" {
  return dest;
}

// ---------------------------------------------------------------------------
// attack
// ---------------------------------------------------------------------------

export const attackHandler: ActionHandler<AttackAction> = {
  actionType: "attack",

  async execute(bot: unknown, action: AttackAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      // Find entity by username or entity ID
      const entity = Object.values(mfBot.entities).find(
        (e) =>
          e.username === action.target ||
          String(e.id) === action.target,
      );

      if (!entity) {
        return failResult(
          action.botId,
          action.type,
          `Target "${action.target}" not found nearby`,
          startTime,
        );
      }

      mfBot.attack(entity);

      return successResult(
        action.botId,
        action.type,
        `Attacked ${action.target}`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// equip
// ---------------------------------------------------------------------------

export const equipHandler: ActionHandler<EquipAction> = {
  actionType: "equip",

  async execute(bot: unknown, action: EquipAction): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      const item = mfBot.inventory
        .items()
        .find((i) => i.name === action.itemName);

      if (!item) {
        return failResult(
          action.botId,
          action.type,
          `Item "${action.itemName}" not found in inventory`,
          startTime,
        );
      }

      const dest = mapEquipDestination(action.destination);
      await mfBot.equip(item, dest);

      return successResult(
        action.botId,
        action.type,
        `Equipped ${action.itemName} to ${action.destination}`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};
