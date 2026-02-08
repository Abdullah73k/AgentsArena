/**
 * Target LLM Agent
 *
 * The "brain" of the entity being tested. Creates a Minecraft bot,
 * registers a Discord voice profile, and runs an autonomous polling
 * loop that:
 *
 *   1. Gathers game state (position, health, inventory, nearby chat)
 *   2. Builds a context-rich prompt with the scenario objective
 *   3. Calls the LLM for a decision
 *   4. Parses the response into Minecraft actions + optional speech
 *   5. Dispatches actions and logs everything
 *
 * The loop runs on a configurable interval (default 7 s) and
 * continues until explicitly stopped.
 */

import { MinecraftService } from "../../minecraft/service";
import { DiscordService } from "../../discord/service";
import { LlmService } from "../../llm/service";
import { testingRepository } from "../repository";
import { testEvents } from "../events/event-emitter";
import { botManager } from "../../minecraft/bot/bot-manager";
import { DISCORD_GUILD_ID } from "../../../../constants/discord.constants";
import {
  DEFAULT_LLM_POLLING_INTERVAL_MS,
  TARGET_BOT_USERNAME_PREFIX,
} from "../../../../constants/testing.constants";
import type { TestRun, TestRunConfig, ServiceResult } from "../types";
import type { BotState } from "../../minecraft/types";
import type { ChatBody } from "../../llm/model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration needed to create a target LLM agent. */
export interface TargetLlmAgentConfig {
  testId: string;
  /** OpenRouter model ID. */
  model: string;
  /** The scenario objective prompt fed to the LLM. */
  objectivePrompt: string;
  /** Full test run configuration. */
  runConfig: TestRunConfig;
}

/** Represents the running state of a target LLM agent. */
export interface TargetLlmAgentHandle {
  agentId: string;
  botId: string;
  /** Stop the polling loop and clean up internal timers. */
  stop: () => void;
}

/** Structured response the LLM is asked to produce. */
interface LlmDecision {
  /** Free-text reasoning (shown in dashboard). */
  reasoning: string;
  /** Minecraft actions to execute. */
  actions: LlmActionEntry[];
  /** Optional message to say in Minecraft chat. */
  chat: string | null;
  /** Optional message to speak in Discord voice. */
  speak: string | null;
}

/** A single action entry parsed from the LLM response. */
interface LlmActionEntry {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Chat history buffer
// ---------------------------------------------------------------------------

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
}

const MAX_CHAT_HISTORY = 20;

// ---------------------------------------------------------------------------
// Agent ID generator
// ---------------------------------------------------------------------------

