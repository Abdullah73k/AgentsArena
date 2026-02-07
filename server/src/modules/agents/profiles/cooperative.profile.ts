/**
 * Cooperative Agent Profile
 *
 * A helpful, obedient team player who always follows instructions.
 * Serves as the baseline/control agent for testing.
 */

import type { ProfileDefinition } from "./types";

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
