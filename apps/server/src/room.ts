import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { WebSocket } from "ws";
import { CloseCode, MessageType, type RoomTokenClaims } from "@liveboard/shared";
import type { DocPersistence } from "./persistence/index.js";
import type { PubSub, RoomBroadcast } from "./pubsub/index.js";
import type { Logger } from "./logger.js";
import { PerTurnTokenBucket, TokenBucket } from "./rate-limit.js";
import { scheduleAppClose } from "./ws-close.js";
import { encodeAwareness, encodeSyncStep1, encodeUpdate } from "./protocol.js";

/** Transaction origins that must NOT be re-persisted / re-published. */
export const PERSISTENCE_ORIGIN = Symbol("persistence");
export const REMOTE_ORIGIN = Symbol("remote-instance");

/** Drop clients whose outgoing buffer grows beyond this (slow consumer protection). */
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

export interface RoomDeps {
  persistence: DocPersistence;
  pubsub: PubSub;
  log: Logger;
  compactEveryNUpdates: number;
  rateLimit: { msgsPerSec: number; burst: number };
  onEmpty: (room: Room) => void;
}

interface Client {
  ws: WebSocket;
  user: RoomTokenClaims;
  /** Awareness clientIDs controlled by this socket (removed on disconnect). */
  awarenessIds: Set<number>;
  limiter: PerTurnTokenBucket;
  rateLimitTurn: number;
  kicked: boolean;
  onMessage: (data: WebSocket.RawData, isBinary: boolean) => void;
}

type AwarenessChange = { added: number[]; updated: number[]; removed: number[] };

/**
 * One collaborative board: a Y.Doc + awareness + the sockets connected to it on this instance.
 */
export class Room {
  readonly doc = new Y.Doc({ gc: true });
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  private readonly clients = new Map<WebSocket, Client>();
  private readonly pendingWrites = new Set<Promise<unknown>>();
  private updatesSinceCompaction = 0;
  private compacting = false;
  private destroyed = false;
  private unsubscribe: () => Promise<void> = async () => {};

