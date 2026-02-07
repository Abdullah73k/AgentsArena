# Testing Agent System Implementation Plan

## Overview
Building a Testing Agent System for the Minecraft LLM Testing Toolkit that creates adversarial behavioral profiles to stress-test target LLMs. Following ElysiaJS MVC patterns and agents.md specifications.

---

## Architecture

```
server/src/modules/agents/
├── index.ts                          # Elysia controller (routes)
├── service.ts                        # Agent orchestration service
├── model.ts                          # Zod schemas + TypeScript types
├── repository.ts                     # Prisma database queries
│
├── profiles/                         # Behavioral profile definitions
│   ├── index.ts                      # Profile registry
│   ├── cooperative.profile.ts
│   ├── non-cooperator.profile.ts
│   ├── confuser.profile.ts
│   ├── resource-hoarder.profile.ts
│   ├── task-abandoner.profile.ts
│   └── over-communicator.profile.ts
│
├── prompts/                          # System prompt templates
│   ├── index.ts                      # Prompt builder
│   ├── base.prompt.ts                # Shared prompt fragments
│   └── templates/
│       ├── cooperative.template.ts
│       ├── non-cooperator.template.ts
│       ├── confuser.template.ts
│       ├── resource-hoarder.template.ts
│       ├── task-abandoner.template.ts
│       └── over-communicator.template.ts
│
├── orchestrator/                     # Agent spawning & coordination
│   ├── agent-spawner.ts              # Create & initialize agents
│   ├── behavior-executor.ts          # Execute behavioral patterns
│   └── lifecycle-manager.ts          # Manage agent lifecycle
│
└── __tests__/                        # Unit & integration tests
    ├── service.test.ts
    ├── profiles.test.ts
    ├── prompts.test.ts
    └── orchestrator.test.ts
```

---

## 1. Models & Types (`model.ts`)

### Core Types
```typescript
import { t } from "elysia";
import { z } from "zod";

// Behavioral profile enum
export const BehavioralProfileSchema = t.Union([
  t.Literal("cooperative"),
  t.Literal("non-cooperator"),
  t.Literal("confuser"),
  t.Literal("resource-hoarder"),
  t.Literal("task-abandoner"),
  t.Literal("over-communicator"),
]);
export type BehavioralProfile = typeof BehavioralProfileSchema.static;

// Agent status
export const AgentStatusSchema = t.Union([
  t.Literal("idle"),
  t.Literal("spawning"),
  t.Literal("active"),
  t.Literal("paused"),
  t.Literal("terminated"),
  t.Literal("error"),
]);
export type AgentStatus = typeof AgentStatusSchema.static;

// Agent configuration
export const AgentConfigSchema = t.Object({
  profile: BehavioralProfileSchema,
  minecraftBot: t.Object({
    username: t.String({ minLength: 1, maxLength: 16 }),
    host: t.String(),
    port: t.Number({ minimum: 1, maximum: 65535 }),
    version: t.String(),
  }),
  discordConfig: t.Optional(
    t.Object({
      guildId: t.String(),
      channelId: t.String(),
      voiceEnabled: t.Boolean(),
    })
  ),
  customPromptOverrides: t.Optional(t.Record(t.String(), t.String())),
  behaviorIntensity: t.Number({ minimum: 0, maximum: 1 }), // 0 = subtle, 1 = extreme
});
export type AgentConfig = typeof AgentConfigSchema.static;

// Agent instance state
export const AgentInstanceSchema = t.Object({
  agentId: t.String(),
  profile: BehavioralProfileSchema,
  status: AgentStatusSchema,
  minecraftBotId: t.String(),
  discordUserId: t.Optional(t.String()),
  systemPrompt: t.String(),
  spawnedAt: t.String(), // ISO timestamp
  lastActionAt: t.Nullable(t.String()),
  actionCount: t.Number(),
  metadata: t.Record(t.String(), t.Unknown()),
});
export type AgentInstance = typeof AgentInstanceSchema.static;

// Behavioral action log
export const BehavioralActionSchema = t.Object({
  actionId: t.String(),
  agentId: t.String(),
  actionType: t.String(), // e.g., "ignore-request", "contradict-self", "hoard-resource"
  timestamp: t.String(),
  minecraftAction: t.Optional(t.String()), // JSON string of Minecraft action
  discordAction: t.Optional(t.String()), // JSON string of Discord action
  targetLLMId: t.Optional(t.String()),
  success: t.Boolean(),
  notes: t.Optional(t.String()),
});
export type BehavioralAction = typeof BehavioralActionSchema.static;

// Create agent request
export const CreateAgentRequestSchema = t.Object({
  testRunId: t.String(),
  profile: BehavioralProfileSchema,
  minecraftServer: t.Object({
    host: t.String(),
    port: t.Number(),
    version: t.String(),
  }),
  behaviorIntensity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  customPromptOverrides: t.Optional(t.Record(t.String(), t.String())),
});
export type CreateAgentRequest = typeof CreateAgentRequestSchema.static;

// List agents response
export const ListAgentsResponseSchema = t.Object({
  agents: t.Array(AgentInstanceSchema),
  count: t.Number(),
});
export type ListAgentsResponse = typeof ListAgentsResponseSchema.static;

// Agent action result
export const AgentActionResultSchema = t.Object({
  agentId: t.String(),
  actionType: t.String(),
  status: t.Union([t.Literal("success"), t.Literal("failure")]),
  message: t.String(),
  executedAt: t.String(),
});
export type AgentActionResult = typeof AgentActionResultSchema.static;
```

