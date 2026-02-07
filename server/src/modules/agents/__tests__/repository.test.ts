/**
 * Repository Tests
 *
 * Unit tests for AgentRepository
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { AgentRepository } from "../repository";
import type { AgentInstance, BehavioralAction } from "../model";

describe("Agent Repository", () => {
  const mockAgent: AgentInstance = {
    agentId: "test-agent-1",
    profile: "cooperative",
    status: "active",
    minecraftBotId: "bot-1",
    systemPrompt: "Test prompt",
    spawnedAt: new Date().toISOString(),
    lastActionAt: null,
    actionCount: 0,
    metadata: {},
  };

  beforeEach(async () => {
    // Clean up any existing test data
    const existing = await AgentRepository.findById("test-agent-1");
    if (existing) {
      await AgentRepository.delete("test-agent-1");
    }
  });

  test("should create agent", async () => {
    const created = await AgentRepository.create(mockAgent);
    expect(created.agentId).toBe("test-agent-1");
    expect(created.profile).toBe("cooperative");
  });

  test("should find agent by ID", async () => {
    await AgentRepository.create(mockAgent);
    const found = await AgentRepository.findById("test-agent-1");
    expect(found).not.toBeNull();
    expect(found?.agentId).toBe("test-agent-1");
  });

  test("should return null for non-existent agent", async () => {
    const found = await AgentRepository.findById("non-existent");
    expect(found).toBeNull();
  });

  test("should update agent", async () => {
    await AgentRepository.create(mockAgent);
    await AgentRepository.update("test-agent-1", {
      status: "paused",
      actionCount: 5,
    });

    const updated = await AgentRepository.findById("test-agent-1");
    expect(updated?.status).toBe("paused");
    expect(updated?.actionCount).toBe(5);
  });

  test("should find all agents", async () => {
    await AgentRepository.create(mockAgent);
    const agents = await AgentRepository.findAll();
    expect(agents.length).toBeGreaterThan(0);
  });

  test("should filter agents by status", async () => {
    await AgentRepository.create(mockAgent);
    await AgentRepository.create({
      ...mockAgent,
      agentId: "test-agent-2",
      status: "terminated",
    });

    const active = await AgentRepository.findAll({ status: "active" });
    const terminated = await AgentRepository.findAll({ status: "terminated" });

    expect(active.length).toBeGreaterThan(0);
    expect(terminated.length).toBeGreaterThan(0);
  });

  test("should create action log", async () => {
    await AgentRepository.create(mockAgent);

    const action: BehavioralAction = {
      actionId: "action-1",
      agentId: "test-agent-1",
      actionType: "gather-resources",
      timestamp: new Date().toISOString(),
      success: true,
    };

    await AgentRepository.createAction(action);
    const actions = await AgentRepository.findActions("test-agent-1");

    expect(actions.length).toBe(1);
    expect(actions[0].actionType).toBe("gather-resources");
  });

  test("should limit returned actions", async () => {
    await AgentRepository.create(mockAgent);

    // Create 10 actions
    for (let i = 0; i < 10; i++) {
      await AgentRepository.createAction({
        actionId: `action-${i}`,
        agentId: "test-agent-1",
        actionType: "test-action",
        timestamp: new Date().toISOString(),
        success: true,
      });
    }

    const actions = await AgentRepository.findActions("test-agent-1", 5);
    expect(actions.length).toBe(5);
  });

  test("should check if agent exists", async () => {
    await AgentRepository.create(mockAgent);
    expect(await AgentRepository.exists("test-agent-1")).toBe(true);
    expect(await AgentRepository.exists("non-existent")).toBe(false);
  });

  test("should count agents", async () => {
    await AgentRepository.create(mockAgent);
    const count = await AgentRepository.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should delete agent", async () => {
    await AgentRepository.create(mockAgent);
    await AgentRepository.delete("test-agent-1");
    const found = await AgentRepository.findById("test-agent-1");
    expect(found).toBeNull();
  });
});
