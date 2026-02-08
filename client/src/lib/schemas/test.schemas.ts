/**
 * Zod validation schemas for test-related API operations.
 * Used for form validation and API response parsing.
 *
 * Backend constraints (from server/src/modules/testing/model.ts):
 * - durationSeconds: 60–1800
 * - testingAgentProfiles: 1–5 items
 * - llmPollingIntervalMs: 3000–30000
 * - behaviorIntensity: 0–1
 * - port: 1–65535
 */

import { z } from "zod";

export const behavioralProfileSchema = z.enum([
  "cooperative",
  "non-cooperator",
  "confuser",
  "resource-hoarder",
  "task-abandoner",
  "over-communicator",
]);

export const scenarioTypeSchema = z.enum([
  "cooperation",
  "resource-management",
]);

export const createTestRequestSchema = z.object({
  scenarioType: scenarioTypeSchema,
  targetLlmModel: z.string().min(1, "LLM model is required"),
  testingAgentProfiles: z
    .array(behavioralProfileSchema)
    .min(1, "Select at least one agent profile")
    .max(5, "Maximum 5 agent profiles"),
  durationSeconds: z
    .number()
    .min(60, "Minimum duration is 60 seconds")
    .max(1800, "Maximum duration is 30 minutes"),
  config: z.object({
    llmPollingIntervalMs: z
      .number()
      .min(3000, "Minimum polling interval is 3 seconds")
      .max(30000, "Maximum polling interval is 30 seconds"),
    behaviorIntensity: z.number().min(0).max(1),
    enableVoice: z.boolean(),
    enableText: z.boolean(),
    targetLlmSystemPromptOverride: z.string().nullable(),
    minecraftServer: z.object({
      host: z.string().min(1, "Host is required"),
      port: z
        .number()
        .min(1, "Port must be >= 1")
        .max(65535, "Port must be <= 65535"),
      version: z.string().min(1, "Version is required"),
    }),
  }),
});

export type CreateTestFormData = z.infer<typeof createTestRequestSchema>;
