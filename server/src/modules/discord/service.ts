/**
 * DiscordService is the business logic layer between Elysia controllers
 * and the Discord client/voice infrastructure.
 *
 * Following Elysia MVC: abstract class with static methods.
 * Returns discriminated result objects -- the controller maps these
 * to HTTP status codes using Elysia's `status()`.
 */

import { discordClient } from "./client/discord-client";
import {
  joinVoice as joinVoiceChannel,
  leaveVoice as leaveVoiceChannel,
  getAllConnectionStates,
  getConnectionState,
} from "./voice/connection-manager";
import {
  playAudio,
  stopAudio,
  isPlaying,
} from "./voice/audio-player";
import {
  generateSpeech,
  isTTSConfigured,
} from "./voice/tts-handler";

import {
  registerAgent as registerAgentVoice,
  unregisterAgent as unregisterAgentVoice,
  getAgentProfile,
  getAllAgentProfiles,
  speakAsAgent as agentSpeak,
  stopAgentSpeaking as stopAgent,
  getCurrentSpeaker,
  getQueueLength,
} from "./voice/agent-voice-manager";
import {
  createTestSessionChannels,
  getTestSessionChannels,
} from "./client/channel-manager";
import { discordEvents } from "./events/event-broadcaster";
import type {
  AgentVoiceProfile,
  DiscordBotStatus,
  ServiceResult,
  SpeechResult,
  TestSessionChannels,
  VoiceConnectionState,
} from "./types";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface BotStatusData {
  status: DiscordBotStatus;
  guilds: string[];
  voiceConnections: VoiceConnectionState[];
}

interface SpeechData {
  success: boolean;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export abstract class DiscordService {
  /**
   * Start the Discord bot client.
   */
  static async startBot(): Promise<ServiceResult<{ status: string }>> {
    try {
      await discordClient.start();
      discordEvents.emitEvent("bot-status-changed", {
        status: discordClient.getStatus(),
      });
      return {
        ok: true,
        data: { status: discordClient.getStatus() },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to start Discord bot",
        code: "BOT_START_FAILED",
        httpStatus: 500,
      };
    }
  }

  /**
   * Stop the Discord bot client.
   */
  static async stopBot(): Promise<ServiceResult<{ status: string }>> {
    try {
      await discordClient.stop();
      discordEvents.emitEvent("bot-status-changed", { status: "offline" });
      return {
        ok: true,
        data: { status: "offline" },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to stop Discord bot",
        code: "BOT_STOP_FAILED",
        httpStatus: 500,
      };
    }
  }

  /**
   * Get the current bot status, guilds, and voice connections.
   */
  static getBotStatus(): ServiceResult<BotStatusData> {
    return {
      ok: true,
      data: {
        status: discordClient.getStatus(),
        guilds: discordClient.getGuildIds(),
        voiceConnections: getAllConnectionStates(),
      },
    };
  }

  /**
   * Join a voice channel in a guild.
   */
  static async joinVoice(
    guildId: string,
    channelId: string,
  ): Promise<ServiceResult<VoiceConnectionState>> {
    if (!discordClient.isReady()) {
      return {
        ok: false,
        message: "Discord bot is not connected. Start the bot first.",
        code: "BOT_NOT_READY",
        httpStatus: 503,
      };
    }

    try {
      const state = await joinVoiceChannel(guildId, channelId);
      discordEvents.emitEvent("voice-joined", { guildId, channelId });
      return { ok: true, data: state };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to join voice channel",
        code: "VOICE_JOIN_FAILED",
        httpStatus: 500,
      };
    }
  }

  /**
   * Leave the voice channel in a guild.
   */
  static leaveVoice(guildId: string): ServiceResult<{ success: boolean; message: string }> {
    const left = leaveVoiceChannel(guildId);

    if (!left) {
      return {
        ok: false,
        message: `No voice connection found for guild "${guildId}".`,
        code: "NO_VOICE_CONNECTION",
        httpStatus: 404,
      };
    }

    discordEvents.emitEvent("voice-left", { guildId });

    return {
      ok: true,
      data: { success: true, message: `Left voice channel in guild "${guildId}".` },
    };
  }

  /**
   * Generate TTS audio and play it in the guild's voice channel.
   */
  static async speak(
    guildId: string,
    text: string,
    voiceId?: string,
  ): Promise<ServiceResult<SpeechData>> {
    if (!discordClient.isReady()) {
      return {
        ok: false,
        message: "Discord bot is not connected. Start the bot first.",
        code: "BOT_NOT_READY",
        httpStatus: 503,
      };
    }

    const connectionState = getConnectionState(guildId);
    if (!connectionState) {
      return {
        ok: false,
        message: `No voice connection for guild "${guildId}". Join a voice channel first.`,
        code: "NO_VOICE_CONNECTION",
        httpStatus: 404,
      };
    }

    if (!isTTSConfigured()) {
      return {
        ok: false,
        message: "ElevenLabs API key is not configured.",
        code: "TTS_NOT_CONFIGURED",
        httpStatus: 503,
      };
    }

    try {
      // Notify clients that speaking has started
      discordEvents.emitEvent("speaking-started", {
        guildId,
        agentId: "default",
        text,
      });

      // Generate 24kHz mono PCM from ElevenLabs
      const pcm24k = await generateSpeech(text, { voiceId });

      // Play the audio (playAudio handles resampling internally)
      const durationMs = await playAudio(guildId, pcm24k);

      // Notify clients that speaking has ended
      discordEvents.emitEvent("speaking-ended", {
        guildId,
        agentId: "default",
        durationMs,
      });

      return {
        ok: true,
        data: { success: true, durationMs },
      };
    } catch (err) {
      // Ensure speaking-ended is sent even on failure
      discordEvents.emitEvent("speaking-ended", {
        guildId,
        agentId: "default",
        durationMs: 0,
      });

      return {
        ok: false,
        message: err instanceof Error ? err.message : "Speech generation failed",
        code: "SPEECH_FAILED",
        httpStatus: 500,
      };
    }
  }

