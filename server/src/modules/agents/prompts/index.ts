/**
 * System Prompt Builder
 *
 * Constructs complete system prompts for testing agents by combining
 * base prompts, profile-specific templates, and ethical boundaries.
 */

import type { BehavioralProfile } from "../model";
import type { ProfileDefinition } from "../profiles/types";
import { getProfile } from "../profiles";
import {
  BASE_PROMPT,
  ETHICAL_BOUNDARIES,
  MINECRAFT_CONTEXT,
  REMEMBER_NOTE,
} from "./base.prompt";
import { cooperativeTemplate } from "./templates/cooperative.template";
import { nonCooperatorTemplate } from "./templates/non-cooperator.template";
import { confuserTemplate } from "./templates/confuser.template";
import { resourceHoarderTemplate } from "./templates/resource-hoarder.template";
import { taskAbandonerTemplate } from "./templates/task-abandoner.template";
import { overCommunicatorTemplate } from "./templates/over-communicator.template";

export interface PromptContext {
  profile: BehavioralProfile;
  behaviorIntensity: number;
  testScenario?: string;
  customOverrides?: Record<string, string>;
}

/**
 * Template function type
 */
type TemplateFunction = (
  profile: ProfileDefinition,
  intensityModifier: string
) => string;

/**
 * Template registry mapping profiles to their template functions
 */
const TEMPLATE_REGISTRY: Record<BehavioralProfile, TemplateFunction> = {
  cooperative: cooperativeTemplate,
  "non-cooperator": nonCooperatorTemplate,
  confuser: confuserTemplate,
  "resource-hoarder": resourceHoarderTemplate,
  "task-abandoner": taskAbandonerTemplate,
  "over-communicator": overCommunicatorTemplate,
};

/**
 * Build a complete system prompt for an agent
 */
export function buildSystemPrompt(context: PromptContext): string {
  const profile = getProfile(context.profile);
  const template = TEMPLATE_REGISTRY[context.profile];

  // Get intensity modifier text
  const intensityModifier = getIntensityModifier(context.behaviorIntensity);

  // Build the complete prompt
  const parts = [
    BASE_PROMPT,
    MINECRAFT_CONTEXT,
    template(profile, intensityModifier),
    REMEMBER_NOTE,
    ETHICAL_BOUNDARIES,
  ];

  // Add custom overrides if provided
  if (context.customOverrides) {
    parts.push(applyCustomOverrides(context.customOverrides));
  }

  // Add test scenario context if provided
  if (context.testScenario) {
    parts.push(`TEST SCENARIO: ${context.testScenario}`);
  }

  return parts.filter(Boolean).join("\n\n");
}

/**
 * Get intensity modifier description based on intensity level
 */
function getIntensityModifier(intensity: number): string {
  if (intensity < 0.3) {
    return "Be subtle and occasional in your behaviors. Show your personality traits only sometimes.";
  }
  if (intensity < 0.7) {
    return "Be consistent but not overwhelming. Display your behavioral traits regularly.";
  }
  return "Be highly active and challenging in your behaviors. Fully embody your personality traits.";
}

/**
 * Apply custom prompt overrides
 */
function applyCustomOverrides(overrides: Record<string, string>): string {
  const lines = ["CUSTOM INSTRUCTIONS:"];
  for (const [key, value] of Object.entries(overrides)) {
    lines.push(`- ${key}: ${value}`);
  }
  return lines.join("\n");
}
