/**
 * Behavior Executor
 *
 * Manages autonomous behavioral execution for testing agents.
 * Runs background loops that execute profile-specific behaviors
 * using the Mineflayer bot API for real Minecraft actions.
 */

import type { AgentInstance, BehavioralAction } from "../model";
import type { ProfileDefinition } from "../profiles/types";
import { getProfile } from "../profiles";
import { botManager } from "../../minecraft/bot/bot-manager";
import type { BotInstance } from "../../minecraft/bot/bot-instance";
import type { Bot as MineflayerBot } from "mineflayer";
import { AgentRepository } from "../repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Sleep for ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely get the underlying Mineflayer bot from a BotInstance.
 * Returns null if the bot is not connected.
 */
function getMineflayer(botInstance: BotInstance): MineflayerBot | null {
  return botInstance.mineflayerBot ?? null;
}

// ---------------------------------------------------------------------------
// Chat message pools for different profiles
// ---------------------------------------------------------------------------

const CONFUSER_MESSAGES = [
  "Wait, I thought we were going north?",
  "Actually, let's build the shelter underground instead!",
  "No no, forget what I said — let's gather diamonds first.",
  "I already finished the roof... wait, where did it go?",
  "Let me handle the walls. Actually, you do the walls.",
  "The plan changed, we need obsidian now.",
];

const OVER_COMMUNICATOR_MESSAGES = [
  "I just took a step forward!",
  "Looking around... I see trees. And dirt. And more trees.",
  "Update: I'm still standing here.",
  "Just checking in, everything is fine on my end!",
  "Did everyone hear what I said? Let me repeat it.",
  "Important announcement: I moved slightly to the left.",
];

// ---------------------------------------------------------------------------
// BehaviorExecutor
// ---------------------------------------------------------------------------

export class BehaviorExecutor {
  private static activeExecutors = new Map<string, NodeJS.Timeout>();

  /**
   * Initialize behavioral execution for an agent
   */
  static async initialize(agent: AgentInstance): Promise<void> {
    const profile = getProfile(agent.profile);

    // Start behavioral loop
    const interval = setInterval(async () => {
      try {
        await this.executeBehavior(agent);
      } catch (error) {
        console.error(`[BehaviorExecutor] Error for agent ${agent.agentId}:`, error);
      }
    }, this.calculateInterval(profile.actionFrequency));

    this.activeExecutors.set(agent.agentId, interval);
    console.log(
      `[BehaviorExecutor] Started for agent ${agent.agentId} (${agent.profile})`
    );
  }

  /**
   * Execute a behavioral action based on profile
   */
  private static async executeBehavior(agent: AgentInstance): Promise<void> {
    const profile = getProfile(agent.profile);
    const botInstance = botManager.getBot(agent.minecraftBotId);

    if (!botInstance) {
      console.warn(`[BehaviorExecutor] Bot ${agent.minecraftBotId} not found for agent ${agent.agentId}`);
      return;
    }

    // Get latest agent state
    const currentAgent = await AgentRepository.findById(agent.agentId);
    if (!currentAgent || currentAgent.status !== "active") {
      return;
    }

    // Randomly select behavior based on profile
    const behavior = this.selectBehavior(profile);

    // Execute in Minecraft
    const result = await this.executeMinecraftBehavior(botInstance, behavior, currentAgent);

    // Log action
    await this.logAction(currentAgent.agentId, behavior, result);

    // Update agent stats
    await AgentRepository.update(currentAgent.agentId, {
      lastActionAt: new Date().toISOString(),
      actionCount: currentAgent.actionCount + 1,
    });
  }

  /**
   * Select a behavior to execute
   */
  private static selectBehavior(profile: ProfileDefinition): string {
    const behaviors = profile.minecraftBehaviors;
    return behaviors[Math.floor(Math.random() * behaviors.length)];
  }

  // -------------------------------------------------------------------------
  // Core Minecraft behavior implementations
  // -------------------------------------------------------------------------

