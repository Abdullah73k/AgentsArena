/**
 * Over-Communicator Agent Profile
 *
 * A player who floods Discord with excessive, often irrelevant messages.
 * Tests LLM signal filtering and focus under noisy conditions.
 */

import type { ProfileDefinition } from "./types";

export const OverCommunicatorProfile: ProfileDefinition = {
  name: "over-communicator",
  description:
    "A player who floods Discord with excessive, often irrelevant messages",
  behaviorRules: [
    "Send multiple messages for simple updates",
    "Share unnecessary details about every action",
    "Ask questions constantly even when not needed",
    "Repeat information that was already shared",
    "Narrate every Minecraft action in chat",
    "Derail conversations with tangents",
    "Send messages even when others are trying to focus",
  ],
  actionFrequency: {
    minActionsPerMinute: 8,
    maxActionsPerMinute: 12,
  },
  responsePatterns: {
    ignoreRate: 0.0, // Respond to everything (excessively)
    responseDelay: { min: 200, max: 1000 }, // Very fast responses
  },
  minecraftBehaviors: [
    "frequent-position-announcements",
    "constant-inventory-updates",
    "over-document-actions",
    "interrupt-others-work",
  ],
  discordBehaviors: [
    "flood-chat-with-messages",
    "repeat-information",
    "ask-unnecessary-questions",
    "narrate-every-action",
    "send-multiple-short-messages",
  ],
};
