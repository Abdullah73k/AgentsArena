/**
 * Minecraft bot HTTP controller.
 *
 * 1 Elysia instance = 1 controller (Elysia MVC pattern).
 * Models registered via .model() and referenced by name.
 * Handlers are thin — delegate to MinecraftService, then map
 * service results to HTTP responses using Elysia status().
 */

import { Elysia, status } from "elysia";
import { MinecraftService } from "./service";
import {
  CreateBotBody,
  BotStateResponse,
  BotListResponse,
  BotIdParam,
  SuccessResponse,
  ErrorResponse,
} from "./model";

export const minecraftController = new Elysia({
  name: "Minecraft.Controller",
  prefix: "/api/minecraft",
})
  // Register models for OpenAPI documentation and reference by name
  .model({
    "minecraft.createBot": CreateBotBody,
    "minecraft.botState": BotStateResponse,
    "minecraft.botList": BotListResponse,
    "minecraft.botId": BotIdParam,
    "minecraft.success": SuccessResponse,
    "minecraft.error": ErrorResponse,
  })

  // -------------------------------------------------------------------------
  // POST /api/minecraft/bots — Create and connect a new bot
  // -------------------------------------------------------------------------
  .post(
    "/bots",
    async ({ body }) => {
      const result = await MinecraftService.createBot(
        body.username,
        body.host,
        body.port,
        body.version,
      );

      if (!result.ok) {
        return status(
          result.httpStatus as 409 | 429 | 502 | 500,
          {
            success: false as const,
            message: result.message,
            code: result.code,
          },
        );
      }

      return result.data;
    },
    {
      body: "minecraft.createBot",
      response: {
        200: "minecraft.botState",
        409: "minecraft.error",
        429: "minecraft.error",
        502: "minecraft.error",
        500: "minecraft.error",
      },
      detail: {
        summary: "Create Bot",
        description:
          "Create a new Minecraft bot and connect it to the server.",
        tags: ["Minecraft"],
      },
    },
  )

  // -------------------------------------------------------------------------
  // GET /api/minecraft/bots — List all bots
  // -------------------------------------------------------------------------
  .get(
    "/bots",
    () => {
      return MinecraftService.listBots();
    },
    {
      response: {
        200: "minecraft.botList",
      },
      detail: {
        summary: "List Bots",
        description: "List all registered bots and their current states.",
        tags: ["Minecraft"],
      },
    },
  )

  // -------------------------------------------------------------------------
  // GET /api/minecraft/bots/:botId — Get a single bot's state
  // -------------------------------------------------------------------------
  .get(
    "/bots/:botId",
    ({ params }) => {
      const result = MinecraftService.getBotState(params.botId);

      if (!result.ok) {
        return status(404, {
          success: false as const,
          message: result.message,
          code: result.code,
        });
      }

      return result.data;
    },
    {
      params: "minecraft.botId",
      response: {
        200: "minecraft.botState",
        404: "minecraft.error",
      },
      detail: {
        summary: "Get Bot State",
        description: "Get the current state of a specific bot.",
        tags: ["Minecraft"],
      },
    },
  )

  // -------------------------------------------------------------------------
  // DELETE /api/minecraft/bots/:botId — Disconnect a specific bot
  // -------------------------------------------------------------------------
  .delete(
    "/bots/:botId",
    ({ params }) => {
      const result = MinecraftService.disconnectBot(params.botId);

      if (!result.ok) {
        return status(404, {
          success: false as const,
          message: result.message,
          code: result.code,
        });
      }

      return result.data;
    },
    {
      params: "minecraft.botId",
      response: {
        200: "minecraft.success",
        404: "minecraft.error",
      },
      detail: {
        summary: "Disconnect Bot",
        description:
          "Disconnect a bot from the Minecraft server and remove it.",
        tags: ["Minecraft"],
      },
    },
  )

  // -------------------------------------------------------------------------
  // DELETE /api/minecraft/bots/all — Disconnect all bots
  // -------------------------------------------------------------------------
  .delete(
    "/bots/all",
    () => {
      return MinecraftService.disconnectAll();
    },
    {
      response: {
        200: "minecraft.success",
      },
      detail: {
        summary: "Disconnect All Bots",
        description: "Disconnect all bots and clean up resources.",
        tags: ["Minecraft"],
      },
    },
  );
