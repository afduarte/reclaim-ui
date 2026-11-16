// Theme store: loads generated CSS, handles theme/mode switching, and is the
// single write path to the repo (POST -> write-through middleware -> regen).
import { reactive, computed, watch, toRaw } from "vue";
import { themeVars } from "@reclaim/tokens";

/** Proxy-safe deep clone (structuredClone refuses reactive Proxies). */
export const plain = (v) => (v == null ? v : JSON.parse(JSON.stringify(toRaw(v))));

// Curated "ship" fonts, lazy-loaded when a theme actually uses them.
// Keys must match the family names stored in theme.fonts.
export const FONT_LOADERS = {
  "Fraunces": () => import("@fontsource-variable/fraunces/index.css"),
  "Archivo": () => import("@fontsource-variable/archivo/index.css"),
  "Bricolage Grotesque": () => import("@fontsource-variable/bricolage-grotesque/index.css"),
  "Space Grotesk": () => import("@fontsource-variable/space-grotesk/index.css"),
  "Sora": () => import("@fontsource-variable/sora/index.css"),
  "Outfit": () => import("@fontsource-variable/outfit/index.css"),
  "Newsreader": () => import("@fontsource-variable/newsreader/index.css"),
  "Source Serif 4": () => import("@fontsource-variable/source-serif-4/index.css"),
  "Public Sans": () => import("@fontsource-variable/public-sans/index.css"),
  "Figtree": () => import("@fontsource-variable/figtree/index.css"),
  "Albert Sans": () => import("@fontsource-variable/albert-sans/index.css"),
  "Geist": () => import("@fontsource-variable/geist/index.css"),
  "Instrument Sans": () => import("@fontsource-variable/instrument-sans/index.css"),
  "JetBrains Mono": () => import("@fontsource-variable/jetbrains-mono/index.css"),
  "Inconsolata": () => import("@fontsource-variable/inconsolata/index.css"),
  "Victor Mono": () => import("@fontsource-variable/victor-mono/index.css"),
};
const loadedFonts = new Set();
/** Load one curated family and resolve when its glyphs are actually usable. */
export function loadFont(family) {
  const loader = FONT_LOADERS[family];
  if (!loader) return Promise.resolve();
  const ready = loadedFonts.has(family)
    ? Promise.resolve()
    : loader().then(() => { loadedFonts.add(family); return document.fonts.ready; });
  return ready.then(() => document.fonts.load(`16px "${family}"`, "AaBb0123"));
}
export function ensureFonts(theme) {
  for (const family of Object.values(theme?.fonts ?? {})) {
    if (!family || loadedFonts.has(family) || !FONT_LOADERS[family]) continue;
    loadFont(family).catch(() => loadedFonts.delete(family));
  }
}

const cssModules = import.meta.glob("../../../themes/*.rc.css", {
  query: "?raw",
  import: "default",
  eager: true,
});
const tokenModules = import.meta.glob("../../../themes/*.tokens.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

function nameOf(p) {
  return p.split("/").pop().replace(/\.(rc\.css|tokens\.json)$/, "");
}

export const state = reactive({
  theme: "base",
  dark: false,
  /** name -> raw generated css */
  css: Object.fromEntries(Object.entries(cssModules).map(([p, v]) => [nameOf(p), v])),
  /** name -> raw tokens file content (sparse; overrides only) */
  rawTokens: Object.fromEntries(Object.entries(tokenModules).map(([p, v]) => [nameOf(p), JSON.parse(v)])),
  /** name -> fully resolved theme (from the dev API when available) */
  resolved: {},
  /** name -> contrast report rows */
  reports: {},
  dirty: false,
  notice: "",
});

export const themeNames = computed(() => Object.keys(state.css).sort());

watch(() => [state.theme, state.dark], () => { clearPreview(); applyThemeAttrs(); });

export function applyThemeAttrs() {
  const el = document.documentElement;
  el.dataset.rcTheme = state.theme;
  el.classList.toggle("dark", state.dark);
}

// ---- live preview ----------------------------------------------------------
// While the editor is mid-drag, vars are applied as INLINE styles on <html>:
// highest specificity, zero stylesheet churn, so nothing reflows under the
// pointer. The debounced save still writes the file; on completion the preview
// is cleared and the regenerated theme CSS takes over seamlessly (same values).
let previewKeys = [];
export function previewTheme(theme) {
  const el = document.documentElement;
  clearPreview();
  const vars = themeVars(theme, state.dark ? "dark" : "light");
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
    previewKeys.push(k);
  }
}
export function clearPreview() {
  const el = document.documentElement;
  for (const k of previewKeys) el.style.removeProperty(k);
  previewKeys = [];
}

function inject(name, css) {
  let el = document.getElementById(`rc-theme-${name}`);
  if (!el) {
    el = document.createElement("style");
    el.id = `rc-theme-${name}`;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function installThemeStyles() {
  for (const [name, css] of Object.entries(state.css)) inject(name, css);
}

async function refreshTheme(name) {
  try {
    const [css, resolved, report] = await Promise.all([
      fetch(`/api/themes/${name}/css`).then((r) => (r.ok ? r.text() : null)),
      fetch(`/api/themes/${name}/resolved`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/themes/${name}/report`).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (css) {
      state.css[name] = css;
      inject(name, css);
    }
    if (resolved) {
      state.resolved[name] = resolved;
      ensureFonts(resolved);
    }
    if (report) state.reports[name] = report.rows;
  } catch {
    /* dev-only endpoints; static glob data remains usable */
  }
}

/** editor works on the *resolved* theme (inherits flattened) */
export const workingTheme = computed(() => {
  const r = state.resolved[state.theme];
  if (r) return plain(r);
  return plain(state.rawTokens[state.theme] ?? {});
});

export const contrastRows = computed(() => state.reports[state.theme] ?? []);

export async function setTheme(name) {
  state.theme = name;
  clearPreview();
  applyThemeAttrs();
  await refreshTheme(name);
}

export async function initAll() {
  for (const n of themeNames.value) {
    ensureFonts(state.rawTokens[n]);
    await refreshTheme(n);
  }
  applyThemeAttrs();
}

/**
 * Persist the *full* working theme as the theme's own file (no inheritance
 * assumptions), then pull back regenerated CSS + contrast report.
 */
export async function saveTheme(tokens) {
  const name = tokens.name;
  const res = await fetch(`/api/themes/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tokens }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    state.notice = `Save failed: ${data.error ?? res.status}`;
    return false;
  }
  await refreshTheme(name);
  clearPreview(); // regenerated file CSS now matches the preview exactly
  state.rawTokens[name] = tokens;
  state.resolved[name] = tokens;
  state.notice = `Saved themes/${name}.tokens.json`;
  state.dirty = false;
  return true;
}

export async function forkTheme(from, newName) {
  const base = plain(state.resolved[from] ?? state.rawTokens[from] ?? {});
  const tokens = { ...base, name: newName, inherits: null };
  const ok = await saveTheme(tokens);
  if (ok) await setTheme(newName);
  return ok;
}
