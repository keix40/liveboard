import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

/** Load .env files if present (Node >= 20.12). Real env vars always win. */
for (const path of [".env", "../../.env"]) {
  try {
    process.loadEnvFile(path);
  } catch {
    /* file missing - fine */
  }
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be an integer, got "${raw}"`);
  return n;
}

export interface ServerConfig {
  port: number;
  host: string;
  instanceId: string;
  jwtSecret: string;
  allowedOrigins: string[];
  persistence: "memory" | "postgres";
  databaseUrl?: string;
  redisUrl?: string;
  compactEveryNUpdates: number;
  rateLimit: { msgsPerSec: number; burst: number };
  maxMessageBytes: number;
  maxConnectionsPerRoom: number;
  /** How long an empty room stays in memory before being evicted. */
  roomIdleMs: number;
  heartbeatMs: number;
  /** Max upgrade attempts per IP per minute. */
  upgradesPerIpPerMin: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const persistence = (process.env.PERSISTENCE ?? "memory") as ServerConfig["persistence"];
  const cfg: ServerConfig = {
    port: int("PORT", 1234),
    host: process.env.HOST ?? "0.0.0.0",
    instanceId: process.env.INSTANCE_ID ?? `${hostname()}-${randomUUID().slice(0, 8)}`,
    jwtSecret: process.env.LIVEBOARD_JWT_SECRET ?? "",
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    persistence,
    databaseUrl: process.env.DATABASE_URL || undefined,
    redisUrl: process.env.REDIS_URL || undefined,
    compactEveryNUpdates: int("COMPACT_EVERY_N_UPDATES", 500),
    rateLimit: {
      msgsPerSec: int("RATE_LIMIT_MSGS_PER_SEC", 60),
      burst: int("RATE_LIMIT_BURST", 200),
    },
    maxMessageBytes: int("MAX_MESSAGE_BYTES", 1024 * 1024),
    maxConnectionsPerRoom: int("MAX_CONNECTIONS_PER_ROOM", 50),
    roomIdleMs: int("ROOM_IDLE_MS", 30_000),
    heartbeatMs: int("HEARTBEAT_MS", 30_000),
    upgradesPerIpPerMin: int("UPGRADES_PER_IP_PER_MIN", 60),
    logLevel: (process.env.LOG_LEVEL as ServerConfig["logLevel"]) ?? "info",
    ...overrides,
  };

  if (cfg.jwtSecret.length < 32) {
    throw new Error("LIVEBOARD_JWT_SECRET must be set and at least 32 characters long");
  }
  if (!["memory", "postgres"].includes(cfg.persistence)) {
    throw new Error(`PERSISTENCE must be "memory" or "postgres", got "${cfg.persistence}"`);
  }
  if (cfg.persistence === "postgres" && !cfg.databaseUrl) {
    throw new Error("DATABASE_URL is required when PERSISTENCE=postgres");
  }
  return cfg;
}
