// Theme store: loads generated CSS, handles theme/mode switching, and is the
// single write path to the repo (POST -> write-through middleware -> regen).
import { reactive, computed, watch } from "vue";

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

watch(() => [state.theme, state.dark], applyThemeAttrs);

export function applyThemeAttrs() {
  const el = document.documentElement;
  el.dataset.rcTheme = state.theme;
  el.classList.toggle("dark", state.dark);
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
    if (resolved) state.resolved[name] = resolved;
    if (report) state.reports[name] = report.rows;
  } catch {
    /* dev-only endpoints; static glob data remains usable */
  }
}

/** editor works on the *resolved* theme (inherits flattened) */
export const workingTheme = computed(
  () => state.resolved[state.theme] ?? structuredClone(state.rawTokens[state.theme] ?? {}),
);

export const contrastRows = computed(() => state.reports[state.theme] ?? []);

export async function setTheme(name) {
  state.theme = name;
  applyThemeAttrs();
  await refreshTheme(name);
}

export async function initAll() {
  for (const n of themeNames.value) await refreshTheme(n);
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
  state.rawTokens[name] = tokens;
  state.resolved[name] = tokens;
  state.notice = `Saved themes/${name}.tokens.json`;
  state.dirty = false;
  return true;
}

export async function forkTheme(from, newName) {
  const base = state.resolved[from] ?? state.rawTokens[from];
  const tokens = { ...structuredClone(base), name: newName, inherits: null };
  const ok = await saveTheme(tokens);
  if (ok) await setTheme(newName);
  return ok;
}
