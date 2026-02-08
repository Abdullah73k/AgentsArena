/**
 * Agent Spawner
 *
 * Handles creation and initialization of testing agents.
 * Coordinates between Minecraft bot creation and agent configuration.
 */

import type { AgentConfig, AgentInstance } from "../model";
import { botManager } from "../../minecraft/bot/bot-manager";
import { buildSystemPrompt } from "../prompts";
import { BehaviorExecutor } from "./behavior-executor";

export class AgentSpawner {
  /**
   * Spawn a new testing agent
   */
  static async spawn(config: AgentConfig): Promise<{
    ok: boolean;
    data?: AgentInstance;
    message?: string;
    code?: string;
  }> {
    try {
      // 1. Generate system prompt
      const systemPrompt = buildSystemPrompt({
        profile: config.profile,
        behaviorIntensity: config.behaviorIntensity,
        customOverrides: config.customPromptOverrides,
      });

      // 2. Spawn Minecraft bot
      // botManager.createBot() returns BotState directly and throws BotManagerError on failure
      let botId: string;
      try {
        const botState = await botManager.createBot(
          config.minecraftBot.username,
          config.minecraftBot.host,
          config.minecraftBot.port,
          config.minecraftBot.version
        );
        botId = botState.botId;
      } catch (botError) {
        return {
          ok: false,
          message: `Failed to spawn Minecraft bot: ${botError instanceof Error ? botError.message : "Unknown error"}`,
          code: "BOT_SPAWN_FAILED",
        };
      }

      // 3. Create agent instance
      const agentId = this.generateAgentId();

      const agent: AgentInstance = {
        agentId,
        profile: config.profile,
        status: "active",
        minecraftBotId: botId,
        discordUserId: config.discordConfig?.channelId,
        systemPrompt,
        spawnedAt: new Date().toISOString(),
        lastActionAt: null,
        actionCount: 0,
        metadata: {
          behaviorIntensity: config.behaviorIntensity,
          host: config.minecraftBot.host,
          port: config.minecraftBot.port,
          version: config.minecraftBot.version,
        },
      };

      console.log(
        `[AgentSpawner] Created agent ${agentId} with profile ${config.profile}`
      );

      return {
        ok: true,
        data: agent,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "SPAWN_ERROR",
      };
    }
  }

  /**
   * Initialize agent behavior execution
   */
  static async initializeBehavior(agent: AgentInstance): Promise<void> {
    await BehaviorExecutor.initialize(agent);
  }

  /**
   * Generate a unique agent ID
   */
  private static generateAgentId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Validate agent configuration
   */
  static validateConfig(config: AgentConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.profile) {
      errors.push("Profile is required");
    }

    if (!config.minecraftBot?.username) {
      errors.push("Minecraft bot username is required");
    }

    if (!config.minecraftBot?.host) {
      errors.push("Minecraft bot host is required");
    }

    if (
      !config.minecraftBot?.port ||
      config.minecraftBot.port < 1 ||
      config.minecraftBot.port > 65535
    ) {
      errors.push("Valid Minecraft bot port is required (1-65535)");
    }

    if (config.behaviorIntensity < 0 || config.behaviorIntensity > 1) {
      errors.push("Behavior intensity must be between 0 and 1");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
