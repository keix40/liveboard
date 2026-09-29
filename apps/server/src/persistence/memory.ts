import type { DocPersistence } from "./types.js";
import { foldUpdates } from "./merge.js";

/** In-process persistence for local dev and tests. Data is lost on restart. */
export class MemoryPersistence implements DocPersistence {
  readonly name = "memory";
  private readonly snapshots = new Map<string, Uint8Array>();
  private readonly logs = new Map<string, Uint8Array[]>();

  async init(): Promise<void> {}

  async load(roomId: string): Promise<Uint8Array | null> {
    return foldUpdates(this.snapshots.get(roomId) ?? null, this.logs.get(roomId) ?? []);
  }

  async storeUpdate(roomId: string, update: Uint8Array): Promise<void> {
    const log = this.logs.get(roomId) ?? [];
    log.push(update);
    this.logs.set(roomId, log);
  }

  async compact(roomId: string): Promise<void> {
    const log = this.logs.get(roomId) ?? [];
    const merged = foldUpdates(this.snapshots.get(roomId) ?? null, log);
    if (merged) this.snapshots.set(roomId, merged);
    this.logs.set(roomId, []);
  }

  /** Test helper */
  logLength(roomId: string): number {
    return this.logs.get(roomId)?.length ?? 0;
  }

  async close(): Promise<void> {}
}
