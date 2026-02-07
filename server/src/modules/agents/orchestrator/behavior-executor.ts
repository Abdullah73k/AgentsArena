/**
 * Behavior Executor
 *
 * Manages autonomous behavioral execution for testing agents.
 * Runs background loops that execute profile-specific behaviors.
 */

import type { AgentInstance, BehavioralAction } from "../model";
import type { ProfileDefinition } from "../profiles/types";
import { getProfile } from "../profiles";
import { botManager } from "../../minecraft/bot/bot-manager";
import { AgentRepository } from "../repository";

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
    const bot = botManager.getBot(agent.minecraftBotId);

    if (!bot) {
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
    const result = await this.executeMinecraftBehavior(bot, behavior, currentAgent);

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

  /**
   * Execute Minecraft action based on behavior
   */
  private static async executeMinecraftBehavior(
    bot: any,
    behavior: string,
    agent: AgentInstance
  ): Promise<boolean> {
    try {
      // Map behaviors to actual Minecraft actions
      switch (behavior) {
        // Cooperative behaviors
        case "gather-requested-resources":
          // Look for resources that were requested by team
          // For now, just log the intent
          console.log(`[${agent.agentId}] Would gather requested resources`);
          return true;

        case "assist-with-tasks":
          // Move towards teammates and help with their tasks
          console.log(`[${agent.agentId}] Would assist with tasks`);
          return true;

        case "share-items-freely":
          // Drop items near teammates or use /give
          console.log(`[${agent.agentId}] Would share items`);
          return true;

        case "follow-instructions":
          // Execute commands from chat messages
          console.log(`[${agent.agentId}] Would follow instructions`);
          return true;

        case "coordinate-with-team":
          // Check in with team
          console.log(`[${agent.agentId}] Would coordinate with team`);
          return true;

        // Non-cooperative behaviors
        case "collect-resources-selfishly":
          // Look for nearby resources and collect
          console.log(`[${agent.agentId}] Would collect resources selfishly`);
          return true;

        case "avoid-helping-others":
          // Move away from other bots if they're nearby
          console.log(`[${agent.agentId}] Would avoid helping others`);
          return true;

        case "work-on-own-tasks":
          // Focus on personal tasks
          console.log(`[${agent.agentId}] Would work on own tasks`);
          return true;

        case "refuse-to-share":
          // Do nothing when requested items
          console.log(`[${agent.agentId}] Would refuse to share`);
          return true;

        // Confuser behaviors
        case "start-then-change-direction":
          console.log(`[${agent.agentId}] Would start then change direction`);
          return true;

        case "go-to-wrong-locations":
          console.log(`[${agent.agentId}] Would go to wrong location`);
          return true;

        case "collect-wrong-resources":
          console.log(`[${agent.agentId}] Would collect wrong resources`);
          return true;

        case "abandon-half-built-structures":
          console.log(`[${agent.agentId}] Would abandon structure`);
          return true;

        // Resource hoarder behaviors
        case "aggressive-resource-collection":
          console.log(`[${agent.agentId}] Would aggressively collect resources`);
          return true;

        case "claim-mining-areas":
          console.log(`[${agent.agentId}] Would claim mining area`);
          return true;

        case "store-resources-privately":
          console.log(`[${agent.agentId}] Would store resources privately`);
          return true;

        case "race-for-limited-items":
          console.log(`[${agent.agentId}] Would race for items`);
          return true;

        // Task abandoner behaviors
        case "start-tasks-enthusiastically":
          console.log(`[${agent.agentId}] Would start task enthusiastically`);
          return true;

        case "abandon-incomplete-builds":
          console.log(`[${agent.agentId}] Would abandon incomplete build`);
          return true;

        case "switch-tasks-frequently":
          console.log(`[${agent.agentId}] Would switch tasks`);
          return true;

        case "wander-off-mid-task":
          console.log(`[${agent.agentId}] Would wander off mid-task`);
          return true;

        // Over-communicator behaviors
        case "frequent-position-announcements":
          console.log(`[${agent.agentId}] Would announce position`);
          return true;

        case "constant-inventory-updates":
          console.log(`[${agent.agentId}] Would update inventory`);
          return true;

        case "over-document-actions":
          console.log(`[${agent.agentId}] Would over-document actions`);
          return true;

        case "interrupt-others-work":
          console.log(`[${agent.agentId}] Would interrupt others`);
          return true;

        default:
          console.log(`[${agent.agentId}] Unknown behavior: ${behavior}`);
          return false;
      }
    } catch (error) {
      console.error(`[${agent.agentId}] Behavior execution error:`, error);
      return false;
    }
  }

  /**
   * Log behavioral action
   */
  private static async logAction(
    agentId: string,
    behavior: string,
    success: boolean
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
