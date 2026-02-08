/**
 * BotInstance wraps a single mineflayer bot with lifecycle management,
 * typed state snapshots, and an event emitter for real-time updates.
 *
 * Responsibilities:
 * - Connect/disconnect to Minecraft server
 * - Track connection status transitions
 * - Provide current state snapshots (position, health, inventory)
 * - Emit events for state changes, chat, damage, death, etc.
 */

import mineflayer, { type Bot as MineflayerBot } from "mineflayer";
import { EventEmitter } from "events";
import type {
  BotConfig,
  BotState,
  BotStatus,
  InventorySlot,
  Vec3,
  Orientation,
} from "../types";

// ---------------------------------------------------------------------------
// Event types emitted by BotInstance
// ---------------------------------------------------------------------------

export interface BotInstanceEvents {
  "status-change": (botId: string, status: BotStatus) => void;
  "state-update": (state: BotState) => void;
  "chat": (botId: string, username: string, message: string) => void;
  "damage": (botId: string) => void;
  "death": (botId: string) => void;
  "spawn": (botId: string) => void;
  "kicked": (botId: string, reason: string) => void;
  "error": (botId: string, error: Error) => void;
}

// ---------------------------------------------------------------------------
// BotInstance
// ---------------------------------------------------------------------------

export class BotInstance extends EventEmitter {
  private bot: MineflayerBot | null = null;
  private _status: BotStatus = "disconnected";
  private _lastUpdatedAt: string = new Date().toISOString();

  public readonly config: BotConfig;

  constructor(config: BotConfig) {
    super();
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get botId(): string {
    return this.config.botId;
  }

  get username(): string {
    return this.config.username;
  }

  get status(): BotStatus {
    return this._status;
  }

  /** Direct access to the underlying mineflayer bot (for action handlers). */
  get mineflayerBot(): MineflayerBot | null {
    return this.bot;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Connect the bot to the Minecraft server.
   * Resolves when the bot has spawned, rejects on connection error.
   */
  connect(): Promise<void> {
    const CONNECTION_TIMEOUT_MS = 30_000; // 30 seconds max to connect

    return new Promise((resolve, reject) => {
      if (this.bot) {
        reject(new Error(`Bot ${this.botId} is already connected`));
        return;
      }

      this.setStatus("connecting");
      let settled = false;

      const succeed = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      };

      // Timeout guard — prevents indefinite hang
      const timer = setTimeout(() => {
        fail(
          new Error(
            `Connection timeout after ${CONNECTION_TIMEOUT_MS / 1000}s ` +
            `for bot "${this.config.username}" → ${this.config.host}:${this.config.port}`,
          ),
        );
        this.setStatus("error");
        // Try to clean up the dangling bot
        try { this.bot?.quit(); } catch { /* ignore */ }
        this.bot = null;
      }, CONNECTION_TIMEOUT_MS);

      console.log(
        `[BotInstance] Connecting "${this.config.username}" → ` +
        `${this.config.host}:${this.config.port} ` +
        `(version: ${this.config.version ?? "auto-detect"})`,
      );

      try {
        // Build options — only include version if explicitly set,
        // otherwise let mineflayer auto-detect the server version.
        const botOptions: Parameters<typeof mineflayer.createBot>[0] = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          auth: this.config.auth,
          hideErrors: false,
        };
        if (this.config.version && this.config.version.length > 0) {
          botOptions.version = this.config.version;
        }
        this.bot = mineflayer.createBot(botOptions);
      } catch (err) {
        this.setStatus("error");
        const error = err instanceof Error ? err : new Error(String(err));
        fail(error);
        return;
      }

      // Spawn = fully connected and in-world
      this.bot.once("spawn", () => {
        this.setStatus("spawned");
        this.emit("spawn", this.botId);
        this.registerEventListeners();
        console.log(`[BotInstance] "${this.config.username}" spawned successfully`);
        succeed();
      });

      // Login = TCP connection established, not yet in-world
      this.bot.once("login", () => {
        this.setStatus("connected");
        console.log(`[BotInstance] "${this.config.username}" logged in, waiting for spawn...`);
      });

      // Connection-phase errors
      this.bot.once("error", (err: Error) => {
        this.setStatus("error");
        this.emit("error", this.botId, err);
        console.error(`[BotInstance] "${this.config.username}" error: ${err.message}`);
        fail(err);
      });

      this.bot.once("end", (reason: string) => {
        this.setStatus("disconnected");
        this.emit("kicked", this.botId, reason ?? "unknown");
        console.warn(`[BotInstance] "${this.config.username}" connection ended: ${reason ?? "unknown"}`);
        fail(new Error(`Bot connection ended before spawn: ${reason ?? "unknown"}`));
      });
    });
  }

