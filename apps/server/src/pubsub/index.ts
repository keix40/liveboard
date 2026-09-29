import type { ServerConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { PubSub } from "./types.js";
import { LocalPubSub } from "./local.js";
import { RedisPubSub } from "./redis.js";

export type { PubSub, RoomBroadcast } from "./types.js";

export function createPubSub(cfg: ServerConfig, log: Logger): PubSub {
  return cfg.redisUrl ? new RedisPubSub(cfg.redisUrl, cfg.instanceId, log) : new LocalPubSub();
}
