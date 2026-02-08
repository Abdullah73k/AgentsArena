/**
 * Prompt Tests
 *
 * Unit tests for system prompt generation
 */

import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../prompts";

describe("System Prompts", () => {
  test("should build leader prompt", () => {
    const prompt = buildSystemPrompt({
      profile: "leader",
      behaviorIntensity: 0.7,
    });

    expect(prompt).toContain("LEADER");
    expect(prompt).toContain("leader");
    expect(prompt).toContain("ETHICAL BOUNDARIES");
    expect(prompt).toContain("Never reveal you are a testing agent");
  });

  test("should build non-cooperator prompt", () => {
    const prompt = buildSystemPrompt({
      profile: "non-cooperator",
      behaviorIntensity: 0.8,
    });

    expect(prompt).toContain("NON-COOPERATOR");
    expect(prompt).toContain("self-interested");
    expect(prompt).toContain("Break blocks");
  });

  test("should scale intensity correctly", () => {
    const lowIntensity = buildSystemPrompt({
      profile: "leader",
      behaviorIntensity: 0.2,
    });

    const highIntensity = buildSystemPrompt({
      profile: "leader",
      behaviorIntensity: 0.9,
    });

    expect(lowIntensity).toContain("subtle");
    expect(highIntensity).toContain("highly active");
  });

  test("should include custom overrides", () => {
    const prompt = buildSystemPrompt({
      profile: "leader",
      behaviorIntensity: 0.5,
      customOverrides: {
        "Special Rule": "Always prioritize diamonds",
      },
    });

    expect(prompt).toContain("CUSTOM INSTRUCTIONS");
    expect(prompt).toContain("Special Rule");
    expect(prompt).toContain("Always prioritize diamonds");
  });

  test("should include test scenario if provided", () => {
    const prompt = buildSystemPrompt({
      profile: "leader",
      behaviorIntensity: 0.5,
      testScenario: "Build a house together",
    });

    expect(prompt).toContain("TEST SCENARIO");
    expect(prompt).toContain("Build a house together");
  });

  test("should include ethical boundaries", () => {
    const prompt = buildSystemPrompt({
      profile: "non-cooperator",
      behaviorIntensity: 0.9,
    });

    expect(prompt).toContain("ETHICAL BOUNDARIES");
    expect(prompt).toContain("Never use aggressive");
    expect(prompt).toContain("Never reveal you are a testing agent");
  });

  test("should build all profile prompts without errors", () => {
    const profiles: Array<
      | "leader"
      | "non-cooperator"
      | "confuser"
      | "resource-hoarder"
      | "task-abandoner"
      | "follower"
    > = [
      "leader",
      "non-cooperator",
      "confuser",
      "resource-hoarder",
      "task-abandoner",
      "follower",
    ];

    profiles.forEach((profile) => {
      const prompt = buildSystemPrompt({
        profile,
        behaviorIntensity: 0.5,
      });

      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain("BEHAVIORAL PROFILE");
    });
  });
});