  /**
   * Gracefully disconnect the bot from the server.
   */
  disconnect(): void {
    if (this.bot) {
      // Remove listeners before quitting to avoid spurious error events
      this.bot.removeAllListeners();
      this.bot.quit();
      this.bot = null;
    }
    this.setStatus("disconnected");
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /**
   * Build a snapshot of the bot's current state.
   * Safe to call at any time — returns nulls for unavailable data.
   */
  getState(): BotState {
    const position = this.getPosition();
    const orientation = this.getOrientation();

    return {
      botId: this.botId,
      username: this.username,
      status: this._status,
      position,
      orientation,
      health: this.bot?.health ?? null,
      food: this.bot?.food ?? null,
      gameMode: this.bot?.game?.gameMode ?? null,
      inventory: this.getInventory(),
      lastUpdatedAt: this._lastUpdatedAt,
    };
  }

  private getPosition(): Vec3 | null {
    if (!this.bot?.entity?.position) return null;
    const pos = this.bot.entity.position;
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  private getOrientation(): Orientation | null {
    if (!this.bot?.entity) return null;
    return {
      yaw: this.bot.entity.yaw,
      pitch: this.bot.entity.pitch,
    };
  }

  private getInventory(): InventorySlot[] {
    if (!this.bot?.inventory) return [];

    return this.bot.inventory.items().map((item) => ({
      slot: item.slot,
      name: item.name,
      count: item.count,
    }));
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private setStatus(status: BotStatus): void {
    const prev = this._status;
    this._status = status;
    this._lastUpdatedAt = new Date().toISOString();
    if (prev !== status) {
      this.emit("status-change", this.botId, status);
      this.emit("state-update", this.getState());
    }
  }

  /**
   * Register mineflayer event listeners after the bot has spawned.
   * These forward relevant game events as typed BotInstance events.
   */
  private registerEventListeners(): void {
    if (!this.bot) return;

    this.bot.on("chat", (username: string, message: string) => {
      this.emit("chat", this.botId, username, message);
    });

    this.bot.on("health", () => {
      this._lastUpdatedAt = new Date().toISOString();
      this.emit("state-update", this.getState());
    });

    this.bot.on("death", () => {
      this.emit("death", this.botId);
      this.emit("state-update", this.getState());
    });

    this.bot.on("entityHurt", (entity) => {
      // Only emit damage for our own bot
      if (entity === this.bot?.entity) {
        this.emit("damage", this.botId);
      }
    });

    this.bot.on("move", () => {
      this._lastUpdatedAt = new Date().toISOString();
      // State updates from movement are throttled by the state observer,
      // but we update the timestamp here for accurate snapshots.
    });

    this.bot.on("error", (err: Error) => {
      this.setStatus("error");
      this.emit("error", this.botId, err);
    });

    this.bot.on("end", (reason: string) => {
      this.setStatus("disconnected");
      this.emit("kicked", this.botId, reason ?? "unknown");
    });

    this.bot.on("kicked", (reason: string) => {
      this.setStatus("disconnected");
      this.emit("kicked", this.botId, reason);
    });
  }
}