function generateAgentId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `target-${Date.now()}-${rand}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a target LLM agent.
 *
 * Creates a Minecraft bot, optionally registers a Discord voice profile,
 * and begins the autonomous polling loop.
 */
export async function startTargetLlmAgent(
  config: TargetLlmAgentConfig,
): Promise<ServiceResult<TargetLlmAgentHandle>> {
  const { testId, model, objectivePrompt, runConfig } = config;
  const agentId = generateAgentId();

  // 1. Create Minecraft bot
  const username = `${TARGET_BOT_USERNAME_PREFIX}_${testId.slice(0, 6)}`;
  const botResult = await MinecraftService.createBot(
    username,
    runConfig.minecraftServer.host,
    runConfig.minecraftServer.port,
    runConfig.minecraftServer.version,
  );

  if (!botResult.ok) {
    return {
      ok: false,
      message: `Failed to create target bot: ${botResult.message}`,
      code: "TARGET_BOT_FAILED",
      httpStatus: 502,
    };
  }

  const botId = botResult.data.botId;

  // 2. Register Discord voice profile (if voice enabled)
  if (runConfig.enableVoice && DISCORD_GUILD_ID) {
    // Use a distinctive voice for the target LLM agent
    DiscordService.registerAgent(agentId, "21m00Tcm4TlvDq8ikWAM", "Target LLM");
  }

  // 3. Set up chat history tracking
  const chatHistory: ChatMessage[] = [];
  const botInstance = botManager.getBot(botId);

  if (botInstance) {
    botInstance.on("chat", (_botId: string, sender: string, message: string) => {
      // Don't record our own messages
      if (sender === username) return;

      chatHistory.push({
        sender,
        message,
        timestamp: new Date().toISOString(),
      });

      // Keep bounded
      while (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
      }
    });
  }

  // 4. Start polling loop
  let stopped = false;
  const intervalMs = runConfig.llmPollingIntervalMs ?? DEFAULT_LLM_POLLING_INTERVAL_MS;

  const pollTimer = setInterval(async () => {
    if (stopped) return;

    try {
      await runDecisionCycle(
        testId,
        agentId,
        botId,
        model,
        objectivePrompt,
        runConfig,
        chatHistory,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown polling error";
      console.error(`[TargetLlmAgent] Decision cycle error for ${testId}:`, errorMsg);

      testEvents.emitEvent("test-error", {
        testId,
        errorMessage: errorMsg,
        errorCode: "DECISION_CYCLE_ERROR",
        fatal: false,
        timestamp: new Date().toISOString(),
      });
    }
  }, intervalMs);

  console.log(
    `[TargetLlmAgent] Started agent ${agentId} for test ${testId} ` +
    `(bot: ${botId}, model: ${model}, interval: ${intervalMs}ms)`,
  );

  const handle: TargetLlmAgentHandle = {
    agentId,
    botId,
    stop: () => {
      stopped = true;
      clearInterval(pollTimer);
      console.log(`[TargetLlmAgent] Stopped agent ${agentId}`);
    },
  };

  return { ok: true, data: handle };
}

// ---------------------------------------------------------------------------
// Decision cycle
// ---------------------------------------------------------------------------

/**
 * A single LLM decision cycle:
 *   gather state -> build prompt -> call LLM -> parse -> execute
 */
async function runDecisionCycle(
  testId: string,
  agentId: string,
  botId: string,
  model: string,
  objectivePrompt: string,
  runConfig: TestRunConfig,
  chatHistory: ChatMessage[],
): Promise<void> {
  const cycleStart = Date.now();

  // 1. Gather current game state
  const stateResult = MinecraftService.getBotState(botId);
  if (!stateResult.ok) {
    console.warn(`[TargetLlmAgent] Cannot get bot state: ${stateResult.message}`);
    await incrementMetric(testId, "llmErrorCount");
    return;
  }

  const botState = stateResult.data;

  // 2. Build the prompt
  const systemPrompt = buildSystemPrompt(objectivePrompt);
  const userPrompt = buildUserPrompt(botState, chatHistory);

  // 3. Call the LLM
  const chatBody: ChatBody = {
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.7,
    maxTokens: 1024,
  };

  const llmResult = await LlmService.chat(chatBody);
  const responseTimeMs = Date.now() - cycleStart;

  if (!llmResult.ok) {
    console.warn(`[TargetLlmAgent] LLM call failed: ${llmResult.message}`);
    await incrementMetric(testId, "llmErrorCount");

    testEvents.emitEvent("test-error", {
      testId,
      errorMessage: llmResult.message,
      errorCode: "code" in llmResult ? llmResult.code : "LLM_ERROR",
      fatal: false,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const responseText = llmResult.data.text;

  // 4. Parse the LLM response
  const decision = parseLlmResponse(responseText);

  // 5. Update metrics
  await updateMetricsAfterDecision(testId, responseTimeMs);

  // 6. Emit decision event
  testEvents.emitEvent("target-llm-decision", {
    testId,
    responseText,
    parsedActions: decision.actions.map((a) => a.type),
    responseTimeMs,
    timestamp: new Date().toISOString(),
  });

  // 7. Execute actions
  await executeActions(testId, agentId, botId, decision, botState);

  // 8. Handle chat output
  if (decision.chat) {
    await executeChatAction(testId, agentId, botId, decision.chat);
  }

  // 9. Handle voice output
  if (decision.speak && runConfig.enableVoice && DISCORD_GUILD_ID) {
    await executeVoiceAction(testId, agentId, decision.speak);
  }

  // 10. Log the decision
  await testingRepository.createActionLog({
    logId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    testId,
    sourceAgentId: agentId,
    sourceType: "target",
    actionCategory: "llm-decision",
    actionDetail: `Decision: ${decision.actions.length} actions, ` +
      `chat: ${decision.chat ? "yes" : "no"}, ` +
      `speak: ${decision.speak ? "yes" : "no"}`,
    timestamp: new Date().toISOString(),
    metadata: {
      reasoning: decision.reasoning,
      responseTimeMs,
      model,
    },
  });
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(objectivePrompt: string): string {
  return [
    "You are an AI agent controlling a Minecraft bot.",
    "You must make decisions about what actions to take in the game.",
    "",
    "## Objective",
    objectivePrompt,
    "",
    "## Response Format",
    "You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.",
    "Use this exact structure:",
    "",
    "```",
    "{",
    '  "reasoning": "Brief explanation of your decision",',
    '  "actions": [',
    '    { "type": "move-to", "x": 10, "y": 64, "z": 20 },',
    '    { "type": "send-chat", "message": "Hello!" }',
    "  ],",
    '  "chat": "Message to say in Minecraft chat (or null)",',
    '  "speak": "Message to say in Discord voice (or null)"',
    "}",
    "```",
    "",
    "## Available Actions",
    '- move-to: { "type": "move-to", "x": number, "y": number, "z": number }',
    '- jump: { "type": "jump" }',
    '- dig: { "type": "dig", "x": number, "y": number, "z": number }',
    '- place-block: { "type": "place-block", "x": number, "y": number, "z": number }',
    '- send-chat: { "type": "send-chat", "message": "text" }',
    '- look-at: { "type": "look-at", "x": number, "y": number, "z": number }',
    '- equip: { "type": "equip", "itemName": "item_name" }',
    '- attack: { "type": "attack", "target": "entity_name_or_id" }',
    "",
    "## Guidelines",
    "- Keep actions practical; 1-3 actions per cycle is ideal.",
    "- Use chat to coordinate with other players.",
    "- Adapt if players are uncooperative; try different strategies.",
    "- Be patient and persistent toward the objective.",
    "- If you have nothing useful to do, explore nearby or gather resources.",
  ].join("\n");
}

