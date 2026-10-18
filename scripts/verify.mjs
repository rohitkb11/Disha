import { spawnSync } from "node:child_process";
import { projectRoot } from "./sites-env.mjs";

// Use Node entrypoints directly, so this works in PowerShell and POSIX shells.
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["scripts/test.mjs"],
  ["scripts/run-framework.mjs", "build"],
  ["scripts/offline-assets.mjs"],
  ["scripts/test-integration.mjs"],
]) {
  console.log(`\nVerifying: node ${args.join(" ")}`);
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("\nDisha submission verification passed.");
