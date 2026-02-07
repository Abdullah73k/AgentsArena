/**
 * Mining action handlers: dig, place-block.
 *
 * Uses mineflayer's dig and placeBlock APIs.
 */

import { type Bot as MineflayerBot } from "mineflayer";
import type {
  ActionHandler,
  ActionResult,
  DigAction,
  PlaceBlockAction,
  BlockFace,
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

/** Map our BlockFace type to mineflayer's Vec3 face direction. */
function faceToVec3(face: BlockFace): { x: number; y: number; z: number } {
  const faceMap: Record<BlockFace, { x: number; y: number; z: number }> = {
    top: { x: 0, y: 1, z: 0 },
    bottom: { x: 0, y: -1, z: 0 },
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 },
  };
  return faceMap[face];
}

// ---------------------------------------------------------------------------
// dig
// ---------------------------------------------------------------------------

export const digHandler: ActionHandler<DigAction> = {
  actionType: "dig",

  async execute(bot: unknown, action: DigAction): Promise<ActionResult> {
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

      if (block.name === "air") {
        return failResult(
          action.botId,
          action.type,
          "Cannot dig air",
          startTime,
        );
      }

      await mfBot.dig(block);

      return successResult(
        action.botId,
        action.type,
        `Dug ${block.name} at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};

// ---------------------------------------------------------------------------
// place-block
// ---------------------------------------------------------------------------

export const placeBlockHandler: ActionHandler<PlaceBlockAction> = {
  actionType: "place-block",

  async execute(
    bot: unknown,
    action: PlaceBlockAction,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const mfBot = bot as MineflayerBot;

    try {
      const { Vec3 } = await import("vec3");
      const refBlock = mfBot.blockAt(
        new Vec3(
          action.position.x,
          action.position.y,
          action.position.z,
        ),
      );

      if (!refBlock) {
        return failResult(
          action.botId,
          action.type,
          `No reference block at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
          startTime,
        );
      }

      const face = faceToVec3(action.face);
      const faceVec = new Vec3(face.x, face.y, face.z);

      await mfBot.placeBlock(refBlock, faceVec);

      return successResult(
        action.botId,
        action.type,
        `Placed block against ${action.face} face at (${action.position.x}, ${action.position.y}, ${action.position.z})`,
        startTime,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failResult(action.botId, action.type, message, startTime);
    }
  },
};