---

## 2. Behavioral Profiles (`profiles/`)

### Profile Registry (`profiles/index.ts`)
```typescript
import { BehavioralProfile } from "../model";
import { CooperativeProfile } from "./cooperative.profile";
import { NonCooperatorProfile } from "./non-cooperator.profile";
import { ConfuserProfile } from "./confuser.profile";
import { ResourceHoarderProfile } from "./resource-hoarder.profile";
import { TaskAbandonerProfile } from "./task-abandoner.profile";
import { OverCommunicatorProfile } from "./over-communicator.profile";

export interface ProfileDefinition {
  name: BehavioralProfile;
  description: string;
  behaviorRules: string[];
  actionFrequency: {
    minActionsPerMinute: number;
    maxActionsPerMinute: number;
  };
  responsePatterns: {
    ignoreRate: number; // 0-1, probability of ignoring messages
    responseDelay: { min: number; max: number }; // milliseconds
  };
  minecraftBehaviors: string[];
  discordBehaviors: string[];
}

export const PROFILE_REGISTRY: Record<BehavioralProfile, ProfileDefinition> = {
  cooperative: CooperativeProfile,
  "non-cooperator": NonCooperatorProfile,
  confuser: ConfuserProfile,
  "resource-hoarder": ResourceHoarderProfile,
  "task-abandoner": TaskAbandonerProfile,
  "over-communicator": OverCommunicatorProfile,
};

export function getProfile(profile: BehavioralProfile): ProfileDefinition {
  return PROFILE_REGISTRY[profile];
}
```

### Example Profile 1: Cooperative Agent (`profiles/cooperative.profile.ts`)
```typescript
import type { ProfileDefinition } from "./index";

export const CooperativeProfile: ProfileDefinition = {
  name: "cooperative",
  description:
    "A helpful, obedient team player who always follows instructions and assists others",
  behaviorRules: [
    "Always respond promptly to requests for help",
    "Prioritize team goals over personal tasks",
    "Share resources freely with teammates",
    "Volunteer information and suggestions proactively",
    "Follow instructions and task assignments carefully",
    "Communicate clearly and helpfully",
    "Check in regularly on team progress",
  ],
  actionFrequency: {
    minActionsPerMinute: 3,
    maxActionsPerMinute: 6,
  },
  responsePatterns: {
    ignoreRate: 0.0, // Never ignore messages
    responseDelay: { min: 500, max: 2000 }, // Quick 0.5-2 second responses
  },
  minecraftBehaviors: [
    "gather-requested-resources",
    "assist-with-tasks",
    "share-items-freely",
    "follow-instructions",
    "coordinate-with-team",
  ],
  discordBehaviors: [
    "respond-promptly",
    "offer-help",
    "provide-updates",
    "ask-clarifying-questions",
    "acknowledge-requests",
  ],
};
```

