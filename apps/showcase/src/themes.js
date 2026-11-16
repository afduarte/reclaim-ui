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
  return ready.then(() =>
    Promise.all([
      document.fonts.load(`16px "${family} Variable"`, "AaBb0123"),
      document.fonts.load(`16px "${family}"`, "AaBb0123"),
    ]),
  );
}
export function ensureFonts(theme) {
  for (const family of Object.values(theme?.fonts ?? {})) {
    if (!family || loadedFonts.has(family) || !FONT_LOADERS[family]) continue;
    loadFont(family).catch(() => loadedFonts.delete(family));
  }
}

export const state = reactive({
  theme: "base",
  dark: false,
  /** name -> raw generated css */
  css: {},
  /** name -> raw tokens file content (sparse; overrides only) */
  rawTokens: {},
  /** name -> fully resolved theme (from the dev API when available) */
  resolved: {},
  /** name -> contrast report rows */
  reports: {},
  /** current unsaved draft (published by the editor for Compare/Checks views) */
  draft: null,
  /** one-click fix awaiting adoption by the editor */
  pendingPatch: null,
  notice: "",
});

export const themeNames = computed(() => Object.keys(state.css).sort());

let bootstrapped = false;
export async function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  let catalog = null;
  try {
    const r = await fetch("/api/themes");
    if (r.ok) catalog = await r.json();
  } catch {
    /* no dev server — fall through to bundled data */
  }
  if (catalog) {
    for (const t of catalog) {
      state.css[t.name] = t.css;
      state.rawTokens[t.name] = t.raw;
      state.resolved[t.name] = t.resolved;
      state.reports[t.name] = t.report;
      ensureFonts(t.resolved);
    }
  } else {
    // The studio IS the dev server's client: saves, resolution, and contrast
    // reports all go through the middleware. No API, no studio — by design.
    state.notice = "dev API unavailable — run the studio with `npm run dev`";
  }
  if (!state.css[state.theme]) state.theme = themeNames.value[0] ?? "base";
  installThemeStyles();
  applyThemeAttrs();
}

/** Checks view requests a fix; the editor adopts it into the draft. */
export function requestPatch(patch) {
  state.pendingPatch = patch;
}


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
  state.draft = null;
  clearPreview();
  applyThemeAttrs();
  await refreshTheme(name);
}

export async function initAll() {
  await bootstrap();
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
  state.rawTokens[name] = tokens;
  state.notice = `Saved themes/${name}.tokens.json`;
  return true;
}

export async function deleteTheme(name) {
  const r = await fetch(`/api/themes/${name}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    state.notice = data.error ?? `delete failed (${r.status})`;
    return false;
  }
  for (const map of [state.css, state.rawTokens, state.resolved, state.reports]) delete map[name];
  document.getElementById(`rc-theme-${name}`)?.remove();
  if (state.theme === name) await setTheme(themeNames.value[0] ?? "base");
  state.notice = `deleted theme "${name}" — recoverable via git`;
  return true;
}

export async function forkTheme(from, newName, draftTokens) {
  const base = plain(draftTokens ?? state.resolved[from] ?? state.rawTokens[from] ?? {});
  const tokens = { ...base, name: newName, inherits: null };
  const ok = await saveTheme(tokens);
  if (ok) await setTheme(newName);
  return ok;
}
