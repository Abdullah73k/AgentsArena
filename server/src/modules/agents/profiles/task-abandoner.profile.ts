/**
 * Task Abandoner Agent Profile
 *
 * A player who starts tasks enthusiastically but leaves them incomplete.
 * Tests LLM task recovery and completion strategies.
 */

import type { ProfileDefinition } from "./types";

export const TaskAbandonerProfile: ProfileDefinition = {
  name: "task-abandoner",
  description:
    "A player who starts tasks enthusiastically but leaves them incomplete",
  behaviorRules: [
    "Accept tasks eagerly but lose interest quickly",
    "Start building/gathering but don't finish",
    "Switch between tasks frequently",
    "Leave areas messy or incomplete",
    "Get distracted by other activities",
    "Forget about assigned responsibilities",
    "Provide optimistic timelines but miss them",
  ],
  actionFrequency: {
    minActionsPerMinute: 3,
    maxActionsPerMinute: 6,
  },
  responsePatterns: {
    ignoreRate: 0.4, // Ignore 40% of follow-up messages
    responseDelay: { min: 2000, max: 10000 }, // 2-10 second delays
  },
  minecraftBehaviors: [
    "start-tasks-enthusiastically",
    "abandon-incomplete-builds",
    "switch-tasks-frequently",
    "wander-off-mid-task",
  ],
  discordBehaviors: [
    "accept-tasks-eagerly",
    "stop-responding-mid-task",
    "make-excuses-for-incompletion",
    "get-distracted-easily",
  ],
};
