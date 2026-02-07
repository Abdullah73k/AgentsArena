/**
 * Prompt Tests
 *
 * Unit tests for system prompt generation
 */

import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../prompts";

describe("System Prompts", () => {
  test("should build cooperative prompt", () => {
    const prompt = buildSystemPrompt({
      profile: "cooperative",
      behaviorIntensity: 0.7,
    });

    expect(prompt).toContain("COOPERATIVE");
    expect(prompt).toContain("helpful");
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
    expect(prompt).toContain("Refuse direct requests");
  });

  test("should scale intensity correctly", () => {
    const lowIntensity = buildSystemPrompt({
      profile: "cooperative",
      behaviorIntensity: 0.2,
    });

    const highIntensity = buildSystemPrompt({
      profile: "cooperative",
      behaviorIntensity: 0.9,
    });

    expect(lowIntensity).toContain("subtle");
    expect(highIntensity).toContain("highly active");
  });

  test("should include custom overrides", () => {
    const prompt = buildSystemPrompt({
      profile: "cooperative",
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
      profile: "cooperative",
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
      | "cooperative"
      | "non-cooperator"
      | "confuser"
      | "resource-hoarder"
      | "task-abandoner"
      | "over-communicator"
    > = [
      "cooperative",
      "non-cooperator",
      "confuser",
      "resource-hoarder",
      "task-abandoner",
      "over-communicator",
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