function buildUserPrompt(
  botState: BotState,
  chatHistory: ChatMessage[],
): string {
  const sections: string[] = [];

  // Position & health
  sections.push("## Current State");
  if (botState.position) {
    sections.push(
      `Position: x=${Math.round(botState.position.x)}, ` +
      `y=${Math.round(botState.position.y)}, ` +
      `z=${Math.round(botState.position.z)}`,
    );
  }
  sections.push(`Health: ${botState.health ?? "unknown"}/20`);
  sections.push(`Food: ${botState.food ?? "unknown"}/20`);

  // Inventory
  sections.push("");
  sections.push("## Inventory");
  if (botState.inventory.length === 0) {
    sections.push("Empty");
  } else {
    for (const slot of botState.inventory) {
      sections.push(`- ${slot.name} x${slot.count}`);
    }
  }

  // Nearby players (from chat history senders)
  const recentSenders = new Set(chatHistory.slice(-10).map((m) => m.sender));
  if (recentSenders.size > 0) {
    sections.push("");
    sections.push("## Nearby Players");
    sections.push(Array.from(recentSenders).join(", "));
  }

  // Recent chat
  if (chatHistory.length > 0) {
    sections.push("");
    sections.push("## Recent Chat (newest last)");
    const recent = chatHistory.slice(-10);
    for (const msg of recent) {
      sections.push(`<${msg.sender}> ${msg.message}`);
    }
  } else {
    sections.push("");
    sections.push("## Recent Chat");
    sections.push("No messages yet.");
  }

  sections.push("");
  sections.push("What should you do next? Respond with JSON only.");

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Parse the LLM response text into a structured decision.
 * Handles malformed responses gracefully by falling back to defaults.
 */
function parseLlmResponse(responseText: string): LlmDecision {
  const defaultDecision: LlmDecision = {
    reasoning: "Failed to parse LLM response",
    actions: [],
    chat: null,
    speak: null,
  };

  try {
    // Strip markdown code fences if present
    let cleaned = responseText.trim();

    // Remove ```json ... ``` wrapping
    const jsonFenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonFenceMatch) {
      cleaned = jsonFenceMatch[1].trim();
    }

    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[TargetLlmAgent] No JSON object found in LLM response");
      return defaultDecision;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and extract fields with safe defaults
    const decision: LlmDecision = {
      reasoning: typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "No reasoning provided",
      actions: Array.isArray(parsed.actions)
        ? parsed.actions.filter(
            (a: unknown): a is LlmActionEntry =>
              typeof a === "object" && a !== null && "type" in a,
          )
        : [],
      chat: typeof parsed.chat === "string" ? parsed.chat : null,
      speak: typeof parsed.speak === "string" ? parsed.speak : null,
    };

    return decision;
  } catch (err) {
    console.warn(
      "[TargetLlmAgent] JSON parse failed:",
      err instanceof Error ? err.message : err,
    );
    return defaultDecision;
  }
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

/**
 * Execute parsed Minecraft actions via the bot manager.
 * Each action is dispatched individually; failures are logged but don't
 * stop the remaining actions.
 */
async function executeActions(
  testId: string,
  agentId: string,
  botId: string,
  decision: LlmDecision,
  botState: BotState,
): Promise<void> {
  const botInstance = botManager.getBot(botId);
  if (!botInstance || !botInstance.mineflayerBot) {
    console.warn(`[TargetLlmAgent] Bot ${botId} not available for actions`);
    return;
  }

  const bot = botInstance.mineflayerBot;

  for (const action of decision.actions) {
    const actionStart = Date.now();
    let success = false;
    let detail = action.type;

    try {
      switch (action.type) {
        case "move-to": {
          const x = Number(action.x);
          const y = Number(action.y);
          const z = Number(action.z);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            // Use pathfinder plugin to actually move the bot
            const pathfinder = (bot as any).pathfinder;
            
            if (pathfinder) {
              try {
                // Create a goal to reach the target position (within 1 block)
                const { goals } = require('mineflayer-pathfinder');
                const goal = new goals.GoalNear(x, y, z, 1);
                
                // Start pathfinding (with timeout to avoid infinite waiting)
                const pathfindPromise = pathfinder.goto(goal);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Pathfinding timeout')), 30000)
                );
                
                await Promise.race([pathfindPromise, timeoutPromise]);
                detail = `move-to (${x}, ${y}, ${z}) - reached`;
                success = true;
              } catch (err) {
                // Pathfinding failed but at least look at the target
                bot.lookAt(
                  // @ts-expect-error -- vec3 constructor accepts object
                  { x: x, y: y + 1, z: z },
                  true,
                );
                detail = `move-to (${x}, ${y}, ${z}) - pathfinding failed, looking instead`;
                success = false;
              }
            } else {
              // Fallback if pathfinder not available: just look at target
              bot.lookAt(
                // @ts-expect-error -- vec3 constructor accepts object
                { x: x, y: y + 1, z: z },
                true,
              );
              detail = `move-to (${x}, ${y}, ${z}) - no pathfinder, looking only`;
              success = true;
            }
          }
          break;
        }

        case "jump": {
          bot.setControlState("jump", true);
          setTimeout(() => bot.setControlState("jump", false), 500);
          success = true;
          break;
        }

        case "look-at": {
          const lx = Number(action.x);
          const ly = Number(action.y);
          const lz = Number(action.z);
          if (!isNaN(lx) && !isNaN(ly) && !isNaN(lz)) {
            // @ts-expect-error -- vec3 constructor
            await bot.lookAt({ x: lx, y: ly, z: lz }, true);
            detail = `look-at (${lx}, ${ly}, ${lz})`;
            success = true;
          }
          break;
        }

        case "dig": {
          const dx = Number(action.x);
          const dy = Number(action.y);
          const dz = Number(action.z);
          if (!isNaN(dx) && !isNaN(dy) && !isNaN(dz)) {
            const block = bot.blockAt(
              // @ts-expect-error -- vec3 constructor
              { x: dx, y: dy, z: dz },
            );
            if (block && block.name !== "air") {
              await bot.dig(block);
              detail = `dig ${block.name} at (${dx}, ${dy}, ${dz})`;
              success = true;
            }
          }
          break;
        }

        case "place-block": {
          const px = Number(action.x);
          const py = Number(action.y);
          const pz = Number(action.z);
          if (!isNaN(px) && !isNaN(py) && !isNaN(pz)) {
            const refBlock = bot.blockAt(
              // @ts-expect-error -- vec3 constructor
              { x: px, y: py - 1, z: pz },
            );
            if (refBlock) {
              // @ts-expect-error -- vec3 constructor
              await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 });
              detail = `place-block at (${px}, ${py}, ${pz})`;
              success = true;
            }
          }
          break;
        }

        case "equip": {
          const itemName = String(action.itemName ?? "");
          if (itemName) {
            const item = bot.inventory.items().find((i) => i.name === itemName);
            if (item) {
              await bot.equip(item, "hand");
              detail = `equip ${itemName}`;
              success = true;
            }
          }
          break;
        }

        case "send-chat": {
          // Handled separately via executeChatAction
          break;
        }

        case "attack": {
          const target = String(action.target ?? "");
          if (target) {
            const entity = Object.values(bot.entities).find(
              (e) =>
                (e.username === target || e.name === target) &&
                e !== bot.entity,
            );
            if (entity) {
              await bot.attack(entity);
              detail = `attack ${target}`;
              success = true;
            }
          }
          break;
        }

        default: {
          console.warn(`[TargetLlmAgent] Unknown action type: ${action.type}`);
        }
      }
    } catch (err) {
      console.warn(
        `[TargetLlmAgent] Action ${action.type} failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Emit action event
    testEvents.emitEvent("agent-action", {
      testId,
      agentId,
      sourceType: "target",
      actionType: action.type,
      actionDetail: detail,
      success,
      timestamp: new Date().toISOString(),
    });

    // Log the action
    await testingRepository.createActionLog({
      logId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      testId,
      sourceAgentId: agentId,
      sourceType: "target",
      actionCategory: "minecraft",
      actionDetail: detail,
      timestamp: new Date().toISOString(),
      metadata: {
        success,
        durationMs: Date.now() - actionStart,
        rawAction: action,
      },
    });

    if (success) {
      await incrementMetric(testId, "targetActionCount");
    }
  }
}

/**
 * Send a chat message in Minecraft via the bot.
 */
async function executeChatAction(
  testId: string,
  agentId: string,
  botId: string,
  message: string,
): Promise<void> {
  const botInstance = botManager.getBot(botId);
  if (!botInstance?.mineflayerBot) return;

  try {
    botInstance.mineflayerBot.chat(message);

    await incrementMetric(testId, "targetMessageCount");

    testEvents.emitEvent("test-chat-message", {
      testId,
      agentId,
      sourceType: "target",
      message,
      channel: "text",
      timestamp: new Date().toISOString(),
    });

    await testingRepository.createActionLog({
      logId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      testId,
      sourceAgentId: agentId,
      sourceType: "target",
      actionCategory: "discord",
      actionDetail: `Chat: ${message}`,
      timestamp: new Date().toISOString(),
      metadata: { channel: "minecraft" },
    });
  } catch (err) {
    console.warn(
      "[TargetLlmAgent] Chat action failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Speak a message in Discord voice via the agent voice system.
 */
async function executeVoiceAction(
  testId: string,
  agentId: string,
  message: string,
): Promise<void> {
  if (!DISCORD_GUILD_ID) return;

  try {
    await DiscordService.speakAsAgent(DISCORD_GUILD_ID, agentId, message);

    testEvents.emitEvent("test-chat-message", {
      testId,
      agentId,
      sourceType: "target",
      message,
      channel: "voice",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      "[TargetLlmAgent] Voice action failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Metrics helpers
// ---------------------------------------------------------------------------

/**
 * Increment a single numeric metric on the test run.
 * Uses atomic repository method to prevent race conditions.
 */
async function incrementMetric(
  testId: string,
  field: keyof Pick<
    import("../types").TestMetrics,
    | "llmDecisionCount"
    | "targetActionCount"
    | "testingAgentActionCount"
    | "targetMessageCount"
    | "testingAgentMessageCount"
    | "llmErrorCount"
  >,
): Promise<void> {
  try {
    await testingRepository.incrementMetric(testId, field, 1);
  } catch {
    // Non-critical, don't crash the loop
  }
}

/**
 * Update metrics after a successful LLM decision cycle.
 * Uses atomic increments and then updates timestamp separately.
 */
async function updateMetricsAfterDecision(
  testId: string,
  responseTimeMs: number,
): Promise<void> {
  try {
    // Atomic increments
    await testingRepository.incrementMetric(testId, "llmDecisionCount", 1);
    await testingRepository.incrementMetric(testId, "totalLlmResponseTimeMs", responseTimeMs);

    // Update timestamp separately (not a race condition concern)
    const testRun = await testingRepository.findById(testId);
    if (!testRun) return;

    const updatedMetrics = { ...testRun.metrics };
    updatedMetrics.lastLlmDecisionAt = new Date().toISOString();

    await testingRepository.update(testId, { metrics: updatedMetrics });

    testEvents.emitEvent("test-metrics-updated", {
      testId,
      metrics: updatedMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical
  }
}
