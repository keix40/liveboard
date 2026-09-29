import { Redis } from "ioredis";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { PubSub, RoomBroadcast, RoomHandler } from "./types.js";
import type { Logger } from "../logger.js";

const channelFor = (roomId: string) => `liveboard:room:${roomId}`;
const KIND = { update: 0, awareness: 1 } as const;

/**
 * Redis pub/sub fan-out. Wire format (binary, lib0 encoding):
 *   varString originInstanceId | varUint kind | varUint8Array payload
 * Messages published by this instance are ignored on receipt (no echo loops).
 */
export class RedisPubSub implements PubSub {
  readonly name = "redis";
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly handlers = new Map<string, Set<RoomHandler>>();

  constructor(
    url: string,
    private readonly instanceId: string,
    private readonly log: Logger,
  ) {
    this.pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.sub = this.pub.duplicate();
    for (const c of [this.pub, this.sub]) c.on("error", (e) => this.log.warn("redis error", { err: e.message }));
    this.sub.on("messageBuffer", (channel: Buffer, message: Buffer) => this.onMessage(channel.toString(), message));
  }

  async publish(roomId: string, msg: RoomBroadcast): Promise<void> {
    const enc = encoding.createEncoder();
    encoding.writeVarString(enc, this.instanceId);
    encoding.writeVarUint(enc, KIND[msg.kind]);
    encoding.writeVarUint8Array(enc, msg.data);
    await this.pub.publish(channelFor(roomId), Buffer.from(encoding.toUint8Array(enc)));
  }

  async subscribe(roomId: string, handler: RoomHandler): Promise<() => Promise<void>> {
    const channel = channelFor(roomId);
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      await this.sub.subscribe(channel);
    }
    set.add(handler);
    return async () => {
      const s = this.handlers.get(channel);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) {
        this.handlers.delete(channel);
        await this.sub.unsubscribe(channel);
      }
    };
  }

  private onMessage(channel: string, message: Buffer) {
    const set = this.handlers.get(channel);
    if (!set) return;
    try {
      const dec = decoding.createDecoder(new Uint8Array(message));
      const origin = decoding.readVarString(dec);
      if (origin === this.instanceId) return;
      const kind = decoding.readVarUint(dec) === KIND.update ? "update" : "awareness";
      const data = decoding.readVarUint8Array(dec);
      for (const h of set) h({ kind, data });
    } catch (err) {
      this.log.warn("bad pubsub message", { channel, err: (err as Error).message });
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.sub.quit(), this.pub.quit()]);
  }
}
