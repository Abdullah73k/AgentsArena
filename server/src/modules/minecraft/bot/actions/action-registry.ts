/**
 * ActionRegistry stores all registered action handlers, keyed by action type.
 *
 * Handlers are registered at startup and looked up at runtime when
 * an action needs to be dispatched. This keeps the action system
 * extensible — new action types are added by registering a handler.
 */

import type { ActionHandler, ActionType, BotAction } from "../../types";

class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  /**
   * Register a handler for a specific action type.
   * Overwrites any previously registered handler for the same type.
   */
  register<A extends BotAction>(handler: ActionHandler<A>): void {
    this.handlers.set(handler.actionType, handler as ActionHandler);
  }

  /**
   * Look up the handler for a given action type.
   * Returns undefined if no handler is registered.
   */
  get(actionType: ActionType): ActionHandler | undefined {
    return this.handlers.get(actionType);
  }

  /**
   * Check if a handler is registered for the given action type.
   */
  has(actionType: ActionType): boolean {
    return this.handlers.has(actionType);
  }

  /**
   * List all registered action types.
   */
  registeredTypes(): ActionType[] {
    return Array.from(this.handlers.keys()) as ActionType[];
  }
}

/** Singleton action registry shared across the application. */
export const actionRegistry = new ActionRegistry();
