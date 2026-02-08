/**
 * Agent Service
 *
 * Business logic layer for testing agent operations.
 * Orchestrates agent creation, lifecycle management, and queries.
 * Following ElysiaJS MVC pattern: Service handles logic, returns status objects.
 */

import type {
  AgentConfig,
  AgentInstance,
  BehavioralAction,
  BehavioralProfile,
  CreateAgentRequest,
} from "./model";
import { AgentRepository } from "./repository";
import { AgentSpawner } from "./orchestrator/agent-spawner";
import { LifecycleManager } from "./orchestrator/lifecycle-manager";

export class AgentService {
  /**
   * Create and spawn a new testing agent
   */
  static async createAgent(
    request: CreateAgentRequest
  ): Promise<{
    ok: boolean;
    data?: AgentInstance;
    message?: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      // Build agent configuration
      // Use a unique suffix to prevent DUPLICATE_USERNAME errors when
      // multiple agents share the same behavioral profile.
      const uniqueSuffix = Date.now().toString(36).slice(-4) +
        Math.random().toString(36).slice(2, 5);
      const config: AgentConfig = {
        profile: request.profile,
        minecraftBot: {
          username: `${request.profile.slice(0, 8)}_${uniqueSuffix}`,
          host: request.minecraftServer.host,
          port: request.minecraftServer.port,
          version: request.minecraftServer.version,
        },
        behaviorIntensity: request.behaviorIntensity ?? 0.5,
        customPromptOverrides: request.customPromptOverrides,
      };

      // Validate configuration
      const validation = AgentSpawner.validateConfig(config);
      if (!validation.valid) {
        return {
          ok: false,
          message: `Invalid configuration: ${validation.errors.join(", ")}`,
          code: "INVALID_CONFIG",
          httpStatus: 400,
        };
      }

      // Spawn the agent
      const spawnResult = await AgentSpawner.spawn(config);
      if (!spawnResult.ok || !spawnResult.data) {
        return {
          ok: false,
          message: spawnResult.message ?? "Failed to spawn agent",
          code: spawnResult.code ?? "SPAWN_FAILED",
          httpStatus: 502,
        };
      }

      const agent = spawnResult.data;

      // Save to repository
      await AgentRepository.create(agent);

      // Initialize behavior executor
      await AgentSpawner.initializeBehavior(agent);

      console.log(
        `[AgentService] Successfully created agent ${agent.agentId} with profile ${agent.profile}`
      );

      return {
        ok: true,
        data: agent,
      };
    } catch (error) {
      console.error("[AgentService] Error creating agent:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "CREATION_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * List all agents with optional filters
   */
  static async listAgents(filters?: {
    status?: string;
    profile?: BehavioralProfile;
  }): Promise<{
    ok: boolean;
    data?: { agents: AgentInstance[]; count: number };
    message?: string;
  }> {
    try {
      const agents = await AgentRepository.findAll(filters);

      return {
        ok: true,
        data: {
          agents,
          count: agents.length,
        },
      };
    } catch (error) {
      console.error("[AgentService] Error listing agents:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get agent by ID
   */
  static async getAgent(
    agentId: string
  ): Promise<{
    ok: boolean;
    data?: AgentInstance;
    message?: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      return {
        ok: true,
        data: agent,
      };
    } catch (error) {
      console.error(`[AgentService] Error getting agent ${agentId}:`, error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "GET_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Terminate an agent
   */
  static async terminateAgent(
    agentId: string
  ): Promise<{
    ok: boolean;
    message: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      // Transition to terminated status (handles cleanup)
      await LifecycleManager.transitionStatus(agentId, "terminated");

      return {
        ok: true,
        message: `Agent ${agentId} terminated successfully`,
      };
    } catch (error) {
      console.error(`[AgentService] Error terminating agent ${agentId}:`, error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "TERMINATION_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Pause an agent
   */
  static async pauseAgent(
    agentId: string
  ): Promise<{
    ok: boolean;
    message: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      await LifecycleManager.transitionStatus(agentId, "paused");

      return {
        ok: true,
        message: `Agent ${agentId} paused successfully`,
      };
    } catch (error) {
      console.error(`[AgentService] Error pausing agent ${agentId}:`, error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "PAUSE_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Resume an agent
   */
  static async resumeAgent(
    agentId: string
  ): Promise<{
    ok: boolean;
    message: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      await LifecycleManager.transitionStatus(agentId, "active");

      return {
        ok: true,
        message: `Agent ${agentId} resumed successfully`,
      };
    } catch (error) {
      console.error(`[AgentService] Error resuming agent ${agentId}:`, error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "RESUME_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Get agent action logs
   */
  static async getAgentActions(
    agentId: string,
    limit: number = 100
  ): Promise<{
    ok: boolean;
    data?: { agentId: string; actions: BehavioralAction[]; count: number };
    message?: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      const actions = await AgentRepository.findActions(agentId, limit);

      return {
        ok: true,
        data: {
          agentId,
          actions,
          count: actions.length,
        },
      };
    } catch (error) {
      console.error(
        `[AgentService] Error getting actions for agent ${agentId}:`,
        error
      );
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "GET_ACTIONS_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Get agent health status
   */
  static async getAgentHealth(
    agentId: string
  ): Promise<{
    ok: boolean;
    data?: { healthy: boolean; issues: string[] };
    message?: string;
    code?: string;
    httpStatus?: number;
  }> {
    try {
      const agent = await AgentRepository.findById(agentId);

      if (!agent) {
        return {
          ok: false,
          message: `Agent ${agentId} not found`,
          code: "AGENT_NOT_FOUND",
          httpStatus: 404,
        };
      }

      const health = await LifecycleManager.getHealthStatus(agentId);

      return {
        ok: true,
        data: health,
      };
    } catch (error) {
      console.error(
        `[AgentService] Error getting health for agent ${agentId}:`,
        error
      );
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "HEALTH_CHECK_ERROR",
        httpStatus: 500,
      };
    }
  }

  /**
   * Terminate all agents
   */
  static async terminateAll(): Promise<{
    ok: boolean;
    message: string;
  }> {
    try {
      await LifecycleManager.cleanupAll();

      return {
        ok: true,
        message: "All agents terminated successfully",
      };
    } catch (error) {
      console.error("[AgentService] Error terminating all agents:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