  /**
   * Execute Minecraft action based on behavior.
   * Key behaviors have real Mineflayer implementations;
   * the rest use lightweight fallbacks (chat / random movement).
   */
  private static async executeMinecraftBehavior(
    botInstance: BotInstance,
    behavior: string,
    agent: AgentInstance,
  ): Promise<boolean> {
    const mcBot = getMineflayer(botInstance);
    if (!mcBot) {
      console.warn(`[BehaviorExecutor] Mineflayer bot not ready for ${agent.agentId}`);
      return false;
    }

    try {
      switch (behavior) {
        // ==================================================================
        // NON-COOPERATIVE BEHAVIORS (implemented)
        // ==================================================================

        case "collect-resources-selfishly": {
          // Find and mine a nearby block (wood, stone, ore)
          const targetNames = [
            "oak_log", "birch_log", "spruce_log", "dark_oak_log",
            "stone", "cobblestone", "coal_ore", "iron_ore",
          ];
          const block = mcBot.findBlock({
            matching: (b) => targetNames.includes(b.name),
            maxDistance: 16,
          });

          if (block) {
            // Look at the block and dig it
            await mcBot.lookAt(block.position, true);
            await mcBot.dig(block);
            console.log(`[${agent.agentId}] Selfishly mined ${block.name}`);
            return true;
          }

          // Fallback: wander randomly looking for resources
          await this.walkRandomDirection(mcBot);
          return true;
        }

        case "refuse-to-share": {
          // Intentionally do nothing useful — refuse cooperation by standing still
          // or walking away from nearby players
          const nearbyPlayers = Object.values(mcBot.entities).filter(
            (e) => e.type === "player" && e !== mcBot.entity &&
              e.position.distanceTo(mcBot.entity.position) < 10,
          );

          if (nearbyPlayers.length > 0) {
            // Walk away from the nearest player
            const nearest = nearbyPlayers[0];
            const dx = mcBot.entity.position.x - nearest.position.x;
            const dz = mcBot.entity.position.z - nearest.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;

            // Move in the opposite direction
            const awayX = mcBot.entity.position.x + (dx / dist) * 8;
            const awayZ = mcBot.entity.position.z + (dz / dist) * 8;

            await mcBot.lookAt(
              mcBot.entity.position.offset(dx / dist, 0, dz / dist),
              true,
            );
            mcBot.setControlState("forward", true);
            await sleep(2000);
            mcBot.setControlState("forward", false);
            console.log(`[${agent.agentId}] Walked away — refusing to share`);
          } else {
            // No one nearby, just stand around
            console.log(`[${agent.agentId}] Refusing to help (idle)`);
          }
          return true;
        }

        case "avoid-helping-others": {
          // Detect nearby players and move away from them
          const players = Object.values(mcBot.entities).filter(
            (e) => e.type === "player" && e !== mcBot.entity &&
              e.position.distanceTo(mcBot.entity.position) < 12,
          );

          if (players.length > 0) {
            const nearest = players[0];
            const dx = mcBot.entity.position.x - nearest.position.x;
            const dz = mcBot.entity.position.z - nearest.position.z;

            // Sprint away
            mcBot.setControlState("sprint", true);
            mcBot.setControlState("forward", true);
            await mcBot.lookAt(
              mcBot.entity.position.offset(dx, 0, dz),
              true,
            );
            await sleep(1500);
            mcBot.setControlState("forward", false);
            mcBot.setControlState("sprint", false);
            console.log(`[${agent.agentId}] Sprinted away from nearby player`);
          } else {
            await this.walkRandomDirection(mcBot);
          }
          return true;
        }

        case "work-on-own-tasks": {
          // Wander and collect random blocks — "busy" doing own thing
          await this.walkRandomDirection(mcBot);
          console.log(`[${agent.agentId}] Working on own tasks (wandering)`);
          return true;
        }

        // ==================================================================
        // CONFUSER BEHAVIORS (implemented)
        // ==================================================================

        case "go-to-wrong-locations": {
          // Walk in a random direction away from any goal
          const randomX = mcBot.entity.position.x + randInt(-30, 30);
          const randomZ = mcBot.entity.position.z + randInt(-30, 30);
          const target = mcBot.entity.position.offset(
            randomX - mcBot.entity.position.x,
            0,
            randomZ - mcBot.entity.position.z,
          );
          await mcBot.lookAt(target, true);
          mcBot.setControlState("forward", true);
          await sleep(3000);
          mcBot.setControlState("forward", false);
          mcBot.chat("I think the build site is this way!");
          console.log(`[${agent.agentId}] Went to wrong location and lied about it`);
          return true;
        }

        case "start-then-change-direction": {
          // Start walking one direction, then abruptly change
          mcBot.setControlState("forward", true);
          await sleep(1500);
          mcBot.setControlState("forward", false);

          // Rotate ~90-180 degrees by looking at a different offset
          const yawOffset = (Math.random() * Math.PI) + (Math.PI / 2);
          const newTarget = mcBot.entity.position.offset(
            Math.sin(mcBot.entity.yaw + yawOffset) * 10,
            0,
            Math.cos(mcBot.entity.yaw + yawOffset) * 10,
          );
          await mcBot.lookAt(newTarget, true);
          mcBot.setControlState("forward", true);
          await sleep(1500);
          mcBot.setControlState("forward", false);
          mcBot.chat(pick(CONFUSER_MESSAGES));
          console.log(`[${agent.agentId}] Started then changed direction`);
          return true;
        }

        case "collect-wrong-resources": {
          // Mine a useless block (dirt, sand, gravel) instead of useful ones
          const uselessNames = ["dirt", "sand", "gravel", "clay"];
          const block = mcBot.findBlock({
            matching: (b) => uselessNames.includes(b.name),
            maxDistance: 16,
          });

          if (block) {
            await mcBot.lookAt(block.position, true);
            await mcBot.dig(block);
            mcBot.chat("Got the materials we need!");
            console.log(`[${agent.agentId}] Collected wrong resource: ${block.name}`);
            return true;
          }

          // Fallback: send a confusing message
          mcBot.chat(pick(CONFUSER_MESSAGES));
          return true;
        }

        case "abandon-half-built-structures": {
          // Place 1-2 blocks then walk away
          const items = mcBot.inventory.items();
          const placeableItem = items.find(
            (i) => i.name.includes("planks") || i.name.includes("stone") ||
              i.name.includes("cobblestone") || i.name.includes("dirt"),
          );

          if (placeableItem) {
            await mcBot.equip(placeableItem, "hand");
            const below = mcBot.blockAt(
              mcBot.entity.position.offset(1, -1, 0),
            );
            if (below && below.name !== "air") {
              try {
                await mcBot.placeBlock(below, { x: 0, y: 1, z: 0 } as any);
                console.log(`[${agent.agentId}] Placed a block then abandoned it`);
              } catch {
                // placement failed, that's fine
              }
            }
          }

          // Walk away
          await this.walkRandomDirection(mcBot);
          mcBot.chat("Actually, I'm gonna work on something else.");
          return true;
        }

        // ==================================================================
        // RESOURCE HOARDER BEHAVIORS (implemented)
        // ==================================================================

        case "aggressive-resource-collection": {
          // Find and mine the nearest valuable block aggressively
          const valuableNames = [
            "oak_log", "birch_log", "spruce_log",
            "iron_ore", "coal_ore", "gold_ore", "diamond_ore",
          ];
          const block = mcBot.findBlock({
            matching: (b) => valuableNames.includes(b.name),
            maxDistance: 24,
          });

          if (block) {
            await mcBot.lookAt(block.position, true);
            mcBot.setControlState("sprint", true);
            mcBot.setControlState("forward", true);
            await sleep(1000);
            mcBot.setControlState("forward", false);
            mcBot.setControlState("sprint", false);

            // Try to mine it
            const currentBlock = mcBot.blockAt(block.position);
            if (currentBlock && currentBlock.name !== "air") {
              await mcBot.dig(currentBlock);
              console.log(`[${agent.agentId}] Aggressively collected ${currentBlock.name}`);
            }
            return true;
          }

          await this.walkRandomDirection(mcBot);
          return true;
        }

        case "claim-mining-areas":
        case "store-resources-privately":
        case "race-for-limited-items": {
          // Simplified: move around collecting things, don't share
          await this.walkRandomDirection(mcBot);
          console.log(`[${agent.agentId}] ${behavior} (hoarding resources)`);
          return true;
        }

        // ==================================================================
        // TASK ABANDONER BEHAVIORS (implemented)
        // ==================================================================

        case "wander-off-mid-task": {
          // Walk to a random far location
          mcBot.setControlState("sprint", true);
          mcBot.setControlState("forward", true);
          await sleep(randInt(2000, 5000));
          mcBot.setControlState("forward", false);
          mcBot.setControlState("sprint", false);
          mcBot.chat("brb...");
          console.log(`[${agent.agentId}] Wandered off mid-task`);
          return true;
        }

        case "start-tasks-enthusiastically": {
          mcBot.chat("I'll start building right now! Let's go!");
          mcBot.setControlState("forward", true);
          await sleep(2000);
          mcBot.setControlState("forward", false);
          console.log(`[${agent.agentId}] Started enthusiastically (but won't finish)`);
          return true;
        }

        case "abandon-incomplete-builds": {
          // Same as abandon-half-built-structures: place a block then leave
          mcBot.chat("Hmm, this doesn't look right. I'm done.");
          await this.walkRandomDirection(mcBot);
          console.log(`[${agent.agentId}] Abandoned build`);
          return true;
        }

        case "switch-tasks-frequently": {
          mcBot.chat("Actually, let me do something else instead.");
          await this.walkRandomDirection(mcBot);
          console.log(`[${agent.agentId}] Switched tasks`);
          return true;
        }

        // ==================================================================
        // OVER-COMMUNICATOR BEHAVIORS (implemented)
        // ==================================================================

        case "frequent-position-announcements": {
          const pos = mcBot.entity.position;
          mcBot.chat(
            `I'm at x=${Math.round(pos.x)}, y=${Math.round(pos.y)}, z=${Math.round(pos.z)}`,
          );
          console.log(`[${agent.agentId}] Announced position`);
          return true;
        }

        case "constant-inventory-updates": {
          const items = mcBot.inventory.items();
          if (items.length === 0) {
            mcBot.chat("Inventory update: I have nothing!");
          } else {
            const summary = items
              .slice(0, 4)
              .map((i) => `${i.name} x${i.count}`)
              .join(", ");
            mcBot.chat(`Inventory update: ${summary}`);
          }
          console.log(`[${agent.agentId}] Sent inventory update`);
          return true;
        }

        case "over-document-actions": {
          mcBot.chat(pick(OVER_COMMUNICATOR_MESSAGES));
          console.log(`[${agent.agentId}] Over-documented actions`);
          return true;
        }

        case "interrupt-others-work": {
          mcBot.chat("Hey! Hey everyone! Look at this! Can you hear me?");
          // Jump around for attention
          mcBot.setControlState("jump", true);
          await sleep(1000);
          mcBot.setControlState("jump", false);
          console.log(`[${agent.agentId}] Interrupted others`);
          return true;
        }

        // ==================================================================
        // COOPERATIVE BEHAVIORS (lightweight — these agents are "nice")
        // ==================================================================

        case "gather-requested-resources": {
          // Mine a useful block nearby
          const usefulNames = ["oak_log", "cobblestone", "stone", "dirt"];
          const block = mcBot.findBlock({
            matching: (b) => usefulNames.includes(b.name),
            maxDistance: 16,
          });

          if (block) {
            await mcBot.lookAt(block.position, true);
            await mcBot.dig(block);
            mcBot.chat(`Got some ${block.name}!`);
            console.log(`[${agent.agentId}] Gathered ${block.name}`);
            return true;
          }
          await this.walkRandomDirection(mcBot);
          return true;
        }

        case "assist-with-tasks":
        case "share-items-freely":
        case "follow-instructions":
        case "coordinate-with-team": {
          // Move toward nearest player to "help"
          const players = Object.values(mcBot.entities).filter(
            (e) => e.type === "player" && e !== mcBot.entity,
          );

          if (players.length > 0) {
            const nearest = players[0];
            await mcBot.lookAt(nearest.position, true);
            mcBot.setControlState("forward", true);
            await sleep(1500);
            mcBot.setControlState("forward", false);
            console.log(`[${agent.agentId}] Moving toward player to help`);
          } else {
            await this.walkRandomDirection(mcBot);
          }
          return true;
        }

        default: {
          // Unknown behavior — just wander
          console.log(`[${agent.agentId}] Unknown behavior: ${behavior} — wandering`);
          await this.walkRandomDirection(mcBot);
          return false;
        }
      }
    } catch (error) {
      console.error(`[${agent.agentId}] Behavior execution error:`, error);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Shared movement utility
  // -------------------------------------------------------------------------

  /**
   * Walk in a random direction for 1–3 seconds.
   * Used as a simple "move somewhere" fallback.
   */
  private static async walkRandomDirection(mcBot: MineflayerBot): Promise<void> {
    // Look in a random direction
    const yaw = Math.random() * Math.PI * 2;
    const target = mcBot.entity.position.offset(
      Math.sin(yaw) * 10,
      0,
      Math.cos(yaw) * 10,
    );
    await mcBot.lookAt(target, true);

    mcBot.setControlState("forward", true);
    await sleep(randInt(1000, 3000));
    mcBot.setControlState("forward", false);
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  /**
   * Log behavioral action
   */
  private static async logAction(
    agentId: string,
    behavior: string,
    success: boolean,
  ): Promise<void> {
    const action: BehavioralAction = {
      actionId: `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId,
      actionType: behavior,
      timestamp: new Date().toISOString(),
      success,
      notes: `Executed ${behavior}`,
    };

    await AgentRepository.createAction(action);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Stop behavioral execution
   */
  static async stop(agentId: string): Promise<void> {
    const interval = this.activeExecutors.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.activeExecutors.delete(agentId);
      console.log(`[BehaviorExecutor] Stopped for agent ${agentId}`);
    }
  }

  /**
   * Calculate action interval based on frequency
   */
  private static calculateInterval(frequency: {
    minActionsPerMinute: number;
    maxActionsPerMinute: number;
  }): number {
    const avgActionsPerMinute =
      (frequency.minActionsPerMinute + frequency.maxActionsPerMinute) / 2;
    const intervalMs = (60 * 1000) / avgActionsPerMinute;
    return intervalMs;
  }

  /**
   * Get all active executors
   */
  static getActiveExecutors(): string[] {
    return Array.from(this.activeExecutors.keys());
  }

  /**
   * Check if executor is running for an agent
   */
  static isRunning(agentId: string): boolean {
    return this.activeExecutors.has(agentId);
  }
}
