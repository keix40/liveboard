import { createHash, timingSafeEqual } from "node:crypto";
import pg from "pg";
import { editCapability } from "./capabilities-server";

export interface RoomRegistryRow {
  roomId: string;
  editCapHash: string;
  createdAt: Date;
}

const memory = new Map<string, string>();

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 4 });
  }
  return pool;
}

export function hashEditCapability(cap: string): string {
  return createHash("sha256").update(cap).digest("hex");
}

export async function initRoomRegistrySchema(): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS liveboard_rooms (
      room_id TEXT PRIMARY KEY,
      edit_cap_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function getRoomRecord(roomId: string): Promise<RoomRegistryRow | null> {
  const p = getPool();
  if (!p) {
    const hash = memory.get(roomId);
    return hash ? { roomId, editCapHash: hash, createdAt: new Date(0) } : null;
  }
  const res = await p.query<{ room_id: string; edit_cap_hash: string; created_at: Date }>(
    "SELECT room_id, edit_cap_hash, created_at FROM liveboard_rooms WHERE room_id = $1",
    [roomId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { roomId: row.room_id, editCapHash: row.edit_cap_hash, createdAt: row.created_at };
}

/** Returns edit capability once for a newly registered room. */
export async function createRoomRecord(roomId: string, secret: string): Promise<{ editCap: string } | { error: "exists" }> {
  const editCap = editCapability(roomId, secret);
  const editCapHash = hashEditCapability(editCap);
  const p = getPool();
  if (!p) {
    if (memory.has(roomId)) return { error: "exists" };
    memory.set(roomId, editCapHash);
    return { editCap };
  }
  try {
    await p.query("INSERT INTO liveboard_rooms (room_id, edit_cap_hash) VALUES ($1, $2)", [roomId, editCapHash]);
    return { editCap };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return { error: "exists" };
    }
    throw err;
  }
}

export function verifyEditCapability(roomId: string, secret: string, editCap: string, storedHash: string): boolean {
  const expected = editCapability(roomId, secret);
  if (editCap.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(editCap), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const hash = hashEditCapability(editCap);
  if (hash.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

/** Test helper */
export function clearMemoryRegistry(): void {
  memory.clear();
}
