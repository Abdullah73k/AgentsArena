/**
 * WebSocket controller for real-time test event streaming.
 *
 * Clients connect to /ws/tests, subscribe to specific test runs by ID,
 * and receive server-pushed updates about status changes, LLM decisions,
 * agent actions, chat messages, metrics, and completion events.
 *
 * Follows the same connection-tracking pattern as the Discord WS
 * controller (server/src/modules/discord/ws.ts).
 */

import { Elysia, t } from "elysia";
import {
  testEvents,
  TestEventEmitter,
  type TestEventMap,
} from "./events/event-emitter";

// ---------------------------------------------------------------------------
// Connection tracking
// ---------------------------------------------------------------------------

interface WsConnection {
  /** Test IDs this client is subscribed to. */
  subscribedTestIds: Set<string>;
  /** The ws object reference for sending messages. */
  ws: unknown;
}

/** All active WebSocket connections. */
const connections = new Map<string, WsConnection>();

/** Generate a unique connection ID. */
let connectionCounter = 0;
function nextConnectionId(): string {
  connectionCounter += 1;
  return `ws-test-${connectionCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

/**
 * Send a message to all connections subscribed to a specific test run.
 */
function broadcastToTestSubscribers(
  testId: string,
  message: Record<string, unknown>,
): void {
  for (const [, conn] of connections) {
    if (conn.subscribedTestIds.has(testId)) {
      try {
        (conn.ws as { send: (data: unknown) => void }).send(message);
      } catch {
        // Connection may have closed; cleaned up on close event
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Event forwarding from TestEventEmitter → WebSocket clients
// ---------------------------------------------------------------------------

/** Helper to set up forwarding for test-scoped events. */
function forwardTestEvent<K extends keyof TestEventMap>(event: K): void {
  testEvents.onEvent(event, (data) => {
    const testId = (data as unknown as Record<string, unknown>).testId as string;
    const wsMessage = TestEventEmitter.toWsMessage(event, data);
    broadcastToTestSubscribers(
      testId,
      wsMessage as unknown as Record<string, unknown>,
    );
  });
}

// Forward all test events to subscribed WebSocket clients
forwardTestEvent("test-status-changed");
forwardTestEvent("target-llm-decision");
forwardTestEvent("agent-action");
forwardTestEvent("test-chat-message");
forwardTestEvent("test-metrics-updated");
forwardTestEvent("test-completed");
forwardTestEvent("test-error");

// ---------------------------------------------------------------------------
// Client message validation schema
// ---------------------------------------------------------------------------

const TestWsClientMessageSchema = t.Union([
  t.Object({
    type: t.Literal("subscribe"),
    testId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("unsubscribe"),
    testId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("ping"),
  }),
]);

// ---------------------------------------------------------------------------
// WebSocket Elysia Plugin
// ---------------------------------------------------------------------------

export const testingWs = new Elysia({
  name: "Testing.WebSocket",
}).ws("/ws/tests", {
  body: TestWsClientMessageSchema,
  response: t.Unknown(),

  open(ws) {
    const connId = nextConnectionId();
    (ws.data as Record<string, unknown>).__connId = connId;

    connections.set(connId, {
      subscribedTestIds: new Set(),
      ws,
    });

    console.log(
      `[Testing WS] Client connected (${connId}). Total: ${connections.size}`,
    );
  },

  message(ws, body) {
    const connId = (ws.data as Record<string, unknown>).__connId as string;
    const conn = connections.get(connId);

    if (!conn) {
      ws.send({ type: "error", message: "Connection not found" });
      return;
    }

    switch (body.type) {
      case "subscribe": {
        conn.subscribedTestIds.add(body.testId);
        ws.send({ type: "subscribed", testId: body.testId });
        console.log(
          `[Testing WS] ${connId} subscribed to test ${body.testId}`,
        );
        break;
      }

      case "unsubscribe": {
        conn.subscribedTestIds.delete(body.testId);
        console.log(
          `[Testing WS] ${connId} unsubscribed from test ${body.testId}`,
        );
        break;
      }

      case "ping": {
        ws.send({ type: "pong" });
        break;
      }
    }
  },

  close(ws) {
    const connId = (ws.data as Record<string, unknown>).__connId as string;
    connections.delete(connId);
    console.log(
      `[Testing WS] Client disconnected (${connId}). Total: ${connections.size}`,
    );
  },
});

/** Expose connection count for health checks. */
export function getTestingWsConnectionCount(): number {
  return connections.size;
}
