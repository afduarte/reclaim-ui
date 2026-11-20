#!/usr/bin/env node
// Builds dist/ as a static, CLI-compatible registry (tested against shadcn-vue 2.9).
//   npx shadcn-vue@latest add @reclaim/button      -> files with inlined content
//   base themes ship via cssVars (@theme/:root/.dark) + css (@layer base, component
//   classes, font @imports) so nothing depends on file placement quirks.
// Host dist/ over any static HTTP. Bare-name registryDependencies resolve against
// shadcn's own registry, so self-references are absolute URLs (built from HOME).
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { themeCSSVars, buildThemeCSS } from "@reclaim/tokens";
import { listThemeFiles, readThemeWithInheritance } from "@reclaim/tokens/files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const themesDir = path.join(root, "themes");
const uiDir = path.join(root, "packages/ui/src");
const out = path.join(root, "packages/registry/dist");
const HOME = process.env.RECLAIM_REGISTRY_HOME || "https://afduarte.github.io/reclaim-ui";
const SELF_LIB = `${HOME}/r/reclaim-lib.json`;

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "r"), { recursive: true });

// ---------------------------------------------------------------------------
// Mini CSS -> object parser for the `css` field. Requirements for input:
// flat declarations; one level of nesting allowed (@layer { rule { decls } }).
// ---------------------------------------------------------------------------
function parseCss(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const out = {};
  let i = 0;
  function readBlock(endAtBrace) {
    const obj = {};
    while (i < clean.length) {
      while (i < clean.length && /\s/.test(clean[i])) i++;
      if (clean[i] === "}" && endAtBrace) { i++; return obj; }
      if (i >= clean.length) return obj;
      const brace = clean.indexOf("{", i);
      const semi = clean.indexOf(";", i);
      if (brace === -1) break;
      if (semi !== -1 && semi < brace) {
        // declaration
        const decl = clean.slice(i, semi).trim();
        const colon = decl.indexOf(":");
        obj[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
        i = semi + 1;
      } else {
        const selector = clean.slice(i, brace).trim();
        i = brace + 1;
        obj[selector] = readBlock(true);
      }
    }
    return obj;
  }
  return readBlock(false);
}

const bridgeSrc = readFileSync(path.join(uiDir, "styles/tailwind.css"), "utf8");
const bridgeBody = bridgeSrc.replace(/@import "tailwindcss";\n/, "");
const bridgeCssObj = parseCss(bridgeBody);
// @theme inline handled via cssVars.theme; component/base rules via css field
const { "@theme inline": themeBridge, ...bridgeForCss } = bridgeCssObj;

// ---------------------------------------------------------------------------
// Fonts: curated ship list (@fontsource-variable). Anything else is a
// documented escape hatch that hot-links Google Fonts (exploration only).
// ---------------------------------------------------------------------------
const CURATED_FONTS = {
  "Fraunces": "@fontsource-variable/fraunces",
  "Archivo": "@fontsource-variable/archivo",
  "Bricolage Grotesque": "@fontsource-variable/bricolage-grotesque",
  "Space Grotesk": "@fontsource-variable/space-grotesk",
  "Sora": "@fontsource-variable/sora",
  "Outfit": "@fontsource-variable/outfit",
  "Newsreader": "@fontsource-variable/newsreader",
  "Source Serif 4": "@fontsource-variable/source-serif-4",
  "Public Sans": "@fontsource-variable/public-sans",
  "Figtree": "@fontsource-variable/figtree",
  "Albert Sans": "@fontsource-variable/albert-sans",
  "Geist": "@fontsource-variable/geist",
  "Instrument Sans": "@fontsource-variable/instrument-sans",
  "JetBrains Mono": "@fontsource-variable/jetbrains-mono",
  "Inconsolata": "@fontsource-variable/inconsolata",
  "Victor Mono": "@fontsource-variable/victor-mono",
};

const fontWarnings = [];
function fontCss(theme) {
  const css = {};
  const deps = [];
  for (const family of Object.values(theme.fonts)) {
    if (!family) continue;
    if (CURATED_FONTS[family]) {
      const pkg = CURATED_FONTS[family];
      css[`@import "${pkg}/index.css"`] = {};
      deps.push(pkg);
    } else {
      css[`@import url("https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:opsz,wght@9..144,300..900&display=swap")`] = {};
      fontWarnings.push(`${theme.name}: "${family}" not in curated ship list — registry hot-links Google Fonts`);
    }
  }
  return { css, deps };
}

// ---------------------------------------------------------------------------
// Theme bases — emitted twice:
//   registry:base  <name>-base   → for `init @reclaim/<name>-base` (full pin)
//   registry:style <name>-style   → for `add` flows; components depend on this
//     so a fresh project gets the theme with zero prompts and zero shadcn
//     base-style pollution (add skips base style when first item is :style).
// ---------------------------------------------------------------------------
const themes = listThemeFiles(themesDir).map((f) => readThemeWithInheritance(themesDir, f));
const baseItems = themes.flatMap((t) => {
  const vars = themeCSSVars(t);
  const strip = (obj, k) => { const { [k]: _d, ...rest } = obj; return rest; };
  const { css: fontCssBlock, deps: fontDeps } = fontCss(t);
  const rulesPath = path.join(root, "themes", `${t.name}.md`);
  const payload = {
    title: `Reclaim — ${t.name}`,
    description: `Reclaim design system base (${t.name} theme): OKLCH tokens, themeable component styles, AA-validated.`,
    homepage: HOME,
    // we ship our own complete css/@theme — suppress shadcn's default style index
    extends: "none",
    dependencies: ["vue", ...fontDeps],
    cssVars: {
      theme: themeBridge ?? {},
      light: strip(vars[":root"], "color-scheme"),
      dark: strip(vars[".dark"], "color-scheme"),
    },
    css: {
      ...fontCssBlock,
      ...bridgeForCss,
      ":root": { "color-scheme": "light" },
      ".dark": { "color-scheme": "dark" },
    },
    // design rules ride along in `docs` — surfaced by registry search + MCP
    ...(existsSync(rulesPath) ? { docs: readFileSync(rulesPath, "utf8") } : {}),
    meta: { theme: t.name, fonts: t.fonts, registryHome: HOME },
  };
  return [
    {
      ...payload,
      name: t.name === "base" ? "base" : `${t.name}-base`,
      type: "registry:base",
      // init @reclaim/<theme> merges this into the consumer's components.json
      config: { style: "new-york", tailwind: { cssVariables: true, baseColor: "neutral" } },
    },
    {
      ...payload,
      name: `${t.name}-style`,
      type: "registry:style",
    },
  ];
});

// ---------------------------------------------------------------------------
// Components — official-style paths; content inlined in /r/<name>.json
// ---------------------------------------------------------------------------
const COMPONENTS = ["Button", "Input", "Select", "Slider", "ColorPicker", "Card", "Badge", "Table", "Checkbox", "Switch", "Alert", "Separator"];
// reka-ui-backed primitives need the primitive library installed in the consumer.
const REKA_COMPONENTS = new Set(["Checkbox", "Switch", "Separator"]);
const componentItems = COMPONENTS.map((name) => {
  const rel = `registry/reclaim/${name.toLowerCase()}/${name}.vue`;
  const content = readFileSync(path.join(uiDir, "components", `${name}.vue`), "utf8")
    .replace('from "../cn"', 'from "@/lib/reclaim/cn.js"')
    .replace('from "../toast.js"', 'from "@/lib/reclaim/toast.js"');
  return {
    name: name.toLowerCase(),
    type: "registry:component",
    title: `Reclaim ${name}`,
    description: `${name} styled with Reclaim semantic tokens; pairs with any @reclaim base.`,
    homepage: HOME,
    registryDependencies: [SELF_LIB],
    ...(REKA_COMPONENTS.has(name) ? { dependencies: ["reka-ui"] } : {}),
    files: [{ type: "registry:component", path: rel, content }],
  };
});

const cnContent = readFileSync(path.join(uiDir, "cn.js"), "utf8");
const libItem = {
  name: "reclaim-lib",
  type: "registry:lib",
  title: "Reclaim class helper",
  description: "cn() utility used by Reclaim components.",
  homepage: HOME,
  dependencies: ["clsx", "tailwind-merge"],
  // path deliberately has no "lib" subdir: CLI appends <commonRoot-tail> under the
  // lib alias, producing src/lib/reclaim/cn.js (matches components' @/lib/reclaim/cn.js import)
  files: [{ type: "registry:lib", path: "registry/reclaim/cn.js", content: cnContent }],
};

// Toast ships as three files: the store (registry:lib, lands at @/lib/reclaim/
// toast.js to match the consumers' import), the Toaster mount, and one Toast.
const rewrite = (text) =>
  text.replace('from "../cn"', 'from "@/lib/reclaim/cn.js"').replace('from "../toast.js"', 'from "@/lib/reclaim/toast.js"');
const toastItem = {
  name: "toast",
  type: "registry:component",
  title: "Reclaim Toast",
  description: "Toast store + <Toaster /> mount, styled with Reclaim semantic tokens (Reka UI).",
  homepage: HOME,
  registryDependencies: [SELF_LIB],
  dependencies: ["reka-ui"],
  files: [
    {
      type: "registry:component",
      path: "registry/reclaim/toast/Toaster.vue",
      content: rewrite(readFileSync(path.join(uiDir, "components", "Toaster.vue"), "utf8")),
    },
    {
      type: "registry:component",
      path: "registry/reclaim/toast/Toast.vue",
      content: rewrite(readFileSync(path.join(uiDir, "components", "Toast.vue"), "utf8")),
    },
    {
      type: "registry:lib",
      path: "registry/reclaim/toast.js",
      content: readFileSync(path.join(uiDir, "toast.js"), "utf8"),
    },
  ],
};

const items = [...baseItems, libItem, ...componentItems, toastItem];

// index (stripped of content, as registries are served) + per-item endpoints
writeFileSync(
  path.join(out, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "reclaim",
      homepage: HOME,
      items: items.map((i) => ({ ...i, files: (i.files ?? []).map(({ content, ...f }) => f) })),
    },
    null,
    2,
  ),
);
for (const item of items) {
  writeFileSync(path.join(out, "r", `${item.name}.json`), JSON.stringify({ $schema: "https://ui.shadcn.com/schema/registry-item.json", ...item }, null, 2));
}

for (const w of fontWarnings) console.warn(`⚠ ${w}`);
console.log(`Registry built → ${out}/registry.json`);
console.log(`  ${themes.length} theme bases: ${baseItems.map((b) => b.name).join(", ")}`);
console.log(`  ${componentItems.length + 1} components + reclaim-lib (content inlined)`);
