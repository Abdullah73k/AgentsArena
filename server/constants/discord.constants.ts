/**
 * Discord bot configuration constants.
 *
 * All credentials are loaded from environment variables.
 * The bot token, client ID, and guild ID must be set before
 * starting the Discord client.
 */

/** Discord bot token for authentication. */
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";

/** Discord application client ID. */
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";

/** Primary guild (server) ID for test operations. */
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID ?? "";

/** Whether to auto-start the Discord bot on server launch. */
export const DISCORD_AUTO_START = process.env.DISCORD_AUTO_START === "true";

/** Maximum reconnection attempts before giving up. */
export const DISCORD_MAX_RECONNECT_ATTEMPTS = 3;

/** Delay between reconnection attempts in milliseconds. */
export const DISCORD_RECONNECT_DELAY_MS = 5_000;
