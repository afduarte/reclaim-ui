// Shared generation loop used by the CLI and by the showcase dev middleware.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildThemeCSS, contrastReport } from "./index.mjs";
import { listThemeFiles, readThemeWithInheritance } from "./files.mjs";

export function runGenerate(themesDir) {
  const results = [];
  for (const file of listThemeFiles(themesDir)) {
    const theme = readThemeWithInheritance(themesDir, file);
    const css = buildThemeCSS(theme);
    const cssOut = path.join(themesDir, `${theme.name}.rc.css`);
    writeFileSync(cssOut, `/* GENERATED FROM ${path.basename(file)} — do not edit. Run: npm run gen */\n${css}`);
    const rows = contrastReport(theme);
    writeFileSync(
      path.join(themesDir, `${theme.name}.report.json`),
      JSON.stringify({ generatedFrom: path.basename(file), theme: theme.name, rows }, null, 2),
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
