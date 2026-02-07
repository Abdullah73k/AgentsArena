/**
 * Multi-agent voice coordination manager.
 *
 * Enables multiple agents to have voice conversations in Discord channels
 * by managing:
 *  - Agent voice profiles (agentId → ElevenLabs voiceId mapping)
 *  - Speech queue (one agent speaks at a time per guild)
 *  - Priority and interruption support
 *
 * The queue ensures agents take turns speaking. Users can join the
 * Discord voice channel and hear the conversation in real time.
 */

import { generateSpeech, isTTSConfigured } from "./tts-handler";
import { resample24kMonoTo48kStereo, playAudio, stopAudio } from "./audio-player";
import { getConnectionState } from "./connection-manager";
import { discordEvents } from "../events/event-broadcaster";
import type {
  AgentVoiceProfile,
  SpeechQueueItem,
  SpeechResult,
} from "../types";

// ---------------------------------------------------------------------------
// Agent registry
// ---------------------------------------------------------------------------

/** Registered agent voice profiles, keyed by agentId. */
const agentProfiles = new Map<string, AgentVoiceProfile>();

/**
 * Register an agent with a unique ElevenLabs voice profile.
 *
 * @param agentId - Unique agent identifier
 * @param voiceId - ElevenLabs voice ID for this agent
 * @param displayName - Human-readable name shown in dashboard events
 */
export function registerAgent(
  agentId: string,
  voiceId: string,
  displayName: string,
): AgentVoiceProfile {
  const profile: AgentVoiceProfile = { agentId, voiceId, displayName };
  agentProfiles.set(agentId, profile);
  console.log(`[AgentVoice] Registered agent "${displayName}" (${agentId}) with voice ${voiceId}`);
  return profile;
}

/**
 * Unregister an agent voice profile.
 *
 * @returns true if the agent was found and removed
 */
export function unregisterAgent(agentId: string): boolean {
  return agentProfiles.delete(agentId);
}

/**
 * Get a registered agent's voice profile.
 */
export function getAgentProfile(agentId: string): AgentVoiceProfile | null {
  return agentProfiles.get(agentId) ?? null;
}

/**
 * Get all registered agent profiles.
 */
export function getAllAgentProfiles(): AgentVoiceProfile[] {
  return Array.from(agentProfiles.values());
}

// ---------------------------------------------------------------------------
// Per-guild speech queues
// ---------------------------------------------------------------------------

/** Speech queue per guild. Items are processed in FIFO order. */
const speechQueues = new Map<string, SpeechQueueItem[]>();

/** Tracks whether a guild is currently processing a speech item. */
const processingFlags = new Map<string, boolean>();

/** Tracks the currently speaking agent per guild (for interruption). */
const currentSpeakers = new Map<string, string>();

/**
 * Queue a speech request for an agent in a guild.
 *
 * The request is added to the guild's speech queue and processed
 * in FIFO order. Returns a Promise that resolves when the speech
 * finishes playing (or is interrupted/cancelled).
 *
 * @param guildId - The guild where the agent should speak
 * @param agentId - The agent's registered ID
 * @param text - The text to speak
 * @returns Speech result with duration and success status
 */
export function speakAsAgent(
  guildId: string,
  agentId: string,
  text: string,
): Promise<SpeechResult> {
  const profile = agentProfiles.get(agentId);
  if (!profile) {
    return Promise.resolve({
      success: false,
      durationMs: 0,
      error: `Agent "${agentId}" is not registered. Call registerAgent first.`,
    });
  }

  const connectionState = getConnectionState(guildId);
  if (!connectionState) {
    return Promise.resolve({
      success: false,
      durationMs: 0,
      error: `No voice connection for guild "${guildId}". Join a voice channel first.`,
    });
  }

  if (!isTTSConfigured()) {
    return Promise.resolve({
      success: false,
      durationMs: 0,
      error: "ElevenLabs API key is not configured.",
    });
  }

  return new Promise<SpeechResult>((resolve) => {
    const item: SpeechQueueItem = {
      agentId,
      text,
      voiceId: profile.voiceId,
      resolve,
    };

    let queue = speechQueues.get(guildId);
    if (!queue) {
      queue = [];
      speechQueues.set(guildId, queue);
    }

    queue.push(item);
    processQueue(guildId);
  });
}

/**
 * Stop the currently speaking agent in a guild and clear the queue.
 *
 * @param guildId - The guild to stop
 * @returns The agent ID that was interrupted, or null if nothing was playing
 */
export function stopAgentSpeaking(guildId: string): string | null {
  const currentAgentId = currentSpeakers.get(guildId) ?? null;

  // Clear the queue
  const queue = speechQueues.get(guildId);
  if (queue) {
    // Resolve all pending items as cancelled
    for (const item of queue) {
      item.resolve({ success: false, durationMs: 0, error: "Cancelled" });
    }
    speechQueues.set(guildId, []);
  }

  // Stop audio playback
  stopAudio(guildId);
  currentSpeakers.delete(guildId);
  processingFlags.set(guildId, false);

  return currentAgentId;
}

/**
 * Get the currently speaking agent in a guild, if any.
 */
export function getCurrentSpeaker(guildId: string): string | null {
  return currentSpeakers.get(guildId) ?? null;
}

/**
 * Get the number of pending speech items in a guild's queue.
 */
export function getQueueLength(guildId: string): number {
  return speechQueues.get(guildId)?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

/**
 * Process the next item in a guild's speech queue.
 * Only one item is processed at a time per guild.
 */
async function processQueue(guildId: string): Promise<void> {
  // Already processing — the current processor will pick up the next item
  if (processingFlags.get(guildId)) return;

  const queue = speechQueues.get(guildId);
  if (!queue || queue.length === 0) return;

  processingFlags.set(guildId, true);

  while (queue.length > 0) {
    const item = queue.shift()!;
    currentSpeakers.set(guildId, item.agentId);

    // Emit speaking-started event
    discordEvents.emitEvent("speaking-started", {
      guildId,
      agentId: item.agentId,
      text: item.text,
    });

    const startTime = Date.now();

    try {
      // Generate TTS with the agent's specific voice
      const pcm24k = await generateSpeech(item.text, {
        voiceId: item.voiceId,
      });

      // Resample for Discord
      const pcm48k = resample24kMonoTo48kStereo(pcm24k);

      // Play audio (blocks until playback completes)
      const durationMs = await playAudio(guildId, pcm48k);

      // Emit speaking-ended event
      discordEvents.emitEvent("speaking-ended", {
        guildId,
        agentId: item.agentId,
        durationMs,
      });

      item.resolve({ success: true, durationMs });
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : "Unknown TTS error";

      // Emit speaking-ended even on failure
      discordEvents.emitEvent("speaking-ended", {
        guildId,
        agentId: item.agentId,
        durationMs: elapsed,
      });

      item.resolve({
        success: false,
        durationMs: elapsed,
        error: errorMessage,
      });
    }

    currentSpeakers.delete(guildId);
  }

  processingFlags.set(guildId, false);
}
