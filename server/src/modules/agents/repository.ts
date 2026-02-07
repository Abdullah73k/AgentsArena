/**
 * Agent Repository
 *
 * Data access layer for testing agents using Prisma.
 * Handles CRUD operations and provides clean abstractions over database operations.
 */

import type { AgentInstance, BehavioralAction } from "./model";

/**
 * In-memory storage (temporary until Prisma is set up)
 * TODO: Replace with actual Prisma client once schema is migrated
 */
const agentsStore = new Map<string, AgentInstance>();
const actionsStore = new Map<string, BehavioralAction[]>();

export class AgentRepository {
  /**
   * Create a new agent instance
   */
  static async create(agent: AgentInstance): Promise<AgentInstance> {
    agentsStore.set(agent.agentId, agent);
    actionsStore.set(agent.agentId, []);
    return agent;
  }

  /**
   * Find agent by ID
   */
  static async findById(agentId: string): Promise<AgentInstance | null> {
    return agentsStore.get(agentId) ?? null;
  }

  /**
   * Find all agents with optional filters
   */
  static async findAll(filters?: {
    status?: string;
    profile?: string;
  }): Promise<AgentInstance[]> {
    let agents = Array.from(agentsStore.values());

    if (filters?.status) {
      agents = agents.filter((a) => a.status === filters.status);
    }

    if (filters?.profile) {
      agents = agents.filter((a) => a.profile === filters.profile);
    }

    return agents.sort(
      (a, b) =>
        new Date(b.spawnedAt).getTime() - new Date(a.spawnedAt).getTime()
    );
  }

  /**
   * Update agent data
   */
  static async update(
    agentId: string,
    data: Partial<AgentInstance>
  ): Promise<void> {
    const agent = agentsStore.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const updated = { ...agent, ...data };
    agentsStore.set(agentId, updated);
  }

  /**
   * Delete agent
   */
  static async delete(agentId: string): Promise<void> {
    agentsStore.delete(agentId);
    actionsStore.delete(agentId);
  }

  /**
   * Create a behavioral action log
   */
  static async createAction(action: BehavioralAction): Promise<void> {
    const actions = actionsStore.get(action.agentId) ?? [];
    actions.push(action);
    actionsStore.set(action.agentId, actions);
  }

  /**
   * Find actions for an agent
   */
  static async findActions(
    agentId: string,
    limit: number = 100
  ): Promise<BehavioralAction[]> {
    const actions = actionsStore.get(agentId) ?? [];
    return actions
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Count total agents
   */
  static async count(filters?: {
    status?: string;
    profile?: string;
  }): Promise<number> {
    const agents = await this.findAll(filters);
    return agents.length;
  }

  /**
   * Check if agent exists
   */
  static async exists(agentId: string): Promise<boolean> {
    return agentsStore.has(agentId);
  }
}
