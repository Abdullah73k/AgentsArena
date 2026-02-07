/**
 * Event emitter for the Testing module.
 *
 * Centralises all WebSocket event emission so that the coordinator,
 * target LLM agent, and completion detector can broadcast events
 * without importing the WebSocket controller directly.
 *
 * Uses Node EventEmitter internally. Same pattern as
 * discord/events/event-broadcaster.ts.
 */

import { EventEmitter } from "node:events";
import type {
  TestStatusChangedEvent,
  TargetLlmDecisionEvent,
  AgentActionEvent,
  TestChatMessageEvent,
  TestMetricsUpdatedEvent,
  TestCompletedEvent,
  TestErrorEvent,
  TestWsServerMessage,
} from "./event-types";

// ---------------------------------------------------------------------------
// Typed event map
// ---------------------------------------------------------------------------

export interface TestEventMap {
  "test-status-changed": TestStatusChangedEvent;
  "target-llm-decision": TargetLlmDecisionEvent;
  "agent-action": AgentActionEvent;
  "test-chat-message": TestChatMessageEvent;
  "test-metrics-updated": TestMetricsUpdatedEvent;
  "test-completed": TestCompletedEvent;
  "test-error": TestErrorEvent;
}

// ---------------------------------------------------------------------------
// Typed emitter
// ---------------------------------------------------------------------------

export class TestEventEmitter extends EventEmitter {
  /** Emit a typed test event. */
  emitEvent<K extends keyof TestEventMap>(
    event: K,
    data: TestEventMap[K],
  ): void {
    this.emit(event, data);
  }

  /** Subscribe to a typed test event. */
  onEvent<K extends keyof TestEventMap>(
    event: K,
    listener: (data: TestEventMap[K]) => void,
  ): this {
    this.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /** Unsubscribe from a typed test event. */
  offEvent<K extends keyof TestEventMap>(
    event: K,
    listener: (data: TestEventMap[K]) => void,
  ): this {
    this.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Convert an internal event payload to the wire-format TestWsServerMessage.
   */
  static toWsMessage<K extends keyof TestEventMap>(
    event: K,
    data: TestEventMap[K],
  ): TestWsServerMessage {
    return { type: event, ...data } as TestWsServerMessage;
  }
}

/** Singleton event emitter for the Testing module. */
export const testEvents = new TestEventEmitter();