  private constructor(
    readonly id: string,
    private readonly deps: RoomDeps,
  ) {
    this.awareness.setLocalState(null); // the server itself has no presence
    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  static async load(id: string, deps: RoomDeps): Promise<Room> {
    const room = new Room(id, deps);
    const state = await deps.persistence.load(id);
    if (state) Y.applyUpdate(room.doc, state, PERSISTENCE_ORIGIN);
    room.unsubscribe = await deps.pubsub.subscribe(id, room.onRemote);
    deps.log.debug("room loaded", { roomId: id, bytes: state?.byteLength ?? 0 });
    return room;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get size(): number {
    return this.clients.size;
  }

  // ─── Connections ────────────────────────────────────────────────────────

  addClient(ws: WebSocket, user: RoomTokenClaims): void {
    const client: Client = {
      ws,
      user,
      awarenessIds: new Set(),
      limiter: new PerTurnTokenBucket(
        new TokenBucket(this.deps.rateLimit.msgsPerSec, this.deps.rateLimit.burst),
      ),
      rateLimitTurn: -1,
      kicked: false,
      onMessage: () => {},
    };
    client.onMessage = (data, isBinary) => {
      if (client.kicked) return;
      if (!isBinary) return this.kick(client, CloseCode.PolicyViolation, "binary frames only");
      if (!client.limiter.take(client)) return this.kick(client, CloseCode.RateLimited, "rate limited");
      const buf = Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? Buffer.from(data) : data;
      this.handleMessage(client, new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    };
    this.clients.set(ws, client);

    ws.on("message", client.onMessage);
    ws.on("close", () => this.removeClient(ws));
    ws.on("error", () => this.removeClient(ws));

    // Kick off sync: send our state vector (step 1) and the current presence of everyone.
    this.send(ws, encodeSyncStep1(this.doc));
    const states = this.awareness.getStates();
    if (states.size > 0) this.send(ws, encodeAwareness(this.awareness, [...states.keys()]));
  }

  private removeClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;
    this.clients.delete(ws);
    // Clear this socket's cursors for everyone (also propagates to other instances).
    awarenessProtocol.removeAwarenessStates(this.awareness, [...client.awarenessIds], null);
    if (this.clients.size === 0) this.deps.onEmpty(this);
  }

  private kick(client: Client, code: number, reason: string) {
    if (client.kicked) return;
    client.kicked = true;
    client.ws.off("message", client.onMessage);
    this.clients.delete(client.ws);
    awarenessProtocol.removeAwarenessStates(this.awareness, [...client.awarenessIds], null);
    if (this.clients.size === 0) this.deps.onEmpty(this);
    this.deps.log.warn("closing client", { roomId: this.id, user: client.user.sub, code, reason });
    scheduleAppClose(client.ws, code, reason);
  }

  closeAll(code: number, reason: string): void {
    for (const ws of this.clients.keys()) ws.close(code, reason);
  }

  // ─── Incoming frames ────────────────────────────────────────────────────

  private handleMessage(client: Client, data: Uint8Array): void {
    if (client.kicked) return;
    try {
      const decoder = decoding.createDecoder(data);
      const type = decoding.readVarUint(decoder);
      switch (type) {
        case MessageType.Sync: {
          // Viewers may request state (step1) but never write (step2 / update).
          if (client.user.role === "viewer" && decoding.peekVarUint(decoder) !== syncProtocol.messageYjsSyncStep1) {
            return;
          }
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MessageType.Sync);
          // Applies step2/update to the doc with origin = this socket, or writes step2 as a reply to step1.
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, client.ws);
          if (encoding.length(encoder) > 1) this.send(client.ws, encoding.toUint8Array(encoder));
          break;
        }
        case MessageType.Awareness: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, client.ws);
          break;
        }
        case MessageType.QueryAwareness: {
          this.send(client.ws, encodeAwareness(this.awareness, [...this.awareness.getStates().keys()]));
          break;
        }
        case MessageType.Auth:
          break; // auth happens during the HTTP upgrade; ignore in-band auth frames
        default:
          this.kick(client, CloseCode.PolicyViolation, `unknown message type ${type}`);
      }
    } catch (err) {
      this.deps.log.warn("malformed frame", { roomId: this.id, err: (err as Error).message });
      this.kick(client, CloseCode.PolicyViolation, "malformed frame");
    }
  }

  // ─── Outgoing fan-out ───────────────────────────────────────────────────

  private onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    const frame = encodeUpdate(update);
    for (const ws of this.clients.keys()) if (ws !== origin) this.send(ws, frame);

    if (origin === PERSISTENCE_ORIGIN || origin === REMOTE_ORIGIN) return;
    // Local (client) update: persist + fan out to other instances.
    this.track(this.deps.persistence.storeUpdate(this.id, update));
    this.track(this.deps.pubsub.publish(this.id, { kind: "update", data: update }));
    if (++this.updatesSinceCompaction >= this.deps.compactEveryNUpdates) this.maybeCompact();
  };

  private onAwarenessUpdate = ({ added, updated, removed }: AwarenessChange, origin: unknown): void => {
    const client = origin instanceof WebSocket ? this.clients.get(origin) : undefined;
    if (client) {
      for (const id of added) client.awarenessIds.add(id);
      for (const id of removed) client.awarenessIds.delete(id);
    }
    const changed = [...added, ...updated, ...removed];
    if (changed.length === 0) return;
    const frame = encodeAwareness(this.awareness, changed);
    for (const ws of this.clients.keys()) this.send(ws, frame);
    if (origin !== REMOTE_ORIGIN) {
      const data = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed);
      this.track(this.deps.pubsub.publish(this.id, { kind: "awareness", data }));
    }
  };

  /** Messages from other server instances (Redis). */
  private onRemote = (msg: RoomBroadcast): void => {
    try {
      if (msg.kind === "update") Y.applyUpdate(this.doc, msg.data, REMOTE_ORIGIN);
      else awarenessProtocol.applyAwarenessUpdate(this.awareness, msg.data, REMOTE_ORIGIN);
    } catch (err) {
      this.deps.log.warn("bad remote message", { roomId: this.id, err: (err as Error).message });
    }
  };

  private send(ws: WebSocket, frame: Uint8Array): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      ws.terminate();
      return;
    }
    ws.send(frame, (err) => {
      if (err) ws.terminate();
    });
  }

  // ─── Persistence bookkeeping ────────────────────────────────────────────

  private track(p: Promise<unknown>): void {
    const tracked = p
      .catch((err: Error) => this.deps.log.error("room io failed", { roomId: this.id, err: err.message }))
      .finally(() => this.pendingWrites.delete(tracked));
    this.pendingWrites.add(tracked);
  }

  private maybeCompact(): void {
    if (this.compacting) return;
    this.compacting = true;
    this.updatesSinceCompaction = 0;
    // Wait for the appends in flight *right now* so they're part of the fold.
    // (Not flush(): that would also wait on this compaction promise -> deadlock.)
    const inFlight = [...this.pendingWrites];
    this.track(
      Promise.allSettled(inFlight)
        .then(() => this.deps.persistence.compact(this.id))
        .finally(() => (this.compacting = false)),
    );
  }

  /** Resolve once every pending persistence/pubsub write has settled. */
  async flush(): Promise<void> {
    while (this.pendingWrites.size > 0) await Promise.allSettled([...this.pendingWrites]);
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    await this.flush();
    await this.unsubscribe();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
