/**
 * Registers all action handlers with the action registry.
 * Import this module once at startup to make all actions available.
 */

import { actionRegistry } from "./action-registry";

// Movement
import {
  moveToHandler,
  jumpHandler,
  sprintHandler,
  sneakHandler,
  lookAtHandler,
} from "./movement.actions";

// Mining
import { digHandler, placeBlockHandler } from "./mining.actions";

// Combat
import { attackHandler, equipHandler } from "./combat.actions";

// Interaction
import {
  useItemHandler,
  openContainerHandler,
  interactEntityHandler,
} from "./interaction.actions";

// Chat
import { sendChatHandler } from "./chat.actions";

/**
 * Register all built-in action handlers.
 * Call this once during server initialization.
 */
export function registerAllActions(): void {
  // Movement
  actionRegistry.register(moveToHandler);
  actionRegistry.register(jumpHandler);
  actionRegistry.register(sprintHandler);
  actionRegistry.register(sneakHandler);
  actionRegistry.register(lookAtHandler);

  // Mining
  actionRegistry.register(digHandler);
  actionRegistry.register(placeBlockHandler);

  // Combat
  actionRegistry.register(attackHandler);
  actionRegistry.register(equipHandler);

  // Interaction
  actionRegistry.register(useItemHandler);
  actionRegistry.register(openContainerHandler);
  actionRegistry.register(interactEntityHandler);

  // Chat
  actionRegistry.register(sendChatHandler);

  console.log(
    `[Actions] Registered ${actionRegistry.registeredTypes().length} action handlers: ${actionRegistry.registeredTypes().join(", ")}`,
  );
}