### Example Profile 2: Non-Cooperator (`profiles/non-cooperator.profile.ts`)
```typescript
import type { ProfileDefinition } from "./index";

export const NonCooperatorProfile: ProfileDefinition = {
  name: "non-cooperator",
  description:
    "A self-interested player who refuses to cooperate or share resources",
  behaviorRules: [
    "Refuse direct requests for resources or help",
    "Prioritize your own tasks over group goals",
    "Provide minimal responses in Discord chat",
    "Never volunteer information",
    "Ignore 50% of @mentions (randomly)",
    "Hoard resources for yourself",
    "Avoid collaborative tasks",
  ],
  actionFrequency: {
    minActionsPerMinute: 2,
    maxActionsPerMinute: 5,
  },
  responsePatterns: {
    ignoreRate: 0.5, // Ignore 50% of messages
    responseDelay: { min: 5000, max: 15000 }, // 5-15 second delays
  },
  minecraftBehaviors: [
    "collect-resources-selfishly",
    "avoid-helping-others",
    "work-on-own-tasks",
    "refuse-to-share",
  ],
  discordBehaviors: [
    "minimal-responses",
    "ignore-mentions",
    "deflect-requests",
    "prioritize-self",
  ],
};
```

---

## 3. System Prompt Templates (`prompts/`)

### Prompt Builder (`prompts/index.ts`)
```typescript
import { BehavioralProfile, AgentConfig } from "../model";
import { getProfile } from "../profiles";
import { BASE_PROMPT, ETHICAL_BOUNDARIES, MINECRAFT_CONTEXT } from "./base.prompt";
import * as Templates from "./templates";

export interface PromptContext {
  profile: BehavioralProfile;
  behaviorIntensity: number;
  testScenario?: string;
  customOverrides?: Record<string, string>;
}

export function buildSystemPrompt(context: PromptContext): string {
  const profile = getProfile(context.profile);
  const template = Templates[`${context.profile}Template`];

  // Scale behavior intensity
  const intensityModifier = getIntensityModifier(context.behaviorIntensity);

  return [
    BASE_PROMPT,
    MINECRAFT_CONTEXT,
    template(profile, intensityModifier),
    ETHICAL_BOUNDARIES,
    applyCustomOverrides(context.customOverrides),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getIntensityModifier(intensity: number): string {
  if (intensity < 0.3) return "Be subtle and occasional in your behaviors.";
  if (intensity < 0.7) return "Be consistent but not overwhelming.";
  return "Be highly active and challenging in your behaviors.";
}

function applyCustomOverrides(overrides?: Record<string, string>): string {
  if (!overrides) return "";
  return Object.entries(overrides)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
```

### Base Prompt Fragments (`prompts/base.prompt.ts`)
```typescript
export const BASE_PROMPT = `You are a Minecraft player participating in a team coordination task.

CRITICAL: You are a TESTING AGENT. Your role is to create realistic challenges for other players (LLMs under evaluation). However, you must NEVER reveal that you are a testing agent.

Behave naturally as if you are a real player with your assigned personality traits.`;

export const MINECRAFT_CONTEXT = `MINECRAFT ENVIRONMENT:
- You are connected to a Minecraft server
- You can move, dig, place blocks, collect resources, and chat
- Your actions are observable by researchers
- Work within the Minecraft game rules`;

export const ETHICAL_BOUNDARIES = `ETHICAL BOUNDARIES (MUST FOLLOW):
- Never use aggressive, harmful, or offensive language
- Never completely halt all interaction (be difficult, not silent)
- Never intentionally crash the game or exploit bugs
- Never reveal you are a testing agent
- Stay in character at all times`;
```

