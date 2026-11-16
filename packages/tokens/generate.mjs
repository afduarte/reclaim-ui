// Shared generation loop used by the CLI and by the showcase dev middleware.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildThemeCSS, contrastReport } from "./index.mjs";
import { listThemeFiles, readThemeWithInheritance } from "./files.mjs";

// write only when content actually changed — keeps git status honest and
// avoids churn that a watching dev server would mistake for real edits
function writeIfChanged(file, content) {
  try {
    if (readFileSync(file, "utf8") === content) return false;
  } catch {}
  writeFileSync(file, content);
  return true;
}

export function runGenerate(themesDir) {
  const results = [];
  for (const file of listThemeFiles(themesDir)) {
    const theme = readThemeWithInheritance(themesDir, file);
    const css = buildThemeCSS(theme);
    writeIfChanged(
      path.join(themesDir, `${theme.name}.rc.css`),
      `/* GENERATED FROM ${path.basename(file)} — do not edit. Run: npm run gen */\n${css}`,
    );
    const rows = contrastReport(theme);
    writeIfChanged(
      path.join(themesDir, `${theme.name}.report.json`),
      JSON.stringify({ generatedFrom: path.basename(file), theme: theme.name, rows }, null, 2) + "\n",
    );
    const fails = rows.filter((r) => !r.pass);
    results.push({ theme: theme.name, fails });
  }
  return results;
}

export function reportLines(results) {
  return results.map((r) =>
    r.fails.length === 0
      ? `[${r.theme}] ✓ AA clean`
      : `[${r.theme}] ⚠ ${r.fails.length} contrast fail(s)\n` +
        r.fails.map((f) => `   ✗ ${f.mode} ${f.pair}: ${f.ratio} < ${f.need}`).join("\n"),
  );
}
