import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REQUEST_BYTES, mutationGuard, readBoundedText, readJson } from "../.sites-runtime/test-domain.mjs";

const request = (body, headers = {}) => new Request("http://127.0.0.1:5174/api/sync", {
  method: "POST", body, duplex: "half",
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});
const rejection = (status) => (error) => {
  assert.ok(error instanceof Response);
  assert.equal(error.status, status);
  assert.match(error.headers.get("content-type"), /application\/json/);
  assert.equal(error.headers.get("cache-control"), "no-store");
  return true;
};

test("JSON writes require an exact media type and the same origin", () => {
  mutationGuard(request("{}"));
  mutationGuard(request("{}", { "content-type": "Application/JSON" }));
  for (const value of ["text/plain", "application/jsonp", "text/plain; application/json"])
    assert.throws(() => mutationGuard(request("{}", { "content-type": value })), rejection(415));
  assert.throws(() => mutationGuard(request("{}", { origin: "https://untrusted.example" })), rejection(403));
  assert.throws(() => mutationGuard(request("{}", { "content-length": String(MAX_REQUEST_BYTES + 1) })), rejection(413));
});

test("body limits count UTF-8 bytes even when Content-Length is missing", async () => {
  const body = JSON.stringify({ text: "द".repeat(180000) });
  assert.ok(body.length < MAX_REQUEST_BYTES);
  await assert.rejects(readJson(request(body)), rejection(413));
  assert.equal(await readBoundedText(new Response("abcd"), 4), "abcd");
  await assert.rejects(readBoundedText(new Response("abcde"), 4, 502, "Feed too large."), rejection(502));
});

test("streaming decoding preserves regional text across split UTF-8 characters", async () => {
  const body = JSON.stringify({ text: "नमस्ते महाराष्ट्र" });
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  assert.deepEqual(await readJson(request(stream)), JSON.parse(body));
  await assert.rejects(readJson(request("{")), rejection(400));
});

test("oversized streams are cancelled without consuming the rest of the body", async () => {
  let cancelled = false;
  let reads = 0;
  const stream = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readBoundedText(new Response(stream), 10), rejection(413));
  assert.equal(cancelled, true);
  assert.equal(reads, 2);
});

test("rejected requests drain only a bounded allowance to keep HTTP connections usable", async () => {
  let reads = 0;
  const stream = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array(8));
      if (reads === 2) controller.close();
    },
  }, { highWaterMark: 0 });
  await assert.rejects(readBoundedText(request(stream), 10), rejection(413));
  assert.equal(reads, 2);
  let cancelled = false;
  reads = 0;
  const endless = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readBoundedText(request(endless), 10), rejection(413));
  assert.equal(cancelled, true);
  assert.equal(reads, 3);
});