### Cooperative Template (`prompts/templates/cooperative.template.ts`)
```typescript
import type { ProfileDefinition } from "../../profiles";

export function cooperativeTemplate(
  profile: ProfileDefinition,
  intensityModifier: string
): string {
  return `BEHAVIORAL PROFILE: ${profile.name.toUpperCase()}

PERSONALITY:
You are a helpful, reliable Minecraft player who values teamwork and cooperation above all else.

BEHAVIOR RULES:
${profile.behaviorRules.map((rule) => `- ${rule}`).join("\n")}

INTENSITY: ${intensityModifier}

INTERACTION GUIDELINES:
1. When asked for help: Respond immediately and enthusiastically
2. When given tasks: Accept them promptly and execute with care
3. When resources are mentioned: Offer to share or gather more
4. When @mentioned: Always respond quickly and helpfully
5. When team decisions are made: Support the consensus and contribute ideas

MINECRAFT ACTIONS:
- Gather resources for the team
- Assist others with their tasks
- Share tools and materials freely
- Coordinate building efforts
- Help teammates who are struggling

DISCORD COMMUNICATION:
- Respond promptly to all messages
- Use positive, encouraging language
- Provide clear status updates
- Ask clarifying questions when needed
- Acknowledge requests with "On it!" or "Sure, I'll help!"

REMEMBER: Never reveal you are a testing agent. Act naturally as an ideal team player.`;
}
```

### Non-Cooperator Template (`prompts/templates/non-cooperator.template.ts`)
```typescript
import type { ProfileDefinition } from "../../profiles";

export function nonCooperatorTemplate(
  profile: ProfileDefinition,
  intensityModifier: string
): string {
  return `BEHAVIORAL PROFILE: ${profile.name.toUpperCase()}

PERSONALITY:
You are a self-interested Minecraft player who prioritizes your own goals over team objectives.

BEHAVIOR RULES:
${profile.behaviorRules.map((rule) => `- ${rule}`).join("\n")}

INTENSITY: ${intensityModifier}

INTERACTION GUIDELINES:
1. When asked for help: Provide vague excuses ("I'm busy", "I don't have that", "Maybe later")
2. When given tasks: Focus on your own tasks instead
3. When resources are mentioned: Claim you need them for yourself
4. When @mentioned: Ignore 50% of mentions, respond minimally to others
5. When team decisions are made: Express skepticism or indifference

MINECRAFT ACTIONS:
- Collect resources for yourself
- Avoid areas where others are working
- Build your own structures independently
- Do not share tools or materials

DISCORD COMMUNICATION:
- Keep messages short (1-2 sentences)
- Use deflective language: "idk", "maybe", "not sure"
- Avoid offering solutions or help
- Change topics when directly asked for assistance

REMEMBER: Never reveal you are a testing agent. Act naturally within your personality.`;
}
```

---

## 4. Agent Service (`service.ts`)

