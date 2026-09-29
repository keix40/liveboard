import { Room, type RoomDeps } from "./room.js";
import type { Logger } from "./logger.js";

/**
 * Keeps rooms in memory while they have connections (+ a grace period),
 * de-duplicating concurrent loads of the same room.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Promise<Room>>();
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly deps: Omit<RoomDeps, "onEmpty">,
    private readonly idleMs: number,
    private readonly log: Logger,
  ) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  async get(roomId: string): Promise<Room> {
    this.cancelIdle(roomId);
    let p = this.rooms.get(roomId);
    if (!p) {
      p = Room.load(roomId, { ...this.deps, onEmpty: (r) => this.scheduleEvict(r.id) });
      p.catch(() => this.rooms.delete(roomId));
      this.rooms.set(roomId, p);
    }
    return p;
  }

  async connectionCount(): Promise<number> {
    const rooms = await Promise.allSettled(this.rooms.values());
    return rooms.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.size : 0), 0);
  }

  private scheduleEvict(roomId: string) {
    this.cancelIdle(roomId);
    const t = setTimeout(() => void this.evict(roomId), this.idleMs);
    t.unref();
    this.idleTimers.set(roomId, t);
  }

  private cancelIdle(roomId: string) {
    const t = this.idleTimers.get(roomId);
    if (t) clearTimeout(t);
    this.idleTimers.delete(roomId);
  }

  private async evict(roomId: string) {
    this.idleTimers.delete(roomId);
    const p = this.rooms.get(roomId);
    if (!p) return;
    const room = await p;
    await room.flush();
    if (room.size > 0 || this.rooms.get(roomId) !== p) return; // someone rejoined meanwhile
    this.rooms.delete(roomId);
    await room.destroy();
    this.log.debug("room evicted", { roomId });
  }

  /** Graceful shutdown: close sockets (clients reconnect elsewhere), flush, destroy. */
  async shutdown(code: number, reason: string): Promise<void> {
    for (const t of this.idleTimers.values()) clearTimeout(t);
    this.idleTimers.clear();
    const rooms = await Promise.allSettled(this.rooms.values());
    await Promise.all(
      rooms.map(async (r) => {
        if (r.status !== "fulfilled") return;
        r.value.closeAll(code, reason);
        await r.value.destroy();
      }),
    );
    this.rooms.clear();
  }
}
