import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./sites-env.mjs";
import { migrateLocalDatabase } from "./local-db.mjs";

const serverConfigPath = path.join(projectRoot, "dist/server/wrangler.json");
let built;
try { built = JSON.parse(readFileSync(serverConfigPath, "utf8")); }
catch { throw new Error("Build the production Worker first with npm run build."); }
mkdirSync(path.join(projectRoot, ".sites-runtime"), { recursive: true });
const runDir = mkdtempSync(path.join(projectRoot, ".sites-runtime/http-"));
const persistTo = path.join(runDir, "state");
migrateLocalDatabase({ persistTo, configDir: path.join(runDir, "database") });
// A second call checks that migration tracking is safe to repeat.
migrateLocalDatabase({ persistTo, configDir: path.join(runDir, "database") });

// Use a secret-free config: developer .dev.vars and provider settings must not
// affect the checkout-independent test fixtures or cause real provider calls.
const config = path.join(runDir, "worker.json");
writeFileSync(config, JSON.stringify({
  name: "disha-integration", main: path.resolve(path.dirname(serverConfigPath), built.main),
  compatibility_date: built.compatibility_date, compatibility_flags: built.compatibility_flags,
  no_bundle: true, rules: built.rules,
  assets: { directory: path.resolve(path.dirname(serverConfigPath), built.assets.directory) },
  d1_databases: built.d1_databases, vars: {},
}, null, 2));
writeFileSync(path.join(runDir, ".dev.vars"), "# Integration tests use no provider credentials.\n");
const port = await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const port = socket.address().port;
    socket.close((error) => error ? reject(error) : resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;
let output = "";
let spawnError;
const worker = spawn(process.execPath, [
  "--import", pathToFileURL(path.join(projectRoot, "scripts/sites-env.mjs")).href,
  path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
  "dev", "--config", config, "--local", "--persist-to", persistTo,
  "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", "0",
], { cwd: projectRoot, env: { ...process.env, CI: "true" }, stdio: ["ignore", "pipe", "pipe"] });
worker.on("error", (error) => { spawnError = error; });
for (const stream of [worker.stdout, worker.stderr]) stream.on("data", (chunk) => {
  output = (output + chunk.toString()).slice(-20000);
});
let stopping;
function stop() {
  return stopping ||= (async () => {
    if (worker.exitCode !== null || worker.signalCode !== null || spawnError) return;
    const exited = new Promise((resolve) => worker.once("exit", resolve));
    worker.kill("SIGTERM");
    const timeout = setTimeout(() => worker.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timeout);
  })();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  void stop().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
});
try {
  const deadline = Date.now() + 60000;
  while (true) {
    if (spawnError) throw spawnError;
    if (worker.exitCode !== null || worker.signalCode !== null) throw new Error("Compiled Worker exited before readiness.");
    try {
      const response = await fetch(`${base}/api/catalog`, { signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).careers?.length) break;
    } catch { /* Worker startup is asynchronous. */ }
    if (Date.now() > deadline) throw new Error("Compiled Worker did not become ready within 60 seconds.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(`Testing the compiled Worker at ${base} with an isolated local database.`);
  const result = await new Promise((resolve, reject) => {
    const test = spawn(process.execPath, ["tests/roles-api.mjs"], {
      cwd: projectRoot, env: { ...process.env, DISHA_ROLE_TEST_URL: base }, stdio: "inherit",
    });
    const timeout = setTimeout(() => { test.kill(); reject(new Error("HTTP tests exceeded two minutes.")); }, 120000);
    test.once("error", (error) => { clearTimeout(timeout); reject(error); });
    test.once("exit", (code) => { clearTimeout(timeout); resolve(code); });
  });
  if (result !== 0) throw new Error(`HTTP tests failed (${result}).`);
  console.log("PASS: isolated database initialization, repeat migration, and compiled Worker integration checks.");
} catch (error) {
  console.error(output);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop();
}
