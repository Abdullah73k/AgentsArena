/**
 * BotManager is the central registry for all bot instances.
 *
 * Responsibilities:
 * - Create and connect bots with unique IDs
 * - Track all active bots in a Map<botId, BotInstance>
 * - Enforce max concurrent bot limit
 * - Provide state snapshots for individual or all bots
 * - Disconnect and clean up bots
 * - Forward bot events to registered listeners (for WebSocket broadcasting)
 */

import { EventEmitter } from "events";
import { BotInstance } from "./bot-instance";
import {
  MINECRAFT_HOST,
  MINECRAFT_PORT,
  MINECRAFT_VERSION,
  MAX_CONCURRENT_BOTS,
} from "../../../../constants/minecraft.constants";
import type { BotConfig, BotState, BotStatus } from "../types";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class BotManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BotManagerError";
  }
}

// ---------------------------------------------------------------------------
// BotManager Events
// ---------------------------------------------------------------------------

export interface BotManagerEvents {
  "bot-created": (botId: string) => void;
  "bot-removed": (botId: string) => void;
  "bot-status-change": (botId: string, status: BotStatus) => void;
  "bot-state-update": (state: BotState) => void;
  "bot-chat": (botId: string, username: string, message: string) => void;
  "bot-error": (botId: string, error: Error) => void;
}

// ---------------------------------------------------------------------------
// BotManager Service
// ---------------------------------------------------------------------------

export class BotManager extends EventEmitter {
  private readonly bots: Map<string, BotInstance> = new Map();
  private idCounter = 0;

  // -------------------------------------------------------------------------
  // Bot Creation & Connection
  // -------------------------------------------------------------------------

  /**
   * Create a new bot and connect it to the Minecraft server.
   *
   * @param username - Minecraft username for the bot
   * @param host - Server host (defaults to env MINECRAFT_HOST)
   * @param port - Server port (defaults to env MINECRAFT_PORT)
   * @param version - MC version (defaults to env MINECRAFT_VERSION)
   * @returns The newly created bot's state snapshot
   */
  async createBot(
    username: string,
    host?: string,
    port?: number,
    version?: string,
  ): Promise<BotState> {
    // Enforce concurrency limit
    if (this.bots.size >= MAX_CONCURRENT_BOTS) {
      throw new BotManagerError(
        `Maximum concurrent bot limit (${MAX_CONCURRENT_BOTS}) reached`,
        "MAX_BOTS_REACHED",
      );
    }

    // Prevent duplicate usernames on the same server
    for (const [, existing] of this.bots) {
      if (
        existing.username === username &&
        existing.status !== "disconnected"
      ) {
        throw new BotManagerError(
          `Bot with username "${username}" is already active`,
          "DUPLICATE_USERNAME",
        );
      }
    }

    const botId = this.generateBotId();

    const config: BotConfig = {
      botId,
      username,
      host: host ?? MINECRAFT_HOST,
      port: port ?? MINECRAFT_PORT,
      version: version ?? MINECRAFT_VERSION,
      auth: "offline",
    };

    const instance = new BotInstance(config);

    // Forward events from BotInstance to BotManager listeners
    this.attachInstanceListeners(instance);

    this.bots.set(botId, instance);
    this.emit("bot-created", botId);

    // Connect — may throw if server is unreachable
    try {
      await instance.connect();
    } catch (err) {
      // Keep the instance in the map so callers can inspect error state,
      // but mark it as failed
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("bot-error", botId, error);
      
      // Provide helpful error message for connection refused (Minecraft server not running)
      const isConnectionRefused = error.message.includes("ECONNREFUSED") || 
                                  error.message.includes("connect ECONNREFUSED");
      const helpfulMessage = isConnectionRefused
        ? `Failed to connect bot "${username}" to Minecraft server at ${config.host}:${config.port}. ` +
          `Make sure a Minecraft server is running on this address. ` +
          `You can start a local server or use a test/mock server for development. ` +
          `Error: ${error.message}`
        : `Failed to connect bot "${username}": ${error.message}`;
      
      throw new BotManagerError(helpfulMessage, "CONNECTION_FAILED");
    }

    return instance.getState();
  }

  // -------------------------------------------------------------------------
  // Bot Access
  // -------------------------------------------------------------------------

  /** Get a bot instance by ID. Returns undefined if not found. */
  getBot(botId: string): BotInstance | undefined {
    return this.bots.get(botId);
  }

  /** Get a bot's state snapshot. Returns undefined if not found. */
  getBotState(botId: string): BotState | undefined {
    return this.bots.get(botId)?.getState();
  }

  /** Get state snapshots for all registered bots. */
  getAllBotStates(): BotState[] {
    return Array.from(this.bots.values()).map((b) => b.getState());
  }

  /** Number of currently registered bots (any status). */
  get botCount(): number {
    return this.bots.size;
  }

  /** Check if a bot with the given ID exists. */
  hasBot(botId: string): boolean {
    return this.bots.has(botId);
  }

  // -------------------------------------------------------------------------
  // Bot Disconnection & Cleanup
  // -------------------------------------------------------------------------

  /**
   * Disconnect a single bot and remove it from the registry.
   * No-op if the bot doesn't exist.
   */
  disconnectBot(botId: string): boolean {
    const instance = this.bots.get(botId);
    if (!instance) return false;

    instance.disconnect();
    instance.removeAllListeners();
    this.bots.delete(botId);
    this.emit("bot-removed", botId);
    return true;
  }

  /**
   * Disconnect all bots and clear the registry.
   * Used during server shutdown or test cleanup.
   */
  disconnectAll(): void {
    for (const [botId, instance] of this.bots) {
      instance.disconnect();
      instance.removeAllListeners();
      this.emit("bot-removed", botId);
    }
    this.bots.clear();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private generateBotId(): string {
    this.idCounter += 1;
    return `bot-${this.idCounter}-${Date.now()}`;
  }

  /**
   * Wire up BotInstance events so they bubble up through BotManager.
   * This lets the WebSocket layer subscribe once to BotManager
   * instead of tracking individual BotInstance references.
   */
  private attachInstanceListeners(instance: BotInstance): void {
    instance.on("status-change", (botId: string, status: BotStatus) => {
      this.emit("bot-status-change", botId, status);
    });

    instance.on("state-update", (state: BotState) => {
      this.emit("bot-state-update", state);
    });

    instance.on("chat", (botId: string, username: string, message: string) => {
      this.emit("bot-chat", botId, username, message);
    });

    instance.on("error", (botId: string, error: Error) => {
      this.emit("bot-error", botId, error);
    });
  }
}

/**
 * Singleton BotManager instance shared across the application.
 * Imported by the service layer and WebSocket handler.
 */
export const botManager = new BotManager();
