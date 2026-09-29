import net from "node:net";

/**
 * TCP proxy that forwards payload bytes. After the WebSocket upgrade (HTTP 101), it stops
 * forwarding server FIN to the client — simulating Render-style half-open browser sockets.
 */
export async function startFinBlockingProxy(target: { host: string; port: number }): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = net.createServer((client) => {
    const upstream = net.connect(target);
    let blockServerFin = false;

    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());

    client.on("data", (chunk) => {
      if (!upstream.destroyed) upstream.write(chunk);
    });

    upstream.on("data", (chunk) => {
      if (!blockServerFin && chunk.includes("101")) blockServerFin = true;
      if (!client.destroyed) client.write(chunk);
    });

    upstream.on("end", () => {
      if (!blockServerFin && !client.destroyed) client.end();
    });
    upstream.on("close", () => {
      if (!blockServerFin && !client.destroyed) client.destroy();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
