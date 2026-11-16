// Node-side helpers: reading theme files from disk (keep out of browser bundles).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { resolveTheme } from "./index.mjs";

export function listThemeFiles(themesDir) {
  return readdirSync(themesDir)
    .filter((f) => f.endsWith(".tokens.json"))
    .map((f) => path.join(themesDir, f));
}

export function readThemeWithInheritance(themesDir, file) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return resolveTheme(raw, (parentName) =>
    readThemeWithInheritance(themesDir, path.join(themesDir, `${parentName}.tokens.json`)),
  );
}