  /**
   * Stop audio playback in a guild.
   */
  static stopSpeaking(guildId: string): ServiceResult<{ success: boolean; message: string }> {
    const stopped = stopAudio(guildId);

    return {
      ok: true,
      data: {
        success: stopped,
        message: stopped ? "Playback stopped." : "Nothing was playing.",
      },
    };
  }

  /**
   * Check if audio is currently playing in a guild.
   */
  static isSpeaking(guildId: string): boolean {
    return isPlaying(guildId);
  }

  // -------------------------------------------------------------------------
  // Agent Voice Management
  // -------------------------------------------------------------------------

  /**
   * Register an agent with a unique voice profile.
   */
  static registerAgent(
    agentId: string,
    voiceId: string,
    displayName: string,
  ): ServiceResult<AgentVoiceProfile> {
    const profile = registerAgentVoice(agentId, voiceId, displayName);
    return { ok: true, data: profile };
  }

  /**
   * Unregister an agent's voice profile.
   */
  static unregisterAgent(agentId: string): ServiceResult<{ success: boolean; message: string }> {
    const removed = unregisterAgentVoice(agentId);

    if (!removed) {
      return {
        ok: false,
        message: `Agent "${agentId}" is not registered.`,
        code: "AGENT_NOT_FOUND",
        httpStatus: 404,
      };
    }

    return {
      ok: true,
      data: { success: true, message: `Agent "${agentId}" unregistered.` },
    };
  }

  /**
   * Get a specific agent's voice profile.
   */
  static getAgent(agentId: string): ServiceResult<AgentVoiceProfile> {
    const profile = getAgentProfile(agentId);

    if (!profile) {
      return {
        ok: false,
        message: `Agent "${agentId}" is not registered.`,
        code: "AGENT_NOT_FOUND",
        httpStatus: 404,
      };
    }

    return { ok: true, data: profile };
  }

  /**
   * List all registered agent voice profiles.
   */
  static listAgents(): ServiceResult<AgentVoiceProfile[]> {
    return { ok: true, data: getAllAgentProfiles() };
  }

  /**
   * Queue a speech request for a registered agent.
   *
   * The agent speaks using its assigned ElevenLabs voice.
   * Requests are queued per guild and processed in FIFO order.
   */
  static async speakAsAgent(
    guildId: string,
    agentId: string,
    text: string,
  ): Promise<ServiceResult<SpeechResult>> {
    if (!discordClient.isReady()) {
      return {
        ok: false,
        message: "Discord bot is not connected. Start the bot first.",
        code: "BOT_NOT_READY",
        httpStatus: 503,
      };
    }

    const result = await agentSpeak(guildId, agentId, text);

    if (!result.success) {
      return {
        ok: false,
        message: result.error ?? "Agent speech failed",
        code: "AGENT_SPEECH_FAILED",
        httpStatus: 500,
      };
    }

    return { ok: true, data: result };
  }

  /**
   * Stop the currently speaking agent and clear the queue for a guild.
   */
  static stopAgentSpeaking(guildId: string): ServiceResult<{ success: boolean; message: string; agentId: string | null }> {
    const agentId = stopAgent(guildId);

    return {
      ok: true,
      data: {
        success: true,
        message: agentId
          ? `Stopped agent "${agentId}" and cleared queue.`
          : "No agent was speaking. Queue cleared.",
        agentId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Test Session Channel Management
  // -------------------------------------------------------------------------

  /**
   * Create text and voice channels for a test session.
   */
  static async createTestSession(
    guildId: string,
    testId: string,
  ): Promise<ServiceResult<TestSessionChannels>> {
    if (!discordClient.isReady()) {
      return {
        ok: false,
        message: "Discord bot is not connected. Start the bot first.",
        code: "BOT_NOT_READY",
        httpStatus: 503,
      };
    }

    try {
      const channels = await createTestSessionChannels(guildId, testId);
      return { ok: true, data: channels };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to create test channels",
        code: "CHANNEL_CREATE_FAILED",
        httpStatus: 500,
      };
    }
  }

  /**
   * List test session channels in a guild.
   */
  static listTestChannels(
    guildId: string,
  ): ServiceResult<{ textChannels: string[]; voiceChannels: string[] }> {
    if (!discordClient.isReady()) {
      return {
        ok: false,
        message: "Discord bot is not connected. Start the bot first.",
        code: "BOT_NOT_READY",
        httpStatus: 503,
      };
    }

    const channels = getTestSessionChannels(guildId);
    return { ok: true, data: channels };
  }
}
