/**
 * StateObserver periodically polls bot state and emits throttled updates.
 *
 * Instead of emitting a state-update on every single mineflayer tick
 * (which would overwhelm WebSocket clients), the observer polls at
 * a configurable interval and only emits when state has meaningfully changed.
 */

import { botManager } from "../bot-manager";
import { STATE_POLL_INTERVAL_MS } from "../../../../../constants/minecraft.constants";
import type { BotState, Vec3 } from "../../types";

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/** Snapshot used for diffing to detect meaningful changes. */
interface StateSnapshot {
  status: string;
  positionKey: string;
  health: number | null;
  food: number | null;
  inventoryHash: string;
}

function positionKey(pos: Vec3 | null): string {
  if (!pos) return "null";
  // Round to 1 decimal to avoid noise from sub-block movement
  return `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
}

function inventoryHash(state: BotState): string {
  // Simple hash: join slot:name:count
  return state.inventory
    .map((s) => `${s.slot}:${s.name}:${s.count}`)
    .join("|");
}

function toSnapshot(state: BotState): StateSnapshot {
  return {
    status: state.status,
    positionKey: positionKey(state.position),
    health: state.health,
    food: state.food,
    inventoryHash: inventoryHash(state),
  };
}

function hasChanged(prev: StateSnapshot, next: StateSnapshot): boolean {
  return (
    prev.status !== next.status ||
    prev.positionKey !== next.positionKey ||
    prev.health !== next.health ||
    prev.food !== next.food ||
    prev.inventoryHash !== next.inventoryHash
  );
}

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

/** Previous snapshots keyed by botId. */
const previousSnapshots = new Map<string, StateSnapshot>();

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the state observer loop.
 * Polls all registered bots and emits "bot-state-update" on the
 * botManager when a meaningful change is detected.
 */
export function startStateObserver(): void {
  if (intervalHandle) return; // Already running

  intervalHandle = setInterval(() => {
    const states = botManager.getAllBotStates();

    for (const state of states) {
      // Skip bots that aren't spawned — no meaningful state to observe
      if (state.status !== "spawned") continue;

      const next = toSnapshot(state);
      const prev = previousSnapshots.get(state.botId);

      if (!prev || hasChanged(prev, next)) {
        previousSnapshots.set(state.botId, next);
        // Emit through botManager so WebSocket handler picks it up
        botManager.emit("bot-state-update", state);
      }
    }

    // Clean up snapshots for removed bots
    for (const botId of previousSnapshots.keys()) {
      if (!botManager.hasBot(botId)) {
        previousSnapshots.delete(botId);
      }
    }
  }, STATE_POLL_INTERVAL_MS);

  console.log(
    `[StateObserver] Started polling every ${STATE_POLL_INTERVAL_MS}ms`,
  );
}

/**
 * Stop the state observer loop.
 * Used during server shutdown or tests.
 */
export function stopStateObserver(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    previousSnapshots.clear();
    console.log("[StateObserver] Stopped");
  }
}
