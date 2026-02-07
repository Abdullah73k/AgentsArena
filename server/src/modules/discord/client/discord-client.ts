/**
 * Discord bot client wrapper.
 *
 * Manages the lifecycle of a single Discord.js Client instance.
 * Follows the singleton pattern — one bot client per server process.
 *
 * Handles:
 *  - Client login and ready state
 *  - Graceful disconnect
 *  - Auto-reconnect on unexpected disconnects
 *  - Status tracking for health checks
 */

import {
  Client,
  GatewayIntentBits,
  Events,
} from "discord.js";
import {
  DISCORD_BOT_TOKEN,
  DISCORD_MAX_RECONNECT_ATTEMPTS,
  DISCORD_RECONNECT_DELAY_MS,
} from "../../../../constants/discord.constants";
import type { DiscordBotStatus } from "../types";

class DiscordClient {
  private client: Client | null = null;
  private status: DiscordBotStatus = "offline";
  private reconnectAttempts = 0;

  /**
   * Get the underlying Discord.js Client instance.
   * Throws if the client has not been started.
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error("Discord client has not been initialized. Call start() first.");
    }
    return this.client;
  }

  /** Get the current bot status. */
  getStatus(): DiscordBotStatus {
    return this.status;
  }

  /** Get a list of guild IDs the bot is currently in. */
  getGuildIds(): string[] {
    if (!this.client) return [];
    return Array.from(this.client.guilds.cache.keys());
  }

  /** Whether the client is connected and ready. */
  isReady(): boolean {
    return this.status === "online" && this.client !== null;
  }

  /**
   * Start the Discord bot and log in with the configured token.
   * Resolves once the bot emits the `ready` event.
   */
  async start(): Promise<void> {
    if (this.status === "online" || this.status === "connecting") {
      console.log("[Discord] Bot is already started or connecting.");
      return;
    }

    if (!DISCORD_BOT_TOKEN) {
      this.status = "error";
      throw new Error(
        "DISCORD_BOT_TOKEN is not set. " +
        "Please add it to your .env.local file."
      );
    }

    this.status = "connecting";

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.registerEventHandlers();

    await this.client.login(DISCORD_BOT_TOKEN);
    // Wait for the ready event
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Discord client did not become ready within 30 seconds."));
      }, 30_000);

      this.client!.once(Events.ClientReady, () => {
        clearTimeout(timeout);
        resolve();
      });

      // If already ready (race condition), resolve immediately
      if (this.client!.isReady()) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * Stop the Discord bot and clean up resources.
   */
  async stop(): Promise<void> {
    if (!this.client) {
      this.status = "offline";
      return;
    }

    this.client.removeAllListeners();
    this.client.destroy();
    this.client = null;
    this.status = "offline";
    this.reconnectAttempts = 0;
    console.log("[Discord] Bot stopped.");
  }

  // -------------------------------------------------------------------------
  // Internal event handlers
  // -------------------------------------------------------------------------

  private registerEventHandlers(): void {
    if (!this.client) return;

    this.client.on(Events.ClientReady, (readyClient) => {
      this.status = "online";
      this.reconnectAttempts = 0;
      console.log(
        `[Discord] Bot ready as ${readyClient.user.tag} ` +
        `in ${readyClient.guilds.cache.size} guild(s).`
      );
    });

    this.client.on(Events.Error, (error) => {
      console.error("[Discord] Client error:", error.message);
      this.status = "error";
    });

    this.client.on(Events.Warn, (warning) => {
      console.warn("[Discord] Warning:", warning);
    });

    // Handle unexpected disconnects with auto-reconnect
    this.client.on(Events.ShardDisconnect, (event) => {
      console.warn(
        `[Discord] Shard disconnected (code: ${event.code}). ` +
        "Attempting reconnection..."
      );
      this.handleReconnect();
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= DISCORD_MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[Discord] Max reconnect attempts (${DISCORD_MAX_RECONNECT_ATTEMPTS}) reached. ` +
        "Giving up."
      );
      this.status = "error";
      return;
    }

    this.status = "reconnecting";
    this.reconnectAttempts++;

    console.log(
      `[Discord] Reconnect attempt ${this.reconnectAttempts}/${DISCORD_MAX_RECONNECT_ATTEMPTS} ` +
      `in ${DISCORD_RECONNECT_DELAY_MS}ms...`
    );

    await new Promise((resolve) => setTimeout(resolve, DISCORD_RECONNECT_DELAY_MS));

    try {
      await this.stop();
      await this.start();
    } catch (err) {
      console.error("[Discord] Reconnect failed:", err instanceof Error ? err.message : err);
      this.handleReconnect();
    }
  }
}

/** Singleton Discord client instance. */
export const discordClient = new DiscordClient();