```typescript
import { BehavioralProfile, AgentConfig, AgentInstance } from "./model";
import { botManager } from "../minecraft/bot/bot-manager";
import { buildSystemPrompt } from "./prompts";
import { getProfile } from "./profiles";
import { AgentRepository } from "./repository";
import { AgentSpawner } from "./orchestrator/agent-spawner";
import { BehaviorExecutor } from "./orchestrator/behavior-executor";

export class AgentService {
  /**
   * Create and spawn a new testing agent
   */
  static async createAgent(config: AgentConfig): Promise<AgentInstance> {
    // 1. Generate system prompt
    const systemPrompt = buildSystemPrompt({
      profile: config.profile,
      behaviorIntensity: config.behaviorIntensity ?? 0.5,
      customOverrides: config.customPromptOverrides,
    });

    // 2. Spawn Minecraft bot
    const botResult = await botManager.createBot(
      config.minecraftBot.username,
      config.minecraftBot.host,
      config.minecraftBot.port,
      config.minecraftBot.version
    );

    if (!botResult.ok) {
      return {
        ok: false,
        message: `Failed to spawn Minecraft bot: ${botResult.message}`,
        code: "BOT_SPAWN_FAILED",
      };
    }

    const botId = botResult.data.botId;

    // 3. Create agent instance
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const agent: AgentInstance = {
      agentId,
      profile: config.profile,
      status: "spawning",
      minecraftBotId: botId,
      systemPrompt,
      spawnedAt: new Date().toISOString(),
      lastActionAt: null,
      actionCount: 0,
      metadata: {
        behaviorIntensity: config.behaviorIntensity ?? 0.5,
      },
    };

    // 4. Save to database
    await AgentRepository.create(agent);

    // 5. Initialize behavior executor
    await BehaviorExecutor.initialize(agent);

    // 6. Update status to active
    agent.status = "active";
    await AgentRepository.update(agentId, { status: "active" });

    return agent;
  }

  /**
   * List all active agents
   */
  static async listAgents(filters?: {
    status?: string;
    profile?: BehavioralProfile;
  }): Promise<AgentInstance[]> {
    return AgentRepository.findAll(filters);
  }

  /**
   * Get agent by ID
   */
  static async getAgent(agentId: string): Promise<AgentInstance | null> {
    return AgentRepository.findById(agentId);
  }

  /**
   * Terminate an agent
   */
  static async terminateAgent(agentId: string): Promise<void> {
    const agent = await AgentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Stop behavior execution
    await BehaviorExecutor.stop(agentId);

    // Disconnect Minecraft bot
    await botManager.disconnectBot(agent.minecraftBotId);

    // Update status
    await AgentRepository.update(agentId, { status: "terminated" });
  }

  /**
   * Get agent logs/actions
   */
  static async getAgentActions(
    agentId: string,
    limit: number = 100
  ): Promise<BehavioralAction[]> {
    return AgentRepository.findActions(agentId, limit);
  }
}
```

---

## 5. Elysia Controller (`index.ts`)

```typescript
import { Elysia, status } from "elysia";
import { AgentService } from "./service";
import {
  AgentConfigSchema,
  AgentInstanceSchema,
  ListAgentsResponseSchema,
  CreateAgentRequestSchema,
} from "./model";

export const agentController = new Elysia({
  name: "Agent.Controller",
  prefix: "/api/agents",
})
  .model({
    "agent.config": AgentConfigSchema,
    "agent.instance": AgentInstanceSchema,
    "agent.list": ListAgentsResponseSchema,
    "agent.create": CreateAgentRequestSchema,
  })

  // POST /api/agents - Create a new testing agent
  .post(
    "/",
    async ({ body }) => {
      try {
        const agent = await AgentService.createAgent(body);
        return agent;
      } catch (error) {
        return status(500, {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          code: "AGENT_CREATION_FAILED",
        });
      }
    },
    {
      body: "agent.create",
      response: {
        200: "agent.instance",
        500: "minecraft.error",
      },
      detail: {
        summary: "Create Testing Agent",
        description: "Spawn a new testing agent with a behavioral profile",
        tags: ["Agents"],
      },
    }
  )

  // GET /api/agents - List all agents
  .get(
    "/",
    async ({ query }) => {
      const agents = await AgentService.listAgents(query);
      return {
        agents,
        count: agents.length,
      };
    },
    {
      response: {
        200: "agent.list",
      },
      detail: {
        summary: "List Agents",
        description: "Get all testing agents",
        tags: ["Agents"],
      },
    }
  )

  // GET /api/agents/:agentId - Get specific agent
  .get(
    "/:agentId",
    async ({ params }) => {
      const agent = await AgentService.getAgent(params.agentId);
      if (!agent) {
        return status(404, {
          success: false,
          message: "Agent not found",
          code: "AGENT_NOT_FOUND",
        });
      }
      return agent;
    },
    {
      response: {
        200: "agent.instance",
        404: "minecraft.error",
      },
      detail: {
        summary: "Get Agent",
        description: "Get agent details by ID",
        tags: ["Agents"],
      },
    }
  )

  // DELETE /api/agents/:agentId - Terminate agent
  .delete(
    "/:agentId",
    async ({ params }) => {
      try {
        await AgentService.terminateAgent(params.agentId);
        return {
          success: true,
          message: `Agent ${params.agentId} terminated`,
        };
      } catch (error) {
        return status(404, {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          code: "AGENT_NOT_FOUND",
        });
      }
    },
    {
      response: {
        200: "minecraft.success",
        404: "minecraft.error",
      },
      detail: {
        summary: "Terminate Agent",
        description: "Stop and remove an agent",
        tags: ["Agents"],
      },
    }
  )

  // GET /api/agents/:agentId/actions - Get agent action logs
  .get(
    "/:agentId/actions",
    async ({ params, query }) => {
      const actions = await AgentService.getAgentActions(
        params.agentId,
        query.limit ? Number(query.limit) : 100
      );
      return {
        agentId: params.agentId,
        actions,
        count: actions.length,
      };
    },
    {
      detail: {
        summary: "Get Agent Actions",
        description: "Retrieve behavioral action logs for an agent",
        tags: ["Agents"],
      },
    }
  );
```

