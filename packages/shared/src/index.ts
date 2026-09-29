/**
 * @liveboard/shared — types and constants shared by apps/web and apps/server.
 *
 * The Yjs document layout (see SETUP.md § Data model):
 *
 *   Y.Doc
 *   ├── "strokes" : Y.Array<Y.Map<StrokeField>>   freehand strokes (ordered = z-order)
 *   ├── "shapes"  : Y.Map<Y.Map<ShapeField>>      rect / ellipse / line / arrow, keyed by id
 *   ├── "notes"   : Y.Map<Y.Map<NoteField>>       sticky notes, text is a Y.Text
 *   └── "meta"    : Y.Map<unknown>                board title, createdAt, schemaVersion
 */

export const DOC_SCHEMA_VERSION = 1;

/** Top-level shared type names inside the Y.Doc. */
export const YKEYS = {
  strokes: "strokes",
  shapes: "shapes",
  notes: "notes",
  meta: "meta",
} as const;

/** y-websocket-compatible top-level message types (first varUint of every frame). */
export const MessageType = {
  Sync: 0,
  Awareness: 1,
  Auth: 2,
  QueryAwareness: 3,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** WebSocket close codes used by the server (4000-4999 is the app-private range). */
export {
  APP_CLOSE_PREFIX,
  formatAppCloseReason,
  isAppTerminalCloseCode,
  parseAppCloseCode,
} from "./ws-close.js";

export const CloseCode = {
  Normal: 1000,
  GoingAway: 1001,
  PolicyViolation: 1008,
  MessageTooBig: 1009,
  Unauthorized: 4401,
  Forbidden: 4403,
  RoomFull: 4429,
  RateLimited: 4408,
} as const;

/** Room ids are URL-safe so they can live in the WS path: wss://host/<roomId> */
export const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
export function isValidRoomId(id: string): boolean {
  return ROOM_ID_PATTERN.test(id);
}

// ─── Board objects ────────────────────────────────────────────────────────

export type Point = [x: number, y: number, pressure: number];

/** Plain-object view of a stroke. In the Y.Doc, `points` is a Y.Array<number> (flat x,y,p,...). */
export type StrokeVariant = "pen" | "highlighter";

export interface Stroke {
  id: string;
  authorId: string;
  color: string;
  size: number;
  /** Defaults to pen when absent (legacy boards). */
  variant?: StrokeVariant;
  points: Point[];
  createdAt: number;
}
export type StrokeField = "id" | "authorId" | "color" | "size" | "variant" | "points" | "createdAt";

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow" | "text";
export interface Shape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  stroke: string;
  fill: string | null;
  strokeWidth: number;
  /** Populated when kind === "text". */
  text?: string;
  z: number;
  authorId: string;
  createdAt: number;
}
export type ShapeField = keyof Shape;

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** In the Y.Doc this is a Y.Text so concurrent edits merge character-wise. */
  text: string;
  z: number;
  authorId: string;
  createdAt: number;
}
export type NoteField = keyof StickyNote;

// ─── Presence (awareness) ─────────────────────────────────────────────────

export type Tool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "note"
  | "select";

/** Ephemeral per-client state broadcast via the Yjs awareness protocol. Never persisted. */
export interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: { x: number; y: number } | null;
  tool?: Tool;
  /** Ids of objects currently selected by this user (for remote selection outlines). */
  selection?: string[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export type RoomRole = "editor" | "viewer";

/** Claims inside the short-lived room JWT (HS256) minted by apps/web and verified by apps/server. */
export interface RoomTokenClaims {
  /** Stable user id */
  sub: string;
  /** Display name */
  name: string;
  /** Room the token grants access to, or "*" for any room */
  room: string;
  role: RoomRole;
  iat?: number;
  exp?: number;
}

export const JWT_ISSUER = "liveboard-web";
export const JWT_AUDIENCE = "liveboard-sync";

// ─── Misc ─────────────────────────────────────────────────────────────────

export const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length]!;
}

export interface HealthResponse {
  status: "ok";
  uptimeSec: number;
  rooms: number;
  connections: number;
  instanceId: string;
  persistence: string;
  pubsub: string;
}
