/**
 * Lifecycle Manager
 *
 * Manages the complete lifecycle of testing agents from creation to termination.
 * Handles state transitions and resource cleanup.
 */

import type { AgentInstance, AgentStatus } from "../model";
import { AgentRepository } from "../repository";
import { BehaviorExecutor } from "./behavior-executor";
import { botManager } from "../../minecraft/bot/bot-manager";

export class LifecycleManager {
  /**
   * Transition agent to a new status
   */
  static async transitionStatus(
    agentId: string,
    newStatus: AgentStatus
  ): Promise<void> {
    const agent = await AgentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(
      `[LifecycleManager] Agent ${agentId}: ${agent.status} → ${newStatus}`
    );

    await AgentRepository.update(agentId, { status: newStatus });

    // Handle status-specific actions
    switch (newStatus) {
      case "paused":
        await this.handlePause(agentId);
        break;
      case "active":
        await this.handleResume(agent);
        break;
      case "terminated":
        await this.handleTermination(agent);
        break;
      case "error":
        await this.handleError(agent);
        break;
    }
  }

  /**
   * Pause agent behavior execution
   */
  private static async handlePause(agentId: string): Promise<void> {
    await BehaviorExecutor.stop(agentId);
    console.log(`[LifecycleManager] Paused agent ${agentId}`);
  }

  /**
   * Resume agent behavior execution
   */
  private static async handleResume(agent: AgentInstance): Promise<void> {
    if (!BehaviorExecutor.isRunning(agent.agentId)) {
      await BehaviorExecutor.initialize(agent);
      console.log(`[LifecycleManager] Resumed agent ${agent.agentId}`);
    }
  }

  /**
   * Handle agent termination
   */
  private static async handleTermination(agent: AgentInstance): Promise<void> {
    // Stop behavior execution
    await BehaviorExecutor.stop(agent.agentId);

    // Disconnect Minecraft bot
    try {
      const bot = botManager.getBot(agent.minecraftBotId);
      if (bot) {
        await botManager.disconnectBot(agent.minecraftBotId);
      }
    } catch (error) {
      console.error(
        `[LifecycleManager] Error disconnecting bot ${agent.minecraftBotId}:`,
        error
      );
    }

    console.log(`[LifecycleManager] Terminated agent ${agent.agentId}`);
  }

  /**
   * Handle agent error state
   */
  private static async handleError(agent: AgentInstance): Promise<void> {
    // Stop behavior execution
    await BehaviorExecutor.stop(agent.agentId);

    console.error(`[LifecycleManager] Agent ${agent.agentId} entered error state`);
  }

  /**
   * Cleanup all agents
   */
  static async cleanupAll(): Promise<void> {
    const agents = await AgentRepository.findAll({ status: "active" });

    for (const agent of agents) {
      await this.transitionStatus(agent.agentId, "terminated");
    }

    console.log(`[LifecycleManager] Cleaned up ${agents.length} agents`);
  }

  /**
   * Get agent health status
   */
  static async getHealthStatus(agentId: string): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const agent = await AgentRepository.findById(agentId);
    if (!agent) {
      return {
        healthy: false,
        issues: ["Agent not found"],
      };
    }

    const issues: string[] = [];

    // Check if bot is connected
    const bot = botManager.getBot(agent.minecraftBotId);
    if (!bot) {
      issues.push("Minecraft bot not found");
    }

    // Check if behavior executor is running
    if (agent.status === "active" && !BehaviorExecutor.isRunning(agentId)) {
      issues.push("Behavior executor not running");
    }

    // Check if agent has been active recently
    if (agent.lastActionAt) {
      const lastAction = new Date(agent.lastActionAt);
      const now = new Date();
      const minutesSinceLastAction =
        (now.getTime() - lastAction.getTime()) / (1000 * 60);

      if (minutesSinceLastAction > 5 && agent.status === "active") {
        issues.push("No actions in the last 5 minutes");
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
