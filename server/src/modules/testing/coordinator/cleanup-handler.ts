/**
 * Cleanup Handler
 *
 * Handles resource teardown after a test run completes or is cancelled.
 * Terminates Minecraft bots, leaves Discord voice, and cleans up agents.
 *
 * Per user preference: Discord channels are KEPT for post-test review.
 */

import type { TestRun } from "../types";
import { testingRepository } from "../repository";
import { CompletionDetector } from "./completion-detector";
import { MinecraftService } from "../../minecraft/service";
import { AgentService } from "../../agents/service";
import { DiscordService } from "../../discord/service";
import { DISCORD_GUILD_ID } from "../../../../constants/discord.constants";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class CleanupHandler {
  /**
   * Perform full cleanup for a test run.
   * Called after completion detection or manual stop.
   *
   * Cleanup order:
   * 1. Stop completion detector monitoring
   * 2. Terminate testing agents (stops behavior loops + disconnects bots)
   * 3. Disconnect target LLM bot from Minecraft
   * 4. Leave Discord voice channel (but keep text/voice channels)
   * 5. Unregister agent voice profiles
   */
  static async cleanup(testRun: TestRun): Promise<void> {
    const { testId } = testRun;
    console.log(`[CleanupHandler] Starting cleanup for test ${testId}`);

    // 1. Stop completion detector
    CompletionDetector.stop(testId);

    // 2. Terminate testing agents
    for (const agentId of testRun.testingAgentIds) {
      try {
        await AgentService.terminateAgent(agentId);
        console.log(`[CleanupHandler] Terminated testing agent ${agentId}`);
      } catch (err) {
        console.error(
          `[CleanupHandler] Failed to terminate agent ${agentId}:`,
          err
        );
      }
    }

    // 3. Disconnect target LLM bot
    if (testRun.targetBotId) {
      try {
        MinecraftService.disconnectBot(testRun.targetBotId);
        console.log(
          `[CleanupHandler] Disconnected target bot ${testRun.targetBotId}`
        );
      } catch (err) {
        console.error(
          `[CleanupHandler] Failed to disconnect target bot:`,
          err
        );
      }
    }

    // 4. Leave Discord voice (but keep channels)
    const guildId = DISCORD_GUILD_ID;
    if (guildId && testRun.discordVoiceChannelId) {
      try {
        DiscordService.leaveVoice(guildId);
        console.log(`[CleanupHandler] Left Discord voice channel`);
      } catch (err) {
        console.error(
          `[CleanupHandler] Failed to leave voice channel:`,
          err
        );
      }
    }

    // 5. Unregister agent voice profiles
    if (testRun.targetAgentId) {
      try {
        DiscordService.unregisterAgent(testRun.targetAgentId);
      } catch {
        // Non-critical, ignore
      }
    }
    for (const agentId of testRun.testingAgentIds) {
      try {
        DiscordService.unregisterAgent(agentId);
      } catch {
        // Non-critical, ignore
      }
    }

    console.log(`[CleanupHandler] Cleanup complete for test ${testId}`);
  }

  /**
   * Clean up all active test runs. Used during server shutdown.
   */
  static async cleanupAll(): Promise<void> {
    console.log("[CleanupHandler] Cleaning up all active tests...");

    const activeTests = await testingRepository.findAll();
    const activeRuns = activeTests.filter(
      (t) =>
        t.status === "initializing" ||
        t.status === "coordination" ||
        t.status === "executing"
    );

    for (const testRun of activeRuns) {
      try {
        await this.cleanup(testRun);
        await testingRepository.update(testRun.testId, {
          status: "cancelled",
          completionReason: "manual-stop",
          endedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(
          `[CleanupHandler] Error cleaning up test ${testRun.testId}:`,
          err
        );
      }
    }

    // Also stop all completion detector monitors
    CompletionDetector.stopAll();

    console.log(
      `[CleanupHandler] Cleaned up ${activeRuns.length} active test(s)`
    );
  }
}
