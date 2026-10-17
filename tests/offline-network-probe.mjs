// Development-only diagnostic: identifies uncached asset requests while the real server is stopped.
import { createServer } from "node:http";
createServer((request, response) => {
  console.log(request.method, request.url);
  response.writeHead(503, { "content-type": "text/plain" });
  response.end("Offline verification: development server stopped.");
}).listen(5173, "127.0.0.1", () =>
  console.log("Offline asset probe on loopback port 5173"),
);
