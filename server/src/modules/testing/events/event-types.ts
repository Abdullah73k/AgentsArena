/**
 * Test event type definitions.
 *
 * All events emitted during the test lifecycle. The WS controller
 * subscribes to these and fans them out to connected clients.
 */

import type {
  TestRunStatus,
  CompletionReason,
  TestMetrics,
  ScenarioType,
} from "../types";

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

/** Emitted when a test run's status changes. */
export interface TestStatusChangedEvent {
  testId: string;
  previousStatus: TestRunStatus;
  newStatus: TestRunStatus;
  timestamp: string;
}

/** Emitted when the target LLM makes a decision. */
export interface TargetLlmDecisionEvent {
  testId: string;
  /** The raw LLM response text. */
  responseText: string;
  /** Actions parsed from the response. */
  parsedActions: string[];
  /** LLM response time in milliseconds. */
  responseTimeMs: number;
  timestamp: string;
}

/** Emitted when any agent performs a Minecraft action. */
export interface AgentActionEvent {
  testId: string;
  agentId: string;
  sourceType: "target" | "testing-agent";
  actionType: string;
  actionDetail: string;
  success: boolean;
  timestamp: string;
}

/** Emitted when a Discord message is sent during the test. */
export interface TestChatMessageEvent {
  testId: string;
  agentId: string;
  sourceType: "target" | "testing-agent";
  message: string;
  channel: "text" | "voice";
  timestamp: string;
}

/** Emitted when test metrics are updated. */
export interface TestMetricsUpdatedEvent {
  testId: string;
  metrics: TestMetrics;
  timestamp: string;
}

/** Emitted when a test run completes (success, timeout, error, etc.). */
export interface TestCompletedEvent {
  testId: string;
  scenarioType: ScenarioType;
  reason: CompletionReason;
  finalMetrics: TestMetrics;
  durationSeconds: number;
  timestamp: string;
}

/** Emitted when an error occurs during test execution. */
export interface TestErrorEvent {
  testId: string;
  errorMessage: string;
  errorCode: string;
  /** Whether this error is fatal (stops the test). */
  fatal: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// WebSocket wire format
// ---------------------------------------------------------------------------

/** Union of all test WebSocket server-to-client messages. */
export type TestWsServerMessage =
  | { type: "test-status-changed" } & TestStatusChangedEvent
  | { type: "target-llm-decision" } & TargetLlmDecisionEvent
  | { type: "agent-action" } & AgentActionEvent
  | { type: "test-chat-message" } & TestChatMessageEvent
  | { type: "test-metrics-updated" } & TestMetricsUpdatedEvent
  | { type: "test-completed" } & TestCompletedEvent
  | { type: "test-error" } & TestErrorEvent
  | { type: "pong" };

/** Union of all test WebSocket client-to-server messages. */
export type TestWsClientMessage =
  | { type: "subscribe"; testId: string }
  | { type: "unsubscribe"; testId: string }
  | { type: "ping" };
