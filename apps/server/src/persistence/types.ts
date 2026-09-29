/**
 * Durable storage for Yjs documents.
 *
 * Strategy: every incoming update is appended to a per-room log (cheap, append-only),
 * and periodically the log is folded into a single snapshot ("compaction").
 * Loading a room = snapshot + all updates after it, merged into one Yjs update.
 */
export interface DocPersistence {
  readonly name: string;
  /** Create tables / connect. Called once on boot. */
  init(): Promise<void>;
  /** Return the merged state of the room as a single Yjs update, or null if the room is new. */
  load(roomId: string): Promise<Uint8Array | null>;
  /** Append one Yjs update to the room's log. */
  storeUpdate(roomId: string, update: Uint8Array): Promise<void>;
  /**
   * Fold snapshot + update log into a new snapshot and drop the folded log rows.
   * Must be computed from *stored* data (not one instance's memory) so it's safe
   * when several server instances write to the same room.
   */
  compact(roomId: string): Promise<void>;
  close(): Promise<void>;
}
