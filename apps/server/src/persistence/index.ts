import type { ServerConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { DocPersistence } from "./types.js";
import { MemoryPersistence } from "./memory.js";
import { PostgresPersistence } from "./postgres.js";

export type { DocPersistence } from "./types.js";
export { MemoryPersistence } from "./memory.js";
export { PostgresPersistence } from "./postgres.js";

export function createPersistence(cfg: ServerConfig, log: Logger): DocPersistence {
  if (cfg.persistence === "postgres") return new PostgresPersistence(cfg.databaseUrl!, log);
  return new MemoryPersistence();
}
