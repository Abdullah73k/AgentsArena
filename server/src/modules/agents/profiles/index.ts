/**
 * Profile Registry
 *
 * Central registry for all behavioral profiles.
 * Provides lookup and validation for agent profiles.
 */

import type { BehavioralProfile } from "../model";
import type { ProfileDefinition } from "./types";
import { CooperativeProfile } from "./cooperative.profile";
import { NonCooperatorProfile } from "./non-cooperator.profile";
import { ConfuserProfile } from "./confuser.profile";
import { ResourceHoarderProfile } from "./resource-hoarder.profile";
import { TaskAbandonerProfile } from "./task-abandoner.profile";
import { OverCommunicatorProfile } from "./over-communicator.profile";

export const PROFILE_REGISTRY: Record<BehavioralProfile, ProfileDefinition> = {
  cooperative: CooperativeProfile,
  "non-cooperator": NonCooperatorProfile,
  confuser: ConfuserProfile,
  "resource-hoarder": ResourceHoarderProfile,
  "task-abandoner": TaskAbandonerProfile,
  "over-communicator": OverCommunicatorProfile,
};

/**
 * Get a profile definition by name
 */
export function getProfile(profile: BehavioralProfile): ProfileDefinition {
  return PROFILE_REGISTRY[profile];
}

/**
 * Get all available profiles
 */
export function getAllProfiles(): ProfileDefinition[] {
  return Object.values(PROFILE_REGISTRY);
}

/**
 * Check if a profile exists
 */
export function profileExists(profile: string): profile is BehavioralProfile {
  return profile in PROFILE_REGISTRY;
}
