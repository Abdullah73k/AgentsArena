import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { CLIENT_URL, NODE_ENV } from "../constants/env.constants";
import openapi from "@elysiajs/openapi";
import { minecraftController } from "./modules/minecraft";
import { minecraftWs } from "./modules/minecraft/ws";
import { registerAllActions } from "./modules/minecraft/bot/actions/register";
import { startStateObserver } from "./modules/minecraft/bot/state/state-observer";

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
	.listen(3000);

console.log(
	`Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
