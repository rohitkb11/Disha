import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist/client");
async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".")) found.push(...(await walk(file)));
    } else if (
      /\.(?:js|css|svg|woff2?)$/.test(entry.name) &&
      entry.name !== "sw.js"
    )
      found.push(`/${path.relative(root, file).replaceAll("\\", "/")}`);
  }
  return found;
}
const assets = await walk(root);
await writeFile(
  path.join(root, "offline-assets.json"),
  JSON.stringify({ assets }),
);
console.log(`Offline asset manifest: ${assets.length} files.`);
