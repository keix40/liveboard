import { loadConfig } from "./config.js";
import { createSyncServer } from "./server.js";

const cfg = loadConfig();
const server = createSyncServer(cfg);

await server.listen();

// Render sends SIGTERM on deploy/scale-down: close sockets with 1001 so clients
// reconnect (to the new instance) and flush pending writes before exiting.
let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await server.close();
    process.exit(0);
  });
}
