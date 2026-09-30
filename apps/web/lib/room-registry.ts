import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import pg from "pg";
import { postgresPoolConfig } from "./postgres-ssl";

export interface RoomRegistryRow {
  roomId: string;
  editCapHash: string;
  createdAt: Date;
}

const memory = new Map<string, string>();

let pool: pg.Pool | null = null;
let roomRegistrySchemaPromise: Promise<void> | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool(postgresPoolConfig(url));
  }
  return pool;
}

export function hashEditCapability(cap: string): string {
  return createHash("sha256").update(cap).digest("hex");
}

export function generateRoomEditSecret(): string {
  return randomBytes(32).toString("base64url");
}

export async function initRoomRegistrySchema(): Promise<void> {
  const p = getPool();
  if (!p) return;
  if (!roomRegistrySchemaPromise) {
    roomRegistrySchemaPromise = p
      .query(`
    CREATE TABLE IF NOT EXISTS liveboard_rooms (
      room_id TEXT PRIMARY KEY,
      edit_cap_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
      .then(() => undefined)
      .catch((err) => {
        roomRegistrySchemaPromise = null;
        throw err;
      });
  }
  await roomRegistrySchemaPromise;
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

/** Returns edit capability once for a newly registered room. Race-safe insert. */
export async function createRoomRecord(roomId: string): Promise<{ editCap: string } | { error: "exists" }> {
  const editCap = generateRoomEditSecret();
  const editCapHash = hashEditCapability(editCap);
  const p = getPool();
  if (!p) {
    if (memory.has(roomId)) return { error: "exists" };
    memory.set(roomId, editCapHash);
    return { editCap };
  }
  const res = await p.query(
    "INSERT INTO liveboard_rooms (room_id, edit_cap_hash) VALUES ($1, $2) ON CONFLICT (room_id) DO NOTHING",
    [roomId, editCapHash],
  );
  if (res.rowCount === 0) return { error: "exists" };
  return { editCap };
}

export function verifyEditCapability(editCap: string, storedHash: string): boolean {
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
