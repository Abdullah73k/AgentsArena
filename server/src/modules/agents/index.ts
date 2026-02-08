/**
 * Testing Agent Controller
 *
 * Elysia HTTP controller for testing agent management.
 * Following ElysiaJS MVC pattern:
 * - 1 Elysia instance = 1 controller
 * - Thin handlers that delegate to AgentService
 * - Models registered via .model() and referenced by name
 */

import { Elysia, status } from "elysia";
import { AgentService } from "./service";
import {
  AgentInstanceSchema,
  ListAgentsResponseSchema,
  CreateAgentRequestSchema,
  AgentActionsResponseSchema,
  AgentSuccessResponseSchema,
  AgentErrorResponseSchema,
} from "./model";

export const agentController = new Elysia({
  name: "Agent.Controller",
  prefix: "/api/agents",
})
  // Register models for OpenAPI documentation
  .model({
    "agent.instance": AgentInstanceSchema,
    "agent.list": ListAgentsResponseSchema,
    "agent.create": CreateAgentRequestSchema,
    "agent.actions": AgentActionsResponseSchema,
    "agent.success": AgentSuccessResponseSchema,
    "agent.error": AgentErrorResponseSchema,
  })

  // -------------------------------------------------------------------------
  // POST /api/agents — Create a new testing agent
  // -------------------------------------------------------------------------
  .post(
    "/",
    async ({ body }) => {
      const result = await AgentService.createAgent(body);

      if (!result.ok) {
        return status(result.httpStatus as 400 | 502 | 500, {
          success: false,
          message: result.message ?? "Failed to create agent",
          code: result.code,
        });
      }

      return result.data!;
    },
    {
      body: "agent.create",
      response: {
        200: "agent.instance",
        400: "agent.error",
        502: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Create Testing Agent",
        description:
          "Spawn a new testing agent with a behavioral profile and connect it to Minecraft",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/agents — List all agents
  // -------------------------------------------------------------------------
  .get(
    "/",
    async ({ query }) => {
      const result = await AgentService.listAgents(query);

      if (!result.ok || !result.data) {
        return status(500, {
          success: false,
          message: result.message ?? "Failed to list agents",
          code: "LIST_ERROR",
        });
      }

      return result.data;
    },
    {
      response: {
        200: "agent.list",
        500: "agent.error",
      },
      detail: {
        summary: "List Agents",
        description: "Get all testing agents with optional filters",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/agents/:agentId — Get specific agent
  // -------------------------------------------------------------------------
  .get(
    "/:agentId",
    async ({ params }) => {
      const result = await AgentService.getAgent(params.agentId);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message ?? "Failed to get agent",
          code: result.code,
        });
      }

      return result.data!;
    },
    {
      response: {
        200: "agent.instance",
        404: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Get Agent",
        description: "Get agent details by ID",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // DELETE /api/agents/:agentId — Terminate agent
  // -------------------------------------------------------------------------
  .delete(
    "/:agentId",
    async ({ params }) => {
      const result = await AgentService.terminateAgent(params.agentId);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message,
          code: result.code,
        });
      }

      return {
        success: true,
        message: result.message,
      };
    },
    {
      response: {
        200: "agent.success",
        404: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Terminate Agent",
        description: "Stop and remove a testing agent",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // POST /api/agents/:agentId/pause — Pause agent
  // -------------------------------------------------------------------------
  .post(
    "/:agentId/pause",
    async ({ params }) => {
      const result = await AgentService.pauseAgent(params.agentId);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message,
          code: result.code,
        });
      }

      return {
        success: true,
        message: result.message,
      };
    },
    {
      response: {
        200: "agent.success",
        404: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Pause Agent",
        description: "Pause agent behavior execution",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // POST /api/agents/:agentId/resume — Resume agent
  // -------------------------------------------------------------------------
  .post(
    "/:agentId/resume",
    async ({ params }) => {
      const result = await AgentService.resumeAgent(params.agentId);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message,
          code: result.code,
        });
      }

      return {
        success: true,
        message: result.message,
      };
    },
    {
      response: {
        200: "agent.success",
        404: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Resume Agent",
        description: "Resume agent behavior execution",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/agents/:agentId/actions — Get agent action logs
  // -------------------------------------------------------------------------
  .get(
    "/:agentId/actions",
    async ({ params, query }) => {
      const limit = query.limit ? Number(query.limit) : 100;
      const result = await AgentService.getAgentActions(params.agentId, limit);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message ?? "Failed to get actions",
          code: result.code,
        });
      }

      return result.data!;
    },
    {
      response: {
        200: "agent.actions",
        404: "agent.error",
        500: "agent.error",
      },
      detail: {
        summary: "Get Agent Actions",
        description: "Retrieve behavioral action logs for an agent",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // GET /api/agents/:agentId/health — Get agent health status
  // -------------------------------------------------------------------------
  .get(
    "/:agentId/health",
    async ({ params }) => {
      const result = await AgentService.getAgentHealth(params.agentId);

      if (!result.ok) {
        return status(result.httpStatus as 404 | 500, {
          success: false,
          message: result.message ?? "Failed to get health",
          code: result.code,
        });
      }

      return result.data;
    },
    {
      detail: {
        summary: "Get Agent Health",
        description: "Check agent health and identify issues",
        tags: ["Agents"],
      },
    }
  )

  // -------------------------------------------------------------------------
  // DELETE /api/agents/all — Terminate all agents
  // -------------------------------------------------------------------------
  .delete(
    "/all",
    async () => {
      const result = await AgentService.terminateAll();

      if (!result.ok) {
        return status(500, {
          success: false,
          message: result.message,
          code: "TERMINATE_ALL_ERROR",
        });
      }

      return {
        success: true,
        message: result.message,
      };
    },
    {
      response: {
        200: "agent.success",
        500: "agent.error",
      },
      detail: {
        summary: "Terminate All Agents",
        description: "Stop and remove all testing agents",
        tags: ["Agents"],
      },
    }
  );
