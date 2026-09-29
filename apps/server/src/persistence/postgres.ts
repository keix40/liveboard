import pg from "pg";
import type { DocPersistence } from "./types.js";
import { foldUpdates } from "./merge.js";
import type { Logger } from "../logger.js";
import { postgresSslOption } from "./postgres-ssl.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS liveboard_documents (
  room_id      TEXT PRIMARY KEY,
  snapshot     BYTEA       NOT NULL,
  compacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS liveboard_updates (
  id         BIGSERIAL   PRIMARY KEY,
  room_id    TEXT        NOT NULL,
  update     BYTEA       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS liveboard_updates_room_id_id ON liveboard_updates (room_id, id);
`;

/**
 * Postgres persistence: append-only update log + snapshot compaction.
 * Compaction runs in a transaction guarded by a per-room advisory lock so two
 * instances never fold the same log concurrently.
 */
export class PostgresPersistence implements DocPersistence {
  readonly name = "postgres";
  private readonly pool: pg.Pool;

  constructor(
    connectionString: string,
    private readonly log: Logger,
  ) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
      ssl: postgresSslOption(connectionString),
    });
    this.pool.on("error", (err) => this.log.error("pg pool error", { err: err.message }));
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async load(roomId: string): Promise<Uint8Array | null> {
    const snap = await this.pool.query<{ snapshot: Buffer }>(
      "SELECT snapshot FROM liveboard_documents WHERE room_id = $1",
      [roomId],
    );
    const updates = await this.pool.query<{ update: Buffer }>(
      "SELECT update FROM liveboard_updates WHERE room_id = $1 ORDER BY id",
      [roomId],
    );
    return foldUpdates(
      snap.rows[0]?.snapshot ?? null,
      updates.rows.map((r) => r.update),
    );
  }

  async storeUpdate(roomId: string, update: Uint8Array): Promise<void> {
    await this.pool.query("INSERT INTO liveboard_updates (room_id, update) VALUES ($1, $2)", [
      roomId,
      Buffer.from(update),
    ]);
  }

  async compact(roomId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lock = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked",
        [roomId],
      );
      if (!lock.rows[0]?.locked) {
        await client.query("ROLLBACK");
        return; // another instance is compacting this room
      }
      const snap = await client.query<{ snapshot: Buffer }>(
        "SELECT snapshot FROM liveboard_documents WHERE room_id = $1",
        [roomId],
      );
      const updates = await client.query<{ id: string; update: Buffer }>(
        "SELECT id, update FROM liveboard_updates WHERE room_id = $1 ORDER BY id",
        [roomId],
      );
      if (updates.rows.length === 0) {
        await client.query("ROLLBACK");
        return;
      }
      const maxId = updates.rows[updates.rows.length - 1]!.id;
      const merged = foldUpdates(
        snap.rows[0]?.snapshot ?? null,
        updates.rows.map((r) => r.update),
      )!;
      await client.query(
        `INSERT INTO liveboard_documents (room_id, snapshot, compacted_at) VALUES ($1, $2, now())
         ON CONFLICT (room_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, compacted_at = now()`,
        [roomId, Buffer.from(merged)],
      );
      // Only delete rows we actually folded; rows inserted meanwhile survive.
      await client.query("DELETE FROM liveboard_updates WHERE room_id = $1 AND id <= $2", [roomId, maxId]);
      await client.query("COMMIT");
      this.log.debug("compacted room", { roomId, folded: updates.rows.length, bytes: merged.byteLength });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async roomHasContent(roomId: string): Promise<boolean> {
    const res = await this.pool.query<{ has: boolean }>(
      `SELECT (
         EXISTS (SELECT 1 FROM liveboard_documents WHERE room_id = $1)
         OR EXISTS (SELECT 1 FROM liveboard_updates WHERE room_id = $1)
       ) AS has`,
      [roomId],
    );
    return Boolean(res.rows[0]?.has);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
