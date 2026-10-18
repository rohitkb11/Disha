import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { projectRoot } from "./sites-env.mjs";

const table = "disha_local_migrations";
const migrationDir = path.join(projectRoot, "drizzle");
const wrangler = path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const schemaQuery = "SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY name";
const applicationSchema = (rows) => rows
  .filter((row) => !row.name.startsWith("_") && !row.name.startsWith("sqlite_") && ![table, "d1_migrations"].includes(row.name))
  .map((row) => [row.name, row.sql.replace(/[\s`";]+/g, "").toLowerCase()])
  .sort(([a], [b]) => a.localeCompare(b));

export function runWrangler(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: projectRoot, env: { ...process.env, CI: "true" },
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
    encoding: "utf8", timeout: 120000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || "");
    throw new Error(`Local Wrangler command failed (${result.status}).`);
  }
  return capture ? result.stdout : undefined;
}

// Local only: a separate config prevents accidental remote database changes.
// Validate known legacy schemas before adopting migrations formerly run by hand.
export function migrateLocalDatabase({
  persistTo = path.join(projectRoot, ".wrangler/state"),
  configDir = path.join(projectRoot, ".sites-runtime/local-db"),
} = {}) {
  mkdirSync(configDir, { recursive: true });
  const config = path.join(configDir, "wrangler.json");
  writeFileSync(config, JSON.stringify({
    name: "disha-local-database", compatibility_date: "2026-05-15",
    d1_databases: [{
      binding: "DB", database_name: "site-creator-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: migrationDir, migrations_table: table,
    }],
  }, null, 2));
  const flags = ["--local", "--config", config, "--persist-to", path.resolve(persistTo)];
  const query = (sql) => JSON.parse(runWrangler([
    "d1", "execute", "DB", ...flags, "--command", sql, "--json",
  ], { capture: true }))[0].results;
  const current = JSON.stringify(applicationSchema(query(schemaQuery)));
  const files = readdirSync(migrationDir).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
  const reference = new DatabaseSync(":memory:");
  let applied = current === JSON.stringify([]) ? 0 : -1;
  try {
    for (const [index, file] of files.entries()) {
      reference.exec(readFileSync(path.join(migrationDir, file), "utf8"));
      if (JSON.stringify(applicationSchema(reference.prepare(schemaQuery).all())) === current)
        applied = index + 1;
    }
  } finally { reference.close(); }
  if (applied < 0)
    throw new Error("The local database does not match a known migration. No application data was changed. Back it up and inspect its schema before continuing.");
  if (applied > 0) {
    query(`CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);` +
      files.slice(0, applied).map((file) => `INSERT OR IGNORE INTO ${table}(name) VALUES ('${file.replaceAll("'", "''")}');`).join("\n"));
    console.log(`Recognized ${applied} existing local migration(s); application records are preserved.`);
  }
  runWrangler(["d1", "migrations", "apply", "DB", ...flags]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { migrateLocalDatabase(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
