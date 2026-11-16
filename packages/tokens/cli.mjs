#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { runGenerate, reportLines } from "./generate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const themesDir = path.join(root, "themes");
if (!existsSync(themesDir)) {
  console.error(`No themes/ directory at ${themesDir}`);
  process.exit(1);
}
const results = runGenerate(themesDir);
for (const line of reportLines(results)) console.log(line);
console.log(`Generated ${results.length} theme(s): ${results.map((r) => r.theme).join(", ")}`);
process.exit(0); // contrast failures are loud warnings; enforce later in CI once tuned
