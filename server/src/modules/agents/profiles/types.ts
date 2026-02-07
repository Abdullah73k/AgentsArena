/**
 * Profile Definition Interface
 *
 * Defines the structure of a behavioral profile for testing agents.
 * Each profile specifies behavior rules, action patterns, and communication styles.
 */

import type { BehavioralProfile } from "../model";

export interface ProfileDefinition {
  name: BehavioralProfile;
  description: string;
  behaviorRules: string[];
  actionFrequency: {
    minActionsPerMinute: number;
    maxActionsPerMinute: number;
  };
  responsePatterns: {
    ignoreRate: number; // 0-1, probability of ignoring messages
    responseDelay: { min: number; max: number }; // milliseconds
  };
  minecraftBehaviors: string[];
  discordBehaviors: string[];
}
