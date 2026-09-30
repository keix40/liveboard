import type pg from "pg";

/**
 * Map DATABASE_URL sslmode to an explicit node-postgres `ssl` option (avoids pg's deprecated
 * implicit sslmode parsing). Any SSL mode keeps full certificate + hostname verification, matching
 * pg v8's current behavior (require/prefer/verify-ca are treated as verify-full). Never disable
 * verification here: Neon and Render certificates are publicly trusted.
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

export function postgresPoolConfig(connectionString: string, max = 4): pg.PoolConfig {
  const ssl = postgresSslOption(connectionString);
  let conn = connectionString;
  try {
    const url = new URL(connectionString);
    if (url.searchParams.has("sslmode")) {
      url.searchParams.delete("sslmode");
      conn = url.toString();
    }
  } catch {
    /* keep original */
  }
  return ssl ? { connectionString: conn, max, ssl } : { connectionString: conn, max };
}
