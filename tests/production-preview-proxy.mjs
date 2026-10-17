// Local QA only. Emulates the trusted identity supplied by Sites to the built Worker.
// Never deploy this proxy. It binds to loopback and forwards only to the local preview.
import { createServer } from "node:http";
createServer(async (request, response) => {
  try {
    if (
      request.headers.origin &&
      request.headers.origin !== "http://127.0.0.1:5173"
    ) {
      response.writeHead(403);
      response.end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 524288) throw new Error("Too large");
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers))
      if (
        value &&
        !["host", "connection", "content-length", "accept-encoding"].includes(
          key,
        )
      )
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    headers.set("oai-authenticated-user-id", "local_seedy");
    headers.set("oai-authenticated-user-email", "seedy@sites.test");
    headers.set("oai-authenticated-user-full-name", "Seedy");
    if (headers.has("origin")) headers.set("origin", "http://127.0.0.1:5174");
    const result = await fetch(`http://127.0.0.1:5174${request.url}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : Buffer.concat(chunks),
      redirect: "manual",
    });
    const outputHeaders = Object.fromEntries(result.headers);
    delete outputHeaders["content-encoding"];
    delete outputHeaders["content-length"];
    delete outputHeaders["transfer-encoding"];
    response.writeHead(result.status, outputHeaders);
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.writeHead(503, { "content-type": "text/plain" });
    response.end("Local preview is disconnected.");
  }
}).listen(5173, "127.0.0.1", () =>
  console.log(
    "Production-build QA proxy on http://127.0.0.1:5173 (loopback identity emulation only)",
  ),
);
