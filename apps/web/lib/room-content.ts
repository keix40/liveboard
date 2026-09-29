import pg from "pg";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) pool = new pg.Pool({ connectionString: url, max: 4 });
  return pool;
}

async function roomHasContentInDb(roomId: string): Promise<boolean | null> {
  const p = getPool();
  if (!p) return null;
  const res = await p.query<{ has: boolean }>(
    `SELECT (
       EXISTS (SELECT 1 FROM liveboard_documents WHERE room_id = $1)
       OR EXISTS (SELECT 1 FROM liveboard_updates WHERE room_id = $1)
     ) AS has`,
    [roomId],
  );
  return Boolean(res.rows[0]?.has);
}

/** True when the room already has persisted Yjs data (legacy boards must not be "claimed"). */
export async function roomHasPersistedContent(roomId: string): Promise<boolean> {
  const db = await roomHasContentInDb(roomId);
  if (db !== null) return db;

  const syncHttp = (process.env.LIVEBOARD_SYNC_HTTP_URL ?? process.env.NEXT_PUBLIC_SYNC_HTTP_URL ?? "")
    .replace(/\/$/, "");
  const secret = process.env.LIVEBOARD_INTERNAL_SECRET ?? "";
  if (!syncHttp || !secret) return false;

  const res = await fetch(`${syncHttp}/internal/rooms/${encodeURIComponent(roomId)}/has-content`, {
    headers: { "x-liveboard-internal": secret },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return false;
  const body = (await res.json().catch(() => null)) as { hasContent?: boolean } | null;
  return Boolean(body?.hasContent);
}
