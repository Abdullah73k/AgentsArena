/**
 * Core TypeScript types for the Discord bot module.
 *
 * These types represent domain concepts used across bot management,
 * voice connections, TTS, and WebSocket communication.
 * Elysia route/WS validation models live in model.ts (TypeBox).
 */

// ---------------------------------------------------------------------------
// Bot Lifecycle
// ---------------------------------------------------------------------------

/** Possible states of the Discord bot client. */
export type DiscordBotStatus =
  | "offline"
  | "connecting"
  | "online"
  | "reconnecting"
  | "error";

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

/** Snapshot of a voice channel connection. */
export interface VoiceConnectionState {
  guildId: string;
  channelId: string;
  /** Whether the bot is currently speaking. */
  isSpeaking: boolean;
}

/** Configuration for a TTS speech request. */
export interface TTSRequest {
  /** Text to synthesize. */
  text: string;
  /** ElevenLabs voice ID override (uses default if omitted). */
  voiceId?: string;
  /** Voice stability (0-1). Higher values = more consistent. */
  stability?: number;
  /** Voice similarity boost (0-1). Higher values = more similar to original. */
  similarityBoost?: number;
}

// ---------------------------------------------------------------------------
// Agent Voice Profiles
// ---------------------------------------------------------------------------

/** Maps an agent to a unique ElevenLabs voice. */
export interface AgentVoiceProfile {
  agentId: string;
  /** ElevenLabs voice ID for this agent. */
  voiceId: string;
  /** Human-readable display name. */
  displayName: string;
}

/** Queued speech request for multi-agent coordination. */
export interface SpeechQueueItem {
  agentId: string;
  text: string;
  voiceId: string;
  /** Resolve callback when speech finishes or is cancelled. */
  resolve: (value: SpeechResult) => void;
}

/** Result of a speech request. */
export interface SpeechResult {
  /** Whether speech played successfully. */
  success: boolean;
  /** Approximate duration in milliseconds. */
  durationMs: number;
  /** Error message if speech failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Channel Management
// ---------------------------------------------------------------------------

/** Result of creating test session channels. */
export interface TestSessionChannels {
  textChannelId: string;
  voiceChannelId: string;
  /** Category ID under which channels were created. */
  categoryId: string;
  /** Timestamp-based label for the session. */
  label: string;
}

// ---------------------------------------------------------------------------
// WebSocket Messages
// ---------------------------------------------------------------------------

/** Client-to-server WebSocket message types. */
export type DiscordWsClientMessageType =
  | "subscribe"
  | "unsubscribe"
  | "ping";

/** Server-to-client WebSocket message types. */
export type DiscordWsServerMessageType =
  | "voice-joined"
  | "voice-left"
  | "speaking-started"
  | "speaking-ended"
  | "bot-status-changed"
  | "error"
  | "pong";

/** Client subscribes to Discord events for a guild. */
export interface DiscordWsSubscribeMessage {
  type: "subscribe";
  guildId: string;
}

/** Client unsubscribes from Discord events for a guild. */
export interface DiscordWsUnsubscribeMessage {
  type: "unsubscribe";
  guildId: string;
}

/** Client keepalive ping. */
export interface DiscordWsPingMessage {
  type: "ping";
}

/** Union of all client-to-server messages. */
export type DiscordWsClientMessage =
  | DiscordWsSubscribeMessage
  | DiscordWsUnsubscribeMessage
  | DiscordWsPingMessage;

/** Server pushes a voice channel join event. */
export interface DiscordWsVoiceJoinedMessage {
  type: "voice-joined";
  guildId: string;
  channelId: string;
}

/** Server pushes a voice channel leave event. */
export interface DiscordWsVoiceLeftMessage {
  type: "voice-left";
  guildId: string;
}

/** Server pushes a speaking start event. */
export interface DiscordWsSpeakingStartedMessage {
  type: "speaking-started";
  guildId: string;
  agentId: string;
  text: string;
}

/** Server pushes a speaking end event. */
export interface DiscordWsSpeakingEndedMessage {
  type: "speaking-ended";
  guildId: string;
  agentId: string;
  durationMs: number;
}

/** Server pushes a bot status change. */
export interface DiscordWsBotStatusMessage {
  type: "bot-status-changed";
  status: DiscordBotStatus;
}

/** Server pushes an error. */
export interface DiscordWsErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

/** Server pong response. */
export interface DiscordWsPongMessage {
  type: "pong";
}

/** Union of all server-to-client messages. */
export type DiscordWsServerMessage =
  | DiscordWsVoiceJoinedMessage
  | DiscordWsVoiceLeftMessage
  | DiscordWsSpeakingStartedMessage
  | DiscordWsSpeakingEndedMessage
  | DiscordWsBotStatusMessage
  | DiscordWsErrorMessage
  | DiscordWsPongMessage;

// ---------------------------------------------------------------------------
// Service Result Types
// ---------------------------------------------------------------------------

export interface ServiceSuccess<T> {
  ok: true;
  data: T;
}

export interface ServiceError {
  ok: false;
  message: string;
  code: string;
  /** Suggested HTTP status code. */
  httpStatus: number;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceError;
