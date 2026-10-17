import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync(".sites-runtime", { recursive: true });
await build({
  stdin: {
    contents:
      'export * from "./lib/domain.ts"; export * from "./lib/catalog.ts"; export * from "./lib/validation.ts"; export * from "./lib/i18n.ts";',
    resolveDir: process.cwd(),
  },
  outfile: ".sites-runtime/test-domain.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const result = spawnSync(
  process.execPath,
  ["--test", "tests/domain.test.mjs"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
