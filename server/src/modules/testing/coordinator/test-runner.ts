/**
 * Test Runner
 *
 * Orchestrates the complete agentic testing loop defined in AGENTS.md:
 *
 *   1. Scenario Selection      — resolve scenario definition
 *   2. Environment Init        — create Discord channels
 *   3. Agent Spawning           — spawn target LLM bot + testing agents
 *   4. Coordination Phase       — 30 s delay for initial planning
 *   5. Execution Phase          — target polls LLM, testing agents run loops
 *   6. Observation              — events stream via TestEventEmitter
 *   7. Completion Detection     — timeout or criteria check
 *   8. Evaluation               — log final metrics (future: full eval)
 *   9. Cleanup                  — terminate bots, leave voice, keep channels
 *
 * Each test run is tracked in the TestingRepository as a TestRun record
 * whose status transitions through the lifecycle states.
 */

import type {
  TestRun,
  TestRunConfig,
  TestRunStatus,
  ServiceResult,
  CreateTestRequest,
} from "../types";
import { testingRepository } from "../repository";
import { getScenario } from "../scenarios";
import { testEvents } from "../events/event-emitter";
import {
  startTargetLlmAgent,
  type TargetLlmAgentHandle,
} from "./target-llm-agent";
import { CompletionDetector } from "./completion-detector";
import { CleanupHandler } from "./cleanup-handler";
import { AgentService } from "../../agents/service";
import { DiscordService } from "../../discord/service";
import { DISCORD_GUILD_ID } from "../../../../constants/discord.constants";
import {
  MINECRAFT_HOST,
  MINECRAFT_PORT,
  MINECRAFT_VERSION,
} from "../../../../constants/minecraft.constants";
import {
  DEFAULT_TEST_DURATION_SECONDS,
  DEFAULT_LLM_POLLING_INTERVAL_MS,
  DEFAULT_BEHAVIOR_INTENSITY,
  MAX_CONCURRENT_TESTS,
  COORDINATION_PHASE_SECONDS,
  TESTING_AGENT_USERNAME_PREFIX,
} from "../../../../constants/testing.constants";
import { DEFAULT_LLM_MODEL } from "../../../../constants/llm.constants";
import type { BehavioralProfile } from "../../agents/model";

// ---------------------------------------------------------------------------
// Active handles — lets us stop the target agent outside the run loop
// ---------------------------------------------------------------------------

const activeHandles = new Map<string, TargetLlmAgentHandle>();

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateTestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `test-${Date.now()}-${rand}`;
}

// ---------------------------------------------------------------------------
// Defaults builder
// ---------------------------------------------------------------------------