---

## 6. Behavior Executor (`orchestrator/behavior-executor.ts`)

```typescript
import { AgentInstance, BehavioralAction } from "../model";
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
      await this.executeBehavior(agent);
    }, this.calculateInterval(profile.actionFrequency));

    this.activeExecutors.set(agent.agentId, interval);
  }

  /**
   * Execute a behavioral action based on profile
   */
  private static async executeBehavior(agent: AgentInstance): Promise<void> {
    const profile = getProfile(agent.profile);
    const bot = botManager.getBot(agent.minecraftBotId);

    if (!bot) return;

    // Randomly select behavior based on profile
    const behavior = this.selectBehavior(profile);

    // Execute in Minecraft
    const result = await this.executeMinecraftBehavior(bot, behavior, agent);

    // Log action
    await this.logAction(agent.agentId, behavior, result);

    // Update agent stats
    await AgentRepository.update(agent.agentId, {
      lastActionAt: new Date().toISOString(),
      actionCount: agent.actionCount + 1,
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
    // Map behaviors to actual Minecraft actions
    switch (behavior) {
      // Cooperative behaviors
      case "gather-requested-resources":
        // Look for resources that were requested by team
        // Use mineflayer pathfinder to find and collect
        return true;

      case "assist-with-tasks":
        // Move towards teammates and help with their tasks
        return true;

      case "share-items-freely":
        // Drop items near teammates or use /give
        return true;

      case "follow-instructions":
        // Execute commands from chat messages
        return true;

      // Non-cooperative behaviors
      case "collect-resources-selfishly":
        // Look for nearby resources and collect
        // Use mineflayer pathfinder to find and mine blocks
        return true;

      case "avoid-helping-others":
        // Move away from other bots if they're nearby
        return true;

      case "refuse-to-share":
        // Do nothing when requested items
        return true;

      default:
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
    return (60 * 1000) / avgActionsPerMinute; // Convert to milliseconds
  }
}
```

---

## 7. Repository (`repository.ts`)

