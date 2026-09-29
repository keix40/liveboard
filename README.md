<div align="center">

# 🖍️ LiveBoard

**A multiplayer whiteboard that keeps working offline.**
Draw together in real time, see everyone's cursor, and keep drawing without a network. Your strokes merge when you reconnect.

[![CI](https://github.com/keix40/liveboard/actions/workflows/ci.yml/badge.svg)](https://github.com/keix40/liveboard/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Yjs](https://img.shields.io/badge/CRDT-Yjs-f7df1e)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

[Live demo](#-demo) · [How sync works](#-how-sync-works) · [Run locally](#-getting-started) · [Deploy](#-deployment)

</div>

---

## 📸 Demo

> **🚧 PLACEHOLDER: replace before publishing.**
> - Live demo: `https://<your-vercel-project>.vercel.app` *(not deployed yet)*
> - Add `docs/demo.gif`: two browser windows side by side, drawing at the same time, then one going offline and reconnecting.
> - Add `docs/screenshot.png`: board with several cursors and the presence bar visible.

<!-- ![LiveBoard demo](docs/demo.gif) -->

---

## ✨ Features

**Working in this starter**
- ✏️ **Freehand drawing** with pressure-sensitive, smoothed strokes ([perfect-freehand](https://github.com/steveruizok/perfect-freehand) on Canvas 2D)
- 👀 **Live strokes:** other people see your line *while* you draw it, not when you lift the pen
- 🖱️ **Live cursors & presence:** names, colors and an "N online" bar, using the Yjs awareness protocol
- 📴 **Offline-first:** the board is kept in IndexedDB, so you can edit offline and changes merge automatically on reconnect
- 🔁 **Resilient connection:** exponential backoff, instant reconnect on `online`, token refresh on expiry
- ↶ **Per-user undo/redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`), eraser, clear board
- 🔐 **JWT room access** with editor/viewer roles enforced on the server
- 🛡️ **Abuse protection:** per-IP upgrade limit, per-socket token-bucket rate limit, frame size cap, room capacity, heartbeat
- 💾 **Pluggable persistence:** in-memory for dev, or Postgres with an append-only update log and snapshot compaction
- 📡 **Horizontal scaling hooks:** Redis pub/sub fan-out between sync-server instances

**On the roadmap:** shapes, sticky notes, infinite canvas with pan/zoom, real accounts and share links, export. See [Roadmap](#-roadmap).

---

## 🧱 Tech stack

| | |
|---|---|
| **Monorepo** | pnpm workspaces · Turborepo · TypeScript (strict) |
| **Web** (`apps/web`, on Vercel) | Next.js 16 (App Router) · React 19 · Canvas 2D · perfect-freehand |
| **Realtime** | Yjs CRDT · y-websocket protocol · y-indexeddb · awareness protocol |
| **Sync server** (`apps/server`, on Render) | Node 22 · `ws` · `jose` (JWT) · Postgres (`pg`) · Redis (`ioredis`) |
| **Shared** (`packages/shared`) | Doc schema keys, message types, close codes, board/presence/JWT types |
| **Quality** | Vitest (unit + real-socket integration) · Playwright (two-browser e2e) · GitHub Actions |

---

## 🏗️ Architecture

```mermaid
flowchart LR
  subgraph Browser["Browser (each user)"]
    UI["Canvas UI"] <--> YD["Y.Doc"]
    UI <--> AW["Awareness<br/>(cursors)"]
    YD <--> IDB[("IndexedDB")]
    YD <--> WP["WebsocketProvider"]
    AW <--> WP
  end

  subgraph Vercel
    NEXT["Next.js app"]
    TOK["/api/token<br/>(signs JWT)"]
  end

  subgraph Render
    S1["Sync server #1"]
    S2["Sync server #2"]
    PG[("Postgres<br/>snapshot + update log")]
    RD[("Redis<br/>pub/sub")]
  end

  UI -->|HTTPS| NEXT
  UI -->|POST| TOK
  WP -->|"wss://…/roomId?token=JWT"| S1
  WP -.->|"another user, same room"| S2
  S1 <--> PG
  S2 <--> PG
  S1 <-->|"liveboard:room:&lt;id&gt;"| RD
  S2 <--> RD
```

### Why two hosts?

Vercel Functions gained WebSocket support in **public beta** in June 2026 ([docs](https://vercel.com/docs/functions/websockets)). Those connections still **close when the function hits its max duration**, and **reconnects may land on a different instance**, so any room state has to live outside memory. A CRDT room server works best as a **long-lived process** that keeps each room's document hot in memory for hours. So the UI and token endpoint run on **Vercel**, and the WebSocket sync server runs as a persistent **Render** web service.

---

## 🔄 How sync works

1. **Local first.** Opening `/board/<roomId>` loads the board from IndexedDB right away.
2. **Auth.** The page asks `/api/token` (Vercel) for a short-lived HS256 JWT scoped to the room. The sync server verifies it with the same shared secret during the WebSocket upgrade.
3. **Handshake (y-websocket protocol).** The client and server exchange *state vectors* (sync step 1). Each side replies with only the operations the other is missing (sync step 2). Offline edits upload here.
4. **Live updates.** Each pen movement appends `[x, y, pressure]` to that stroke's nested `Y.Array` and sends a tiny binary update. The server rebroadcasts it to the room, appends it to Postgres, and publishes it to Redis for other instances.
5. **Presence.** Cursor positions travel as *awareness* updates. They're ephemeral: never stored, and cleared when a socket closes or times out.
6. **Conflicts?** None to resolve. Yjs is a CRDT, so concurrent edits converge to the same state on every peer, in any order.
7. **Persistence.** Updates go into an append-only log. Every N updates, the log is folded into a snapshot inside a Postgres transaction guarded by an advisory lock. A room load is snapshot + remaining log.

| Close code | Meaning | Client reaction |
|---|---|---|
| `1001` | Server restarting (deploy) | Reconnect with backoff |
| `4401` | Missing/expired/invalid token | Fetch a new token, reconnect |
| `4403` | Token not valid for this room | Show "Access denied" |
| `4408` | Rate limited | Wait 5 s, reconnect |
| `4429` | Room full | Show "Room is full" |

The full design, including sequence diagrams, the data model, the persistence strategy and scaling notes, is in [`docs/DESIGN.md`](./docs/DESIGN.md).

---

## 🚀 Getting started

**Prerequisites:** Node ≥ 20.9 (22 LTS recommended), pnpm 10 (`corepack enable`).

```bash
git clone https://github.com/keix40/liveboard.git
cd liveboard
pnpm install
cp .env.example .env
# set LIVEBOARD_JWT_SECRET to a long random string:
#   openssl rand -base64 48
pnpm dev
```

- Web: http://localhost:3000. Click **New board**, then open the same URL in a second window or browser.
- Sync server: ws://localhost:1234 (health: http://localhost:1234/healthz)

Both apps read the root `.env` in development. By default the server uses **in-memory** persistence, so no database is needed.

**Optional: Postgres + Redis locally**

```bash
docker run -d --name lb-pg -e POSTGRES_USER=liveboard -e POSTGRES_PASSWORD=liveboard -e POSTGRES_DB=liveboard -p 5432:5432 postgres:17
docker run -d --name lb-redis -p 6379:6379 redis:7
# then in .env:
PERSISTENCE=postgres
DATABASE_URL=postgres://liveboard:liveboard@localhost:5432/liveboard
REDIS_URL=redis://localhost:6379
```

The schema is created automatically on boot (see `apps/server/sql/001_init.sql`).

**Try two sync-server instances** (Redis fan-out). Set `REDIS_URL`, add `http://localhost:3001` to `ALLOWED_ORIGINS`, then:

```bash
PORT=1235 pnpm --filter @liveboard/server dev                                      # 2nd sync server
NEXT_PUBLIC_WS_URL=ws://localhost:1235 pnpm --filter @liveboard/web exec next dev -p 3001
```

Open the same room on :3000 and :3001. Each window talks to a different server, and strokes still sync through Redis.

---

## 🔧 Environment variables

| Variable | Used by | Default | Description |
|---|---|---|---|
| `LIVEBOARD_JWT_SECRET` | web + server | none (required) | Shared HS256 secret, **≥ 32 chars**. Must be identical on Vercel and Render. |
| `NEXT_PUBLIC_WS_URL` | web | `ws://localhost:1234` | Public sync-server URL (`wss://…onrender.com` in prod). |
| `PORT` | server | `1234` | Listen port (Render injects this). |
| `ALLOWED_ORIGINS` | server | *(empty = any)* | Comma-separated browser origins allowed to open sockets. |
| `PERSISTENCE` | server | `memory` | `memory` or `postgres`. |
| `DATABASE_URL` | server | none | Postgres connection string (required for `postgres`). |
| `REDIS_URL` | server | *(unset)* | Enables cross-instance pub/sub when set. |
| `COMPACT_EVERY_N_UPDATES` | server | `500` | Fold the update log into a snapshot after N updates. |
| `RATE_LIMIT_MSGS_PER_SEC` / `RATE_LIMIT_BURST` | server | `60` / `200` | Per-socket token bucket. |
| `MAX_MESSAGE_BYTES` | server | `1048576` | Max WebSocket frame size. |
| `MAX_CONNECTIONS_PER_ROOM` | server | `50` | Room capacity per instance. |
| `UPGRADES_PER_IP_PER_MIN` | server | `60` | Upgrade attempts per IP per minute. |
| `ROOM_IDLE_MS` / `HEARTBEAT_MS` | server | `30000` / `30000` | Empty-room grace period / ping interval. |
| `LOG_LEVEL` | server | `info` | `debug` · `info` · `warn` · `error` (JSON lines). |

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run web (3000) and sync server (1234) with hot reload |
| `pnpm build` | Build every package (Turbo-cached) |
| `pnpm typecheck` | `tsc --noEmit` across the monorepo |
| `pnpm test` | Vitest: web unit tests and server integration tests |
| `pnpm test:e2e` | Playwright two-browser test (run `pnpm exec playwright install chromium` once first) |
| `pnpm token -- <roomId\|*> [name] [editor\|viewer]` | Print a room JWT for manual testing |

---

## 🧪 Testing

- **`apps/server/test/sync.test.ts`** starts a real server on a random port and connects stock `y-websocket` clients over real sockets. It checks:
  - `/healthz`
  - doc sync and awareness between two clients
  - persistence, compaction, and restore after room eviction
  - viewers can't write
  - HTTP **401/403** on bad/mismatched JWT at upgrade; forceful TCP teardown on WS kicks
  - FIN-blocking TCP proxy regression (simulates Render) in `apps/server/test/proxy-auth.test.ts`
  - HTTP 400 for invalid room ids
- **`apps/web/lib/strokes.test.ts`** covers stroke helpers, eraser hit-testing, and CRDT convergence of concurrent strokes between two docs.
- **`apps/web/e2e/multiplayer.spec.ts`** opens two browser contexts in one room, draws in one, and asserts the stroke and presence show up in the other (also run in CI).
- **`apps/web/lib/sync-watchdog.test.ts`**, **`stroke-batcher.test.ts`**: hung-session guard and rAF stroke batching.

---

## ☁️ Deployment

### Sync server → Render

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo, and set **Blueprint Path** to `apps/server/render.yaml`. The default blueprint creates:
   - `liveboard-sync`: **free** Node web service (`plan: free`) with health check `/healthz`
   - `PERSISTENCE=memory` (rooms survive while the instance stays up; data is lost on redeploy/spin-down)
3. Fill in the `sync: false` secrets:
   - `LIVEBOARD_JWT_SECRET`: the same value you'll give Vercel (≥ 32 characters)
   - `ALLOWED_ORIGINS`: e.g. `https://liveboard.vercel.app`
4. Note the service URL, e.g. `https://liveboard-sync.onrender.com`. The client uses `wss://liveboard-sync.onrender.com`.

The Blueprint builds from the repo root (`pnpm install --frozen-lockfile && pnpm turbo run build --filter=@liveboard/server`) and starts with `node apps/server/dist/index.js`. On deploy, Render sends `SIGTERM`; the server force-closes WebSockets and ends the underlying TCP session so clients fail fast instead of hanging until a proxy timeout.

**Free tier caveats:** Render free web services **spin down after ~15 minutes of inactivity**, which drops every open socket. For always-on demos, use a paid instance plan.

**Upgrade path (optional, paid):** uncomment the Postgres / Key Value blocks in `apps/server/render.yaml`, set `PERSISTENCE=postgres`, wire `DATABASE_URL`, and optionally `REDIS_URL` for multi-instance fan-out. See [Scaling notes](#-scaling-notes).

### Web → Vercel

1. **Add New → Project**, import the repo, and set **Root Directory** to `apps/web`. `apps/web/vercel.json` builds through Turbo, so `packages/shared` is built first, and `turbo-ignore` skips deploys when nothing relevant changed.
2. Environment variables:
   - `NEXT_PUBLIC_WS_URL=wss://liveboard-sync.onrender.com`
   - `LIVEBOARD_JWT_SECRET=<same secret as Render>`
3. Deploy, then add the production domain to Render's `ALLOWED_ORIGINS`.

---

## 📈 Scaling notes

- **One instance** handles many rooms. Each room is a `Y.Doc` in memory, evicted after it has been empty for `ROOM_IDLE_MS`.
- **Several instances:** set `REDIS_URL` and raise the instance count on Render. Users in the same room may hit different instances. Each instance publishes the updates and awareness changes from its own clients to `liveboard:room:<id>` and applies what the others publish, tagged with a remote origin so nothing is persisted twice or echoed back.
- **Postgres is the source of durability; Redis is only fan-out.** Compaction reads from the database (not from one instance's memory) under a per-room advisory lock, so it's safe with concurrent writers.
- **Next steps:** resync-on-subscribe to close the small window between an instance loading a room and receiving pub/sub, room-affinity routing (consistent hashing by room id) to cut cross-instance traffic, and server-side validation of update contents.
- No benchmarks are published yet. Add real measurements from the planned load-test script (M6) instead of estimates.

---

## 🗺️ Roadmap

- [x] **M0:** Monorepo scaffold, shared types, CI, Render Blueprint
- [x] **M1:** Freehand strokes, live cursors, presence, undo/redo, eraser, offline + reconnect
- [ ] **M2:** Postgres persistence verified on Render, graceful deploys, restart survival
- [ ] **M3:** Shapes and sticky notes (`Y.Map` + `Y.Text`), selection and transform handles
- [ ] **M4:** Infinite canvas: pan/zoom, viewport culling, minimap
- [ ] **M5:** Real auth, board ACLs, viewer/editor share links
- [ ] **M6:** Multi-instance on Render with Redis, resync-on-subscribe, load testing
- [ ] **M7:** PNG/SVG export, dark mode, mobile/pen polish, a11y, observability, demo media

---

## 📄 License

[MIT](./LICENSE) © 2026 Kei ([@keix40](https://github.com/keix40))
