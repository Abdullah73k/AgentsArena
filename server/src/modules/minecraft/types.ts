/**
 * Core TypeScript types for the Minecraft bot module.
 *
 * These types represent domain concepts used across bot management,
 * action execution, state observation, and WebSocket communication.
 * Elysia route/WS validation models live in model.ts (TypeBox).
 */

// ---------------------------------------------------------------------------
// Position & Spatial
// ---------------------------------------------------------------------------

/** 3D coordinate in Minecraft world space. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Orientation angles in degrees. */
export interface Orientation {
  yaw: number;
  pitch: number;
}

// ---------------------------------------------------------------------------
// Bot Lifecycle
// ---------------------------------------------------------------------------

/** Possible states of a bot connection. */
export type BotStatus =
  | "connecting"
  | "connected"
  | "spawned"
  | "disconnected"
  | "error";

/** Configuration required to create a new bot. */
export interface BotConfig {
  /** Unique identifier for this bot instance. */
  botId: string;
  /** Minecraft username (offline mode). */
  username: string;
  /** Minecraft server hostname. */
  host: string;
  /** Minecraft server port. */
  port: number;
  /** Minecraft version string (e.g. "1.21.1"). Omit to auto-detect. */
  version?: string;
  /** Authentication mode — always offline for testing. */
  auth: "offline";
}

/** Runtime snapshot of a single bot's state. */
export interface BotState {
  botId: string;
  username: string;
  status: BotStatus;
  position: Vec3 | null;
  orientation: Orientation | null;
  health: number | null;
  food: number | null;
  gameMode: string | null;
  /** Simplified inventory — array of slot summaries. */
  inventory: InventorySlot[];
  /** ISO-8601 timestamp of the last state update. */
  lastUpdatedAt: string;
}

/** Single inventory slot summary. */
export interface InventorySlot {
  slot: number;
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** All supported action type identifiers. */
export type ActionType =
  | "move-to"
  | "jump"
  | "sprint"
  | "sneak"
  | "look-at"
  | "dig"
  | "place-block"
  | "attack"
  | "equip"
  | "use-item"
  | "open-container"
  | "interact-entity"
  | "send-chat";

/** Base structure shared by every action request. */
export interface ActionBase {
  type: ActionType;
  botId: string;
}

// -- Movement actions -------------------------------------------------------

export interface MoveToAction extends ActionBase {
  type: "move-to";
  position: Vec3;
}

export interface JumpAction extends ActionBase {
  type: "jump";
}

export interface SprintAction extends ActionBase {
  type: "sprint";
  enabled: boolean;
}

export interface SneakAction extends ActionBase {
  type: "sneak";
  enabled: boolean;
}

export interface LookAtAction extends ActionBase {
  type: "look-at";
  position: Vec3;
}

// -- Mining actions ---------------------------------------------------------

export interface DigAction extends ActionBase {
  type: "dig";
  position: Vec3;
}

export interface PlaceBlockAction extends ActionBase {
  type: "place-block";
  position: Vec3;
  /** Which face of the target block to place against. */
  face: BlockFace;
}

export type BlockFace =
  | "top"
  | "bottom"
  | "north"
  | "south"
  | "east"
  | "west";

// -- Combat actions ---------------------------------------------------------

export interface AttackAction extends ActionBase {
  type: "attack";
  /** Entity ID or username of target. */
  target: string;
}

export interface EquipAction extends ActionBase {
  type: "equip";
  itemName: string;
  destination: EquipDestination;
}

export type EquipDestination = "hand" | "off-hand" | "head" | "torso" | "legs" | "feet";

// -- Interaction actions ----------------------------------------------------

export interface UseItemAction extends ActionBase {
  type: "use-item";
}

export interface OpenContainerAction extends ActionBase {
  type: "open-container";
  position: Vec3;
}

export interface InteractEntityAction extends ActionBase {
  type: "interact-entity";
  target: string;
}

// -- Chat action ------------------------------------------------------------

export interface SendChatAction extends ActionBase {
  type: "send-chat";
  message: string;
}

/** Discriminated union of all possible bot actions. */
export type BotAction =
  | MoveToAction
  | JumpAction
  | SprintAction
  | SneakAction
  | LookAtAction
  | DigAction
  | PlaceBlockAction
  | AttackAction
  | EquipAction
  | UseItemAction
  | OpenContainerAction
  | InteractEntityAction
  | SendChatAction;

// ---------------------------------------------------------------------------
// Action Results
// ---------------------------------------------------------------------------

/** Outcome status of an executed action. */
export type ActionResultStatus = "success" | "failure" | "cancelled";

/** Result returned after an action completes. */
export interface ActionResult {
  botId: string;
  actionType: ActionType;
  status: ActionResultStatus;
  /** Human-readable detail or error message. */
  message: string;
  /** How long the action took in milliseconds. */
  durationMs: number;
  /** ISO-8601 timestamp of completion. */
  completedAt: string;
}

// ---------------------------------------------------------------------------
// WebSocket Messages
// ---------------------------------------------------------------------------

/** Client-to-server WebSocket message types. */
export type WsClientMessageType =
  | "subscribe"
  | "unsubscribe"
  | "execute-action"
  | "ping";

/** Server-to-client WebSocket message types. */
export type WsServerMessageType =
  | "bot-state-update"
  | "action-result"
  | "bot-event"
  | "error"
  | "pong";

/** Client subscribes to state updates for specific bots. */
export interface WsSubscribeMessage {
  type: "subscribe";
  botIds: string[];
}

/** Client unsubscribes from bot updates. */
export interface WsUnsubscribeMessage {
  type: "unsubscribe";
  botIds: string[];
}

/** Client requests an action to be executed. */
export interface WsExecuteActionMessage {
  type: "execute-action";
  action: BotAction;
}

/** Client keepalive ping. */
export interface WsPingMessage {
  type: "ping";
}

/** Union of all client-to-server messages. */
export type WsClientMessage =
  | WsSubscribeMessage
  | WsUnsubscribeMessage
  | WsExecuteActionMessage
  | WsPingMessage;

/** Server pushes a bot state snapshot. */
export interface WsBotStateUpdate {
  type: "bot-state-update";
  state: BotState;
}

/** Server pushes an action result. */
export interface WsActionResultMessage {
  type: "action-result";
  result: ActionResult;
}

/** Server pushes a generic bot event (chat, damage, death, etc.). */
export interface WsBotEventMessage {
  type: "bot-event";
  botId: string;
  event: string;
  data: Record<string, unknown>;
}

/** Server pushes an error. */
export interface WsErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

/** Server pong response. */
export interface WsPongMessage {
  type: "pong";
}

/** Union of all server-to-client messages. */
export type WsServerMessage =
  | WsBotStateUpdate
  | WsActionResultMessage
  | WsBotEventMessage
  | WsErrorMessage
  | WsPongMessage;

// ---------------------------------------------------------------------------
// Action Handler Interface
// ---------------------------------------------------------------------------

/**
 * Interface that every action handler must implement.
 * Each handler knows how to execute one ActionType against a mineflayer bot.
 */
export interface ActionHandler<A extends BotAction = BotAction> {
  /** Which action type this handler processes. */
  readonly actionType: A["type"];
  /** Execute the action and return a result. */
  execute(bot: unknown, action: A): Promise<ActionResult>;
}
