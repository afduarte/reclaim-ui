import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sparsePatch } from "@reclaim/tokens";
import { readThemeWithInheritance } from "@reclaim/tokens/files.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const themesDir = path.resolve(here, "../../themes");
const genCli = path.resolve(here, "../../packages/tokens/cli.mjs");

/**
 * Regenerate in a FRESH node process. The dev server's own module cache would
 * otherwise keep serving a stale copy of the compiler after engine edits —
 * silent data corruption on every save. ~100ms per save, worth it.
 */
function regenerate() {
  execFileSync(process.execPath, [genCli], { stdio: "pipe" });
}

/**
 * Write-through API: POST /api/themes/:name { tokens } -> themes/<name>.tokens.json
 * -> regenerate .rc.css synchronously -> return the contrast report.
 * The editor writes WHOLE theme files (not one-off styles); every change is a
 * normal repo edit, so git history is the audit trail of the design system.
 */
function themeWriter() {
  return {
    name: "reclaim-theme-writer",
    configureServer(server) {
      server.middlewares.use("/api/themes/", (req, res) => {
        const parts = req.url.split("?")[0].split("/").filter(Boolean); // [name, sub?]
        const [name, sub] = parts;
        if (req.method === "GET" && /^[a-z0-9-]{2,40}$/.test(name)) {
          try {
            if (sub === "css") {
              res.setHeader("content-type", "text/css");
              return res.end(readFileSync(path.join(themesDir, `${name}.rc.css`), "utf8"));
            }
            if (sub === "resolved") {
              res.setHeader("content-type", "application/json");
              const file = path.join(themesDir, `${name}.tokens.json`);
              return res.end(JSON.stringify(readThemeWithInheritance(themesDir, file)));
            }
            if (sub === "report") {
              res.setHeader("content-type", "application/json");
              return res.end(readFileSync(path.join(themesDir, `${name}.report.json`), "utf8"));
            }
          } catch {
            res.statusCode = 404;
            return res.end();
          }
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const name = req.url.split("?")[0].split("/").filter(Boolean).pop();
            if (!/^[a-z0-9-]{2,40}$/.test(name)) throw new Error("invalid theme name");
            const { tokens } = JSON.parse(body);
            if (!tokens || tokens.name !== name) throw new Error("theme name mismatch");
            const file = path.join(themesDir, `${name}.tokens.json`);
            let out = tokens;
            if (existsSync(file)) {
              const existingRaw = JSON.parse(readFileSync(file, "utf8"));
              const parentName = existingRaw.inherits ?? tokens.inherits;
              if (parentName) {
                const parentFull = readThemeWithInheritance(
                  themesDir,
                  path.join(themesDir, `${parentName}.tokens.json`),
                );
                out = { name, inherits: parentName, ...sparsePatch(tokens, parentFull) };
              }
            }
            writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
            regenerate();
            const report = JSON.parse(readFileSync(path.join(themesDir, `${name}.report.json`), "utf8"));
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, report: { theme: name, fails: report.rows.filter((r) => !r.pass) } }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), themeWriter()],
  root: here,
  server: {
    port: 5273,
    watch: {
      // regenerated .rc.css outside the app root must still trigger HMR
      ignored: ["!**/themes/**"],
    },
  },
});


