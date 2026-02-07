import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { CLIENT_URL, NODE_ENV } from "../constants/env.constants";
import openapi from "@elysiajs/openapi";
import { minecraftController } from "./modules/minecraft";
import { minecraftWs } from "./modules/minecraft/ws";
import { registerAllActions } from "./modules/minecraft/bot/actions/register";
import { startStateObserver } from "./modules/minecraft/bot/state/state-observer";
import { discordController } from "./modules/discord";
import { discordWs } from "./modules/discord/ws";
import { discordClient } from "./modules/discord/client/discord-client";
import { DISCORD_AUTO_START } from "../constants/discord.constants";

// Initialize action handlers and state observer before starting the server
registerAllActions();
startStateObserver();

const app = new Elysia()
	.use(
		cors({
			origin: [CLIENT_URL],
			methods: ["POST", "PATCH", "GET", "DELETE"],
		}),
	)
	.use(openapi({ enabled: NODE_ENV === "development" }))
	.get("/", () => "Hello Elysia")
	.use(minecraftController)
	.use(minecraftWs)
	.use(discordController)
	.use(discordWs)
	.listen(3000);

console.log(
	`Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

// Optionally auto-start the Discord bot
if (DISCORD_AUTO_START) {
	discordClient
		.start()
		.then(() => {
			console.log("[Discord] Bot auto-started successfully.");
		})
		.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : "Unknown error";
			console.error(`[Discord] Auto-start failed: ${message}`);
		});
}
