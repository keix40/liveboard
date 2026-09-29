import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { CloseCode, isValidRoomId, type HealthResponse } from "@liveboard/shared";
import type { ServerConfig } from "./config.js";
import { createLogger, type Logger } from "./logger.js";
import { AuthError, verifyRoomToken } from "./auth.js";
import { WindowCounter } from "./rate-limit.js";
import { RoomManager } from "./room-manager.js";
import { createPersistence, type DocPersistence } from "./persistence/index.js";
import { createPubSub, type PubSub } from "./pubsub/index.js";
import { clientIp } from "./client-ip.js";
import { forceCloseWebSocket } from "./ws-close.js";

export interface SyncServer {
  http: http.Server;
  rooms: RoomManager;
  persistence: DocPersistence;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export interface SyncServerOptions {
  persistence?: DocPersistence;
  pubsub?: PubSub;
  log?: Logger;
}

type Alive = WebSocket & { isAlive?: boolean };

function rejectHttp(socket: Duplex, status: number, message: string) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`,
  );
  socket.destroy();
}

export function createSyncServer(cfg: ServerConfig, opts: SyncServerOptions = {}): SyncServer {
  const log = opts.log ?? createLogger(cfg.logLevel, { instance: cfg.instanceId });
  const persistence = opts.persistence ?? createPersistence(cfg, log);
  const pubsub = opts.pubsub ?? createPubSub(cfg, log);
  const rooms = new RoomManager(
    { persistence, pubsub, log, compactEveryNUpdates: cfg.compactEveryNUpdates, rateLimit: cfg.rateLimit },
    cfg.roomIdleMs,
    log,
  );
  const upgradeLimiter = new WindowCounter(cfg.upgradesPerIpPerMin, 60_000);
  const startedAt = Date.now();
  let shuttingDown = false;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://internal");
    if (url.pathname === "/healthz") {
      const body: HealthResponse = {
        status: "ok",
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        rooms: rooms.roomCount,
        connections: await rooms.connectionCount(),
        instanceId: cfg.instanceId,
        persistence: persistence.name,
        pubsub: pubsub.name,
      };
      res.writeHead(shuttingDown ? 503 : 200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("LiveBoard sync server. Connect via WebSocket at /<roomId>?token=<jwt>\n");
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: cfg.maxMessageBytes, perMessageDeflate: false });

  server.on("upgrade", async (req, socket, head) => {
    socket.on("error", () => socket.destroy());
    if (shuttingDown) return rejectHttp(socket, 503, "Shutting Down");

    const url = new URL(req.url ?? "/", "http://internal");
    const roomId = decodeURIComponent(url.pathname.slice(1));
    const origin = req.headers.origin;
    const ip = clientIp(req);

    if (!upgradeLimiter.hit(ip)) return rejectHttp(socket, 429, "Too Many Requests");
    if (!isValidRoomId(roomId)) return rejectHttp(socket, 400, "Bad Room Id");
    if (cfg.allowedOrigins.length > 0 && (!origin || !cfg.allowedOrigins.includes(origin))) {
      return rejectHttp(socket, 403, "Origin Not Allowed");
    }

    // Reject auth at the HTTP layer when possible so clients learn immediately (browser
    // WebSocket APIs still hide the status, but Node clients and our sync watchdog see failure).
    let user;
    try {
      user = await verifyRoomToken(url.searchParams.get("token"), roomId, cfg.jwtSecret);
    } catch (err) {
      const forbidden = err instanceof AuthError && err.kind === "forbidden";
      log.info("auth rejected", { roomId, ip, reason: (err as Error).message });
      return rejectHttp(socket, forbidden ? 403 : 401, forbidden ? "Forbidden" : "Unauthorized");
    }

    let room;
    try {
      room = await rooms.get(roomId);
    } catch (err) {
      log.error("room load failed", { roomId, err: (err as Error).message });
      return rejectHttp(socket, 500, "Room Unavailable");
    }
    if (room.size >= cfg.maxConnectionsPerRoom) {
      return wss.handleUpgrade(req, socket, head, (ws) => forceCloseWebSocket(ws, CloseCode.RoomFull, "room full"));
    }

    wss.handleUpgrade(req, socket, head, (ws: Alive) => {
      // Lost a race with idle eviction: ask the client to retry (it reloads the room).
      if (room.isDestroyed) return forceCloseWebSocket(ws, 1013, "try again");
      ws.isAlive = true;
      ws.on("pong", () => (ws.isAlive = true));
      room.addClient(ws, user);
      log.debug("client joined", { roomId, user: user.sub, conns: room.size });
    });
  });

  // Heartbeat: detect half-open TCP connections (laptop lid closed, mobile network switch).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Alive>) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, cfg.heartbeatMs);
  heartbeat.unref();

  return {
    http: server,
    rooms,
    persistence,
    async listen() {
      await persistence.init();
      await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : cfg.port;
      log.info("sync server listening", { port, persistence: persistence.name, pubsub: pubsub.name });
      return port;
    },
    async close() {
      shuttingDown = true;
      clearInterval(heartbeat);
      await rooms.shutdown(CloseCode.GoingAway, "server restarting");
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections(); // drop idle keep-alive HTTP sockets (e.g. health checks)
      await closed;
      await pubsub.close();
      await persistence.close();
    },
  };
}
