import type pg from "pg";

/**
 * Map DATABASE_URL sslmode to an explicit node-postgres `ssl` option (avoids pg's deprecated
 * implicit sslmode parsing). Any SSL mode keeps full certificate + hostname verification.
 */
export function postgresSslOption(connectionString: string): pg.ConnectionConfig["ssl"] {
  let mode = "";
  try {
    mode = (new URL(connectionString).searchParams.get("sslmode") ?? "").toLowerCase();
  } catch {
    mode = (/sslmode=([a-z-]+)/i.exec(connectionString)?.[1] ?? "").toLowerCase();
  }
  if (mode === "disable" || mode === "") return undefined;
  return { rejectUnauthorized: true };
}