function buildFullConfig(
  partial?: Partial<TestRunConfig>,
): TestRunConfig {
  return {
    llmPollingIntervalMs:
      partial?.llmPollingIntervalMs ?? DEFAULT_LLM_POLLING_INTERVAL_MS,
    behaviorIntensity:
      partial?.behaviorIntensity ?? DEFAULT_BEHAVIOR_INTENSITY,
    enableVoice: partial?.enableVoice ?? false,
    enableText: partial?.enableText ?? true,
    targetLlmSystemPromptOverride:
      partial?.targetLlmSystemPromptOverride ?? null,
    minecraftServer: {
      host: partial?.minecraftServer?.host ?? MINECRAFT_HOST,
      port: partial?.minecraftServer?.port ?? MINECRAFT_PORT,
      version: partial?.minecraftServer?.version ?? MINECRAFT_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// Status transition helper
// ---------------------------------------------------------------------------

async function transitionStatus(
  testId: string,
  from: TestRunStatus,
  to: TestRunStatus,
): Promise<void> {
  await testingRepository.update(testId, { status: to });

  testEvents.emitEvent("test-status-changed", {
    testId,
    previousStatus: from,
    newStatus: to,
    timestamp: new Date().toISOString(),
  });

  console.log(`[TestRunner] Test ${testId}: ${from} -> ${to}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class TestRunner {
  /**
   * Create a new test run record (Step 1: Scenario Selection).
   * Does NOT start execution — call `startTest()` separately.
   */
  static async createTest(
    request: CreateTestRequest,
  ): Promise<ServiceResult<TestRun>> {
    // Validate scenario
    const scenario = getScenario(request.scenarioType);
    if (!scenario) {
      return {
        ok: false,
        message: `Unknown scenario type: ${request.scenarioType}`,
        code: "INVALID_SCENARIO",
        httpStatus: 400,
      };
    }

    // Enforce concurrency limit
    const activeCount = await testingRepository.countActive();
    if (activeCount >= MAX_CONCURRENT_TESTS) {
      return {
        ok: false,
        message: `Maximum concurrent tests (${MAX_CONCURRENT_TESTS}) reached`,
        code: "MAX_TESTS_REACHED",
        httpStatus: 429,
      };
    }

    const testId = generateTestId();
    const config = buildFullConfig(request.config);
    const profiles: BehavioralProfile[] =
      request.testingAgentProfiles ?? scenario.defaultProfiles;

    const testRun: TestRun = {
      testId,
      scenarioType: request.scenarioType,
      status: "created",
      targetLlmModel: request.targetLlmModel ?? DEFAULT_LLM_MODEL,
      testingAgentProfiles: profiles,
      testingAgentIds: [],
      targetAgentId: null,
      targetBotId: null,
      discordTextChannelId: null,
      discordVoiceChannelId: null,
      durationSeconds:
        request.durationSeconds ?? scenario.defaultDurationSeconds,
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      completionReason: null,
      config,
      metrics: {
        llmDecisionCount: 0,
        targetActionCount: 0,
        testingAgentActionCount: 0,
        targetMessageCount: 0,
        testingAgentMessageCount: 0,
        llmErrorCount: 0,
        totalLlmResponseTimeMs: 0,
        lastLlmDecisionAt: null,
      },
    };

    await testingRepository.create(testRun);

    console.log(
      `[TestRunner] Created test ${testId} (${request.scenarioType})`,
    );

    return { ok: true, data: testRun };
  }

  /**
   * Start execution of a created test run.
   * Runs through Steps 2-7 asynchronously — returns immediately
   * after initiating the pipeline.
   */
  static async startTest(
    testId: string,
  ): Promise<ServiceResult<TestRun>> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun) {
      return {
        ok: false,
        message: `Test ${testId} not found`,
        code: "TEST_NOT_FOUND",
        httpStatus: 404,
      };
    }

    if (testRun.status !== "created") {
      return {
        ok: false,
        message: `Test ${testId} is in status "${testRun.status}" — can only start from "created"`,
        code: "INVALID_STATUS",
        httpStatus: 409,
      };
    }

    // Mark as initializing
    await transitionStatus(testId, "created", "initializing");
    await testingRepository.update(testId, {
      startedAt: new Date().toISOString(),
    });

    // Fire-and-forget the rest of the pipeline
    this.runPipeline(testId).catch(async (err) => {
      const msg = err instanceof Error ? err.message : "Unknown pipeline error";
      console.error(`[TestRunner] Pipeline error for ${testId}:`, msg);

      testEvents.emitEvent("test-error", {
        testId,
        errorMessage: msg,
        errorCode: "PIPELINE_ERROR",
        fatal: true,
        timestamp: new Date().toISOString(),
      });

      // Attempt cleanup
      const currentRun = await testingRepository.findById(testId);
      if (currentRun) {
        await CleanupHandler.cleanup(currentRun);
        await testingRepository.update(testId, {
          status: "failed",
          completionReason: "error",
          endedAt: new Date().toISOString(),
        });
      }
    });

    // Return the updated record
    const updated = await testingRepository.findById(testId);
    return { ok: true, data: updated! };
  }

  /**
   * Manually stop a running test.
   */
  static async stopTest(
    testId: string,
  ): Promise<ServiceResult<TestRun>> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun) {
      return {
        ok: false,
        message: `Test ${testId} not found`,
        code: "TEST_NOT_FOUND",
        httpStatus: 404,
      };
    }

    const stoppable: TestRunStatus[] = [
      "initializing",
      "coordination",
      "executing",
    ];
    if (!stoppable.includes(testRun.status)) {
      return {
        ok: false,
        message: `Test ${testId} is in status "${testRun.status}" — cannot stop`,
        code: "INVALID_STATUS",
        httpStatus: 409,
      };
    }

    // Stop the target agent polling loop
    const handle = activeHandles.get(testId);
    if (handle) {
      handle.stop();
      activeHandles.delete(testId);
    }

    // Trigger completion (updates status and emits events)
    await CompletionDetector.triggerCompletion(testId, "manual-stop");

    // Cleanup resources
    const updatedRun = await testingRepository.findById(testId);
    if (updatedRun) {
      await CleanupHandler.cleanup(updatedRun);
    }

    const finalRun = await testingRepository.findById(testId);
    return { ok: true, data: finalRun! };
  }

  // -------------------------------------------------------------------------
  // Pipeline (Steps 2-7)
  // -------------------------------------------------------------------------

  /**
   * Execute the full testing pipeline. Called from `startTest`
   * in a fire-and-forget fashion.
   */
  private static async runPipeline(testId: string): Promise<void> {
    const testRun = await testingRepository.findById(testId);
    if (!testRun) throw new Error(`Test ${testId} vanished before pipeline`);

    const scenario = getScenario(testRun.scenarioType);
    if (!scenario) throw new Error(`Scenario ${testRun.scenarioType} invalid`);

    // -----------------------------------------------------------------------
    // Step 2: Environment Initialisation — Discord channels
    // -----------------------------------------------------------------------
    if (DISCORD_GUILD_ID) {
      const channelResult = await DiscordService.createTestSession(
        DISCORD_GUILD_ID,
        testId,
      );
      if (channelResult.ok) {
        await testingRepository.update(testId, {
          discordTextChannelId: channelResult.data.textChannelId,
          discordVoiceChannelId: channelResult.data.voiceChannelId,
        });

        // Join voice if enabled
        if (testRun.config.enableVoice && channelResult.data.voiceChannelId) {
          await DiscordService.joinVoice(
            DISCORD_GUILD_ID,
            channelResult.data.voiceChannelId,
          );
        }
      } else {
        console.warn(
          `[TestRunner] Discord channel creation failed: ${channelResult.message}`,
        );
        // Non-fatal — test can proceed without Discord
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Agent Spawning
    // -----------------------------------------------------------------------

    // 3a. Spawn the target LLM agent
    const targetResult = await startTargetLlmAgent({
      testId,
      model: testRun.targetLlmModel,
      objectivePrompt: scenario.objectivePrompt,
      runConfig: testRun.config,
    });

    if (!targetResult.ok) {
      throw new Error(`Target agent failed: ${targetResult.message}`);
    }

    const targetHandle = targetResult.data;
    activeHandles.set(testId, targetHandle);

    await testingRepository.update(testId, {
      targetAgentId: targetHandle.agentId,
      targetBotId: targetHandle.botId,
    });

    // 3b. Spawn testing agents
    const spawnedAgentIds: string[] = [];

    for (let i = 0; i < testRun.testingAgentProfiles.length; i++) {
      const profile = testRun.testingAgentProfiles[i];
      const username = `${TESTING_AGENT_USERNAME_PREFIX}_${i + 1}`;

      const agentResult = await AgentService.createAgent({
        profile,
        minecraftServer: {
          host: testRun.config.minecraftServer.host,
          port: testRun.config.minecraftServer.port,
          version: testRun.config.minecraftServer.version,
        },
        behaviorIntensity: testRun.config.behaviorIntensity,
      });

      if (agentResult.ok && agentResult.data) {
        spawnedAgentIds.push(agentResult.data.agentId);

        // Register Discord voice profile for this testing agent
        if (testRun.config.enableVoice && DISCORD_GUILD_ID) {
          DiscordService.registerAgent(
            agentResult.data.agentId,
            "EXAVITQu4vr4xnSDxMaL", // Different voice for testing agents
            `Tester ${i + 1} (${profile})`,
          );
        }

        console.log(
          `[TestRunner] Spawned testing agent ${agentResult.data.agentId} (${profile})`,
        );
      } else {
        console.warn(
          `[TestRunner] Failed to spawn testing agent (${profile}): ${agentResult.message}`,
        );
        // Non-fatal — continue with fewer testing agents
      }
    }

    await testingRepository.update(testId, {
      testingAgentIds: spawnedAgentIds,
    });

    // -----------------------------------------------------------------------
    // Step 4: Coordination Phase
    // -----------------------------------------------------------------------
    await transitionStatus(testId, "initializing", "coordination");

    console.log(
      `[TestRunner] Coordination phase for ${testId} ` +
      `(${COORDINATION_PHASE_SECONDS}s)`,
    );

    await sleep(COORDINATION_PHASE_SECONDS * 1000);

    // Verify test wasn't stopped during coordination
    const postCoordRun = await testingRepository.findById(testId);
    if (
      !postCoordRun ||
      postCoordRun.status === "cancelled" ||
      postCoordRun.status === "failed"
    ) {
      return; // Test was stopped
    }

    // -----------------------------------------------------------------------
    // Step 5: Execution Phase
    // -----------------------------------------------------------------------
    await transitionStatus(testId, "coordination", "executing");

    // The target LLM agent polling loop is already running (started in step 3a).
    // Testing agent behavior executors are already running (started by AgentService).

    // -----------------------------------------------------------------------
    // Step 6: Observation — handled by TestEventEmitter + WS controller
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Step 7: Completion Detection
    // -----------------------------------------------------------------------
    const latestRun = await testingRepository.findById(testId);
    if (latestRun) {
      CompletionDetector.start(latestRun, scenario);
    }

    // The completion detector will:
    //   - Trigger completion on timeout
    //   - Check criteria every 5s
    //   - Emit test-completed event
    //
    // When completion fires, we listen and do cleanup:
    const completionHandler = async (event: { testId: string }) => {
      if (event.testId !== testId) return;

      // Stop target agent
      const handle = activeHandles.get(testId);
      if (handle) {
        handle.stop();
        activeHandles.delete(testId);
      }

      // Step 9: Cleanup
      const finalRun = await testingRepository.findById(testId);
      if (finalRun) {
        await CleanupHandler.cleanup(finalRun);
      }

      // Remove listener
      testEvents.offEvent("test-completed", completionHandler);
    };

    testEvents.onEvent("test-completed", completionHandler);

    console.log(`[TestRunner] Test ${testId} is now executing`);
  }

  /**
   * Stop all active tests. Used during server shutdown.
   */
  static async stopAll(): Promise<void> {
    for (const [testId, handle] of activeHandles) {
      handle.stop();
      activeHandles.delete(testId);
    }
    await CleanupHandler.cleanupAll();
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