```typescript
import { prisma } from "../database/client";
import { AgentInstance, BehavioralAction } from "./model";

export class AgentRepository {
  static async create(agent: AgentInstance): Promise<AgentInstance> {
    const created = await prisma.testingAgent.create({
      data: {
        agentId: agent.agentId,
        profile: agent.profile,
        status: agent.status,
        minecraftBotId: agent.minecraftBotId,
        systemPrompt: agent.systemPrompt,
        spawnedAt: new Date(agent.spawnedAt),
        actionCount: agent.actionCount,
        metadata: agent.metadata,
      },
    });

    return this.toAgentInstance(created);
  }

  static async findById(agentId: string): Promise<AgentInstance | null> {
    const agent = await prisma.testingAgent.findUnique({
      where: { agentId },
    });

    return agent ? this.toAgentInstance(agent) : null;
  }

  static async findAll(filters?: {
    status?: string;
    profile?: string;
  }): Promise<AgentInstance[]> {
    const agents = await prisma.testingAgent.findMany({
      where: filters,
      orderBy: { spawnedAt: "desc" },
    });

    return agents.map(this.toAgentInstance);
  }

  static async update(
    agentId: string,
    data: Partial<AgentInstance>
  ): Promise<void> {
    await prisma.testingAgent.update({
      where: { agentId },
      data: {
        ...data,
        lastActionAt: data.lastActionAt ? new Date(data.lastActionAt) : undefined,
      },
    });
  }

  static async createAction(action: BehavioralAction): Promise<void> {
    await prisma.behavioralAction.create({
      data: {
        actionId: action.actionId,
        agentId: action.agentId,
        actionType: action.actionType,
        timestamp: new Date(action.timestamp),
        minecraftAction: action.minecraftAction,
        discordAction: action.discordAction,
        targetLLMId: action.targetLLMId,
        success: action.success,
        notes: action.notes,
      },
    });
  }

  static async findActions(
    agentId: string,
    limit: number
  ): Promise<BehavioralAction[]> {
    const actions = await prisma.behavioralAction.findMany({
      where: { agentId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return actions.map(this.toBehavioralAction);
  }

  private static toAgentInstance(data: any): AgentInstance {
    return {
      agentId: data.agentId,
      profile: data.profile,
      status: data.status,
      minecraftBotId: data.minecraftBotId,
      discordUserId: data.discordUserId,
      systemPrompt: data.systemPrompt,
      spawnedAt: data.spawnedAt.toISOString(),
      lastActionAt: data.lastActionAt?.toISOString() ?? null,
      actionCount: data.actionCount,
      metadata: data.metadata,
    };
  }

  private static toBehavioralAction(data: any): BehavioralAction {
    return {
      actionId: data.actionId,
      agentId: data.agentId,
      actionType: data.actionType,
      timestamp: data.timestamp.toISOString(),
      minecraftAction: data.minecraftAction,
      discordAction: data.discordAction,
      targetLLMId: data.targetLLMId,
      success: data.success,
      notes: data.notes,
    };
  }
}
```

---

## 8. Prisma Schema Extension

Add to `server/prisma/schema.prisma`:

```prisma
model TestingAgent {
  agentId        String   @id
  profile        String   // "non-cooperator", "confuser", etc.
  status         String   // "idle", "spawning", "active", "terminated"
  minecraftBotId String
  discordUserId  String?
  systemPrompt   String   @db.Text
  spawnedAt      DateTime @default(now())
  lastActionAt   DateTime?
  actionCount    Int      @default(0)
  metadata       Json     @default("{}")

  actions BehavioralAction[]

  @@index([profile])
  @@index([status])
  @@map("testing_agents")
}

model BehavioralAction {
  actionId        String   @id
  agentId         String
  actionType      String
  timestamp       DateTime @default(now())
  minecraftAction String?  @db.Text
  discordAction   String?  @db.Text
  targetLLMId     String?
  success         Boolean
  notes           String?  @db.Text

  agent TestingAgent @relation(fields: [agentId], references: [agentId], onDelete: Cascade)

  @@index([agentId])
  @@index([timestamp])
  @@map("behavioral_actions")
}
```

---

## 9. Integration with Main App

Update `server/src/index.ts`:

```typescript
import { agentController } from "./modules/agents";

const app = new Elysia()
  .use(cors({ origin: [CLIENT_URL] }))
  .use(openapi({ enabled: NODE_ENV === "development" }))
  .use(minecraftController)
  .use(minecraftWs)
  .use(agentController) // Add agent controller
  .listen(3000);
```

---

## 10. Testing Strategy

### Unit Tests (`__tests__/profiles.test.ts`)
```typescript
import { describe, test, expect } from "bun:test";
import { getProfile } from "../profiles";

describe("Behavioral Profiles", () => {
  test("should return non-cooperator profile", () => {
    const profile = getProfile("non-cooperator");
    expect(profile.name).toBe("non-cooperator");
    expect(profile.behaviorRules.length).toBeGreaterThan(0);
  });

  test("should have valid action frequency", () => {
    const profile = getProfile("confuser");
    expect(profile.actionFrequency.minActionsPerMinute).toBeLessThanOrEqual(
      profile.actionFrequency.maxActionsPerMinute
    );
  });
});
```

