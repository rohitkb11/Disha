export const MAX_REQUEST_BYTES = 524288;

function failure(status: number, error: string) {
  return Response.json({ error }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function mutationGuard(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw failure(403, "Cross-origin writes are not allowed.");
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json")
    throw failure(415, "JSON content type required.");
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES)
    throw failure(413, "Request too large.");
}

// Count wire bytes while reading, including requests without Content-Length.
// Accumulating request.text() first would allow an unbounded allocation and
// counting string characters would undercount Hindi/Marathi UTF-8 payloads.
export async function readBoundedText(
  input: Request | Response,
  limit = MAX_REQUEST_BYTES,
  status = 413,
  message = "Request too large.",
) {
  if (!input.body) return "";
  const reader = input.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  let oversized = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        oversized = true;
        text = "";
        // Drain a small rejected request without retaining its contents. This
        // keeps workerd's HTTP connection usable. Never drain an unbounded
        // upload or an external provider response.
        if (!(input instanceof Request) || bytes > limit * 2) {
          await reader.cancel().catch(() => {});
          throw failure(status, message);
        }
        continue;
      }
      text += decoder.decode(value, { stream: true });
    }
    if (oversized) throw failure(status, message);
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readJson(request: Request) {
  const body = await readBoundedText(request);
  // Consume bounded input before throwing a header/authentication rejection.
  // Some Worker runtimes otherwise leave the next keep-alive request unusable.
  mutationGuard(request);
  try {
    return JSON.parse(body);
  } catch {
    throw failure(400, "Invalid JSON.");
  }
}
