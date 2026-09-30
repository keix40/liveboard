import type pg from "pg";

/** Map DATABASE_URL sslmode to node-postgres `ssl` (avoids deprecated implicit SSL parsing). */
export function postgresSslOption(connectionString: string): pg.ConnectionConfig["ssl"] {
  try {
    const url = new URL(connectionString);
    const mode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
    if (mode === "disable") return undefined;
    if (mode === "verify-full" || mode === "verify-ca") {
      return { rejectUnauthorized: true };
    }
    if (mode === "require" || mode === "prefer") {
      return { rejectUnauthorized: false };
    }
  } catch {
    /* not a URL */
  }
  if (/sslmode=verify-full|sslmode=verify-ca/i.test(connectionString)) {
    return { rejectUnauthorized: true };
  }
  if (/sslmode=require|render\.com|neon\.tech/i.test(connectionString)) {
    return { rejectUnauthorized: /verify-full|verify-ca/i.test(connectionString) };
  }
  return undefined;
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