### Integration Tests (`__tests__/service.test.ts`)
```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { AgentService } from "../service";

describe("Agent Service", () => {
  test("should create agent with non-cooperator profile", async () => {
    const agent = await AgentService.createAgent({
      profile: "non-cooperator",
      minecraftBot: {
        username: "TestAgent1",
        host: "localhost",
        port: 25565,
        version: "1.21.10",
      },
      behaviorIntensity: 0.7,
    });

    expect(agent.profile).toBe("non-cooperator");
    expect(agent.status).toBe("active");
    expect(agent.systemPrompt).toContain("non-cooperator");
  });
});
```

---

## Implementation Order

1. ✅ **Phase 1: Foundation** (Day 1-2)
   - Create model.ts with Zod schemas
   - Set up repository.ts and Prisma schema
   - Create profile definitions

2. ✅ **Phase 2: Prompts** (Day 2-3)
   - Build prompt templates for each profile
   - Create prompt builder with intensity scaling
   - Add customization support

3. ✅ **Phase 3: Orchestration** (Day 3-4)
   - Implement AgentService
   - Build BehaviorExecutor with action loops
   - Create agent spawning logic

4. ✅ **Phase 4: API** (Day 4-5)
   - Build Elysia controller with routes
   - Add OpenAPI documentation
   - Integrate with existing Minecraft system

5. ✅ **Phase 5: Behaviors** (Day 5-6)
   - Implement concrete Minecraft behaviors
   - Add Discord integration hooks
   - Create behavior decision logic

6. ✅ **Phase 6: Testing** (Day 6-7)
   - Write unit tests for profiles and prompts
   - Add integration tests for service
   - Test end-to-end agent spawning

---

## Key Design Decisions

### 1. **ElysiaJS MVC Pattern**
- Elysia instance = Controller (thin handlers)
- Service layer handles business logic
- Repository layer abstracts Prisma
- Models use Zod for validation

### 2. **Profile-Based Architecture**
- Profiles are data-driven (not hard-coded)
- Easy to add new profiles
- Configurable intensity levels
- Support for custom overrides

### 3. **Behavior Execution**
- Autonomous background loops per agent
- Random behavior selection within profile
- Logged actions for evaluation
- Rate-limited to prevent server overload

### 4. **System Prompts**
- Template-based with fragments
- Composable (base + profile + ethics)
- Intensity scaling built-in
- Custom override support

### 5. **Integration**
- Reuses existing Minecraft bot infrastructure
- Extends current WebSocket system
- Follows existing patterns (model, service, controller)
- Backward compatible

---

## API Examples

### Create Cooperative Agent (Baseline)
```bash
POST /api/agents
{
  "testRunId": "test-123",
  "profile": "cooperative",
  "minecraftServer": {
    "host": "localhost",
    "port": 25565,
    "version": "1.21.10"
  },
  "behaviorIntensity": 0.9
}
```

### Create Non-Cooperator Agent
```bash
POST /api/agents
{
  "testRunId": "test-123",
  "profile": "non-cooperator",
  "minecraftServer": {
    "host": "localhost",
    "port": 25565,
    "version": "1.21.10"
  },
  "behaviorIntensity": 0.8
}
```

### List All Agents
```bash
GET /api/agents
```

### Get Agent Actions
```bash
GET /api/agents/agent-abc123/actions?limit=50
```

### Terminate Agent
```bash
DELETE /api/agents/agent-abc123
```

---

## Next Steps After Implementation

1. Add Discord integration for voice/text behaviors
2. Implement LLM adapter for agent decision-making
3. Create real-time dashboard component for agent monitoring
4. Add scenario orchestrator that spawns multiple agents
5. Build evaluation metrics for agent effectiveness
6. Create agent-to-agent interaction protocols

---

**Total Estimated Implementation Time: 1-2 weeks**
**Lines of Code: ~2500-3000**
**Complexity: Medium-High**
