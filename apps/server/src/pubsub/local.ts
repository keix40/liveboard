import type { PubSub, RoomHandler } from "./types.js";

/** Single-instance mode: nothing to fan out to. */
export class LocalPubSub implements PubSub {
  readonly name = "none";
  async publish(): Promise<void> {}
  async subscribe(_roomId: string, _handler: RoomHandler): Promise<() => Promise<void>> {
    return async () => {};
  }
  async close(): Promise<void> {}
}
