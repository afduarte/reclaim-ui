// @reclaim/tokens — theme compiler: tokens JSON -> runtime CSS vars + contrast report.
// One source of truth: themes/<name>.tokens.json. Components only read --rc-* vars.
// NOTE: this module is browser-safe (the showcase imports it). Filesystem helpers
// live in ./files.mjs.
import { converter, toGamut, formatCss, parse } from "culori";

// ---------------------------------------------------------------------------
// Ramp model: 11 steps (50..950) on a fixed OKLCH lightness curve.
// Themes tune hue + chroma; the curve keeps every ramp AA-legible by design.
// ---------------------------------------------------------------------------
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const L_CURVE = [0.985, 0.962, 0.93, 0.885, 0.82, 0.745, 0.655, 0.525, 0.415, 0.3, 0.165];
// chroma profile: peaks in the middle, low at the paper/ink ends
const C_PROFILE = [0.3, 0.55, 0.75, 0.88, 0.97, 1.0, 1.0, 0.92, 0.78, 0.6, 0.42];

const toSrgb = toGamut("rgb", "oklch");

/** @returns {string} oklch() sRGB-clamped color for a step of the ramp */
function rampColor(hue, chroma, idx, { lightnessScale = 1 } = {}) {
  const l = Math.min(0.994, L_CURVE[idx] * lightnessScale);
  const c = chroma * C_PROFILE[idx];
  const h = chroma <= 0.0015 ? hue : hue; // hue still steers tint even for near-gray
  return formatCss(toSrgb({ mode: "oklch", l, c, h }));
}

/** #rrggbb of a ramp step — lets UIs show/seed color pickers from hue+chroma. */
export function rampHex(hue, chroma, idx) {
  const c = toSrgb({ mode: "oklch", l: L_CURVE[idx], c: chroma * C_PROFILE[idx], h: hue });
  const hex = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

/** Reverse map a picked hex onto ramp parameters. chromaScale < 1 for neutrals. */
export function pickColor(hex, chromaScale = 1) {
  const c = converter("oklch")(parse(hex));
  if (!c) return { hue: 0, chroma: 0 };
  return {
    hue: Math.round((c.h ?? 0) + 360) % 360,
    chroma: round((c.c ?? 0) * chromaScale),
  };
}

function rampVars(prefix, hue, chroma) {
  const out = {};
  STEPS.forEach((step, i) => {
    out[`--rc-${prefix}-${step}`] = rampColor(hue, chroma, i);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Schema defaults. Themes only need to state what differs.
// ---------------------------------------------------------------------------
export const DEFAULT_THEME = {
  name: "base",
  inherits: null,
  fonts: {
    display: "Fraunces",
    text: "Public Sans",
    mono: "JetBrains Mono",
  },
  color: {
    neutral: { hue: 264, chroma: 0.011 },
    accents: {
      brand: { hue: 264, chroma: 0.165 },
      success: { hue: 155, chroma: 0.13 },
      warn: { hue: 85, chroma: 0.15 },
      danger: { hue: 25, chroma: 0.18 },
    },
  },
  scale: { radius: 10, density: 1, shadow: 0.65 },
  type: { base: 16, ratio: 1.2, trackingHeading: -0.015 },
};

export function deepMerge(base, over) {
  if (over === null || typeof over !== "object" || Array.isArray(over)) return structuredClone(over);
  const out = structuredClone(base) ?? {};
  for (const k of Object.keys(over)) out[k] = deepMerge(base?.[k], over[k]);
  return out;
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Minimal object of keys in `full` that differ from `parent` (for sparse theme files). */
export function sparsePatch(full, parent) {
  const diff = (o, p) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === "inherits") continue;
      const pv = p?.[k];
      if (eq(v, pv)) continue;
      if (v && pv && typeof v === "object" && !Array.isArray(v) && typeof pv === "object") {
        const sub = diff(v, pv);
        if (Object.keys(sub).length) out[k] = sub;
      } else {
        out[k] = v;
      }
    }
    return out;
  };
  return diff(full, parent);
}

// ---------------------------------------------------------------------------
// Semantic layer: the only vars components are allowed to reference.
// Mapping is identical in light/dark except the index flips and fg inverts.
// ---------------------------------------------------------------------------
function semanticVars(theme, mode) {
  const light = mode === "light";
  const n = (step) => `var(--rc-neutral-${step})`;
  const a = (key, step) => `var(--rc-${key}-${step})`;
  const pick = (l, d) => (light ? l : d);
  const vars = {
    "--rc-canvas": pick(n(50), n(950)),
    "--rc-surface": pick(n(100), n(900)),
    "--rc-surface-2": pick(n(200), n(800)),
    "--rc-line": pick(n(300), n(700)),
    "--rc-line-strong": pick(n(400), n(600)),
    "--rc-ink": pick(n(950), n(50)),
    "--rc-ink-muted": pick(n(800), n(300)),
    "--rc-ink-faint": pick(n(500), n(500)),
    "--rc-ring": a("brand", pick(600, 500)),
    "--rc-ring-soft": "color-mix(in oklab, var(--rc-ring) 45%, transparent)",
    "--rc-link": pick(a("brand", 700), a("brand", 400)),
    // status defaults used by badges/inputs
    "--rc-focus-alpha": "0.45",
  };
  for (const key of Object.keys(theme.color.accents)) {
    vars[`--rc-${key}`] = a(key, pick(700, 300)); // text/links
    vars[`--rc-${key}-solid`] = a(key, pick(700, 600));
    vars[`--rc-${key}-solid-hover`] = a(key, pick(800, 500));
    vars[`--rc-${key}-solid-ink`] = pick(n(50), n(950));
    vars[`--rc-${key}-soft`] = a(key, pick(100, 900));
    vars[`--rc-${key}-soft-ink`] = a(key, pick(800, 200));
    vars[`--rc-${key}-border`] = a(key, pick(300, 700));
    if (key === "brand") vars["--rc-link"] = `var(--rc-brand)`;
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Type + geometry
// ---------------------------------------------------------------------------
function scaleVars(theme) {
  const { radius, density, shadow } = theme.scale;
  const { base, ratio, trackingHeading } = theme.type;
  const t = (exp) => `${round(base * Math.pow(ratio, exp))}px`;
  // "@fontsource-variable/*" registers families as "<Name> Variable"; plain and
  // Google-loaded names match the bare name. Stacking both makes every source work.
  const stack = (f, generic) => `"${f} Variable", "${f}", ${generic}`;
  const vars = {
    "--rc-font-display": stack(theme.fonts.display, "ui-sans-serif, system-ui, sans-serif"),
    "--rc-font-text": stack(theme.fonts.text, "ui-sans-serif, system-ui, sans-serif"),
    "--rc-font-mono": stack(theme.fonts.mono, "ui-monospace, monospace"),
    "--rc-text-xs": `${round(base * 0.8125)}px`,
    "--rc-text-sm": `${round(base * 0.875)}px`,
    "--rc-text-base": `${round(base)}px`,
    "--rc-text-lg": t(1),
    "--rc-text-xl": t(2),
    "--rc-text-2xl": t(3),
    "--rc-text-3xl": t(4),
    "--rc-text-4xl": t(5),
    "--rc-tracking-heading": `${trackingHeading}em`,
    "--rc-leading-body": "1.55",
    "--rc-leading-heading": "1.12",
    "--rc-radius-sm": `${round(radius * 0.55)}px`,
    "--rc-radius": `${round(radius)}px`,
    "--rc-radius-lg": `${round(radius * 1.65)}px`,
    "--rc-radius-xl": `${round(radius * 2.3)}px`,
    "--rc-density": `${round(density)}`,
    "--rc-control-h": `calc(${round(36 * density)}px)`,
    "--rc-space": `calc(${round(4 * density)}px)`,
    "--rc-shadow-strength": `${round(shadow)}`,
    "--rc-shadow-1": `0 1px 2px oklch(0 0 0 / calc(0.14 * var(--rc-shadow-strength)))`,
    "--rc-shadow-2": `0 4px 12px -2px oklch(0 0 0 / calc(0.18 * var(--rc-shadow-strength))), 0 1px 3px oklch(0 0 0 / calc(0.1 * var(--rc-shadow-strength)))`,
    "--rc-shadow-3": `0 16px 40px -8px oklch(0 0 0 / calc(0.24 * var(--rc-shadow-strength))), 0 3px 8px oklch(0 0 0 / calc(0.12 * var(--rc-shadow-strength)))`,
  };
  return vars;
}

const round = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------
// CSS emission
// ---------------------------------------------------------------------------
function emitBlock(selector, vars) {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

export function buildThemeCSS(theme, scopeSelector = null) {
  const t = structuredClone(theme);
  const vars = {};
  Object.assign(vars, rampVars("neutral", t.color.neutral.hue, t.color.neutral.chroma));
  for (const [key, spec] of Object.entries(t.color.accents)) {
    Object.assign(vars, rampVars(key, spec.hue, spec.chroma));
  }
  const sel = scopeSelector ?? `:root[data-rc-theme="${t.name}"]`;
  const light = { ...vars, ...scaleVars(t), ...semanticVars(t, "light"), "color-scheme": "light" };
  const darkOnly = { ...semanticVars(t, "dark"), "color-scheme": "dark" };
  return `${emitBlock(sel, light)}\n\n${emitBlock(scopeSelector ? ".dark" : `${sel}.dark`, darkOnly)}\n`;
}

/** Flat var map for a resolved theme in a mode — used by the studio's live
 *  preview (applied inline on <html>, no stylesheet round-trip). */
export function themeVars(theme, mode) {
  const vars = {};
  Object.assign(vars, rampVars("neutral", theme.color.neutral.hue, theme.color.neutral.chroma));
  for (const [key, spec] of Object.entries(theme.color.accents)) {
    Object.assign(vars, rampVars(key, spec.hue, spec.chroma));
  }
  Object.assign(vars, scaleVars(theme));
  Object.assign(vars, semanticVars(theme, mode));
  return vars;
}

/** Flat selector->vars map for shadcn registry `css` fields. */
export function themeCSSVars(theme) {
  const vars = {};
  Object.assign(vars, rampVars("neutral", theme.color.neutral.hue, theme.color.neutral.chroma));
  for (const [key, spec] of Object.entries(theme.color.accents)) {
    Object.assign(vars, key === "neutral" ? {} : rampVars(key, spec.hue, spec.chroma));
  }
  Object.assign(vars, scaleVars(theme));
  return {
    ":root": { ...vars, ...semanticVars(theme, "light"), "color-scheme": "light" },
    ".dark": { ...semanticVars(theme, "dark"), "color-scheme": "dark" },
  };
}

// ---------------------------------------------------------------------------
// Contrast validation (WCAG relative luminance on resolved ramps)
// ---------------------------------------------------------------------------
function resolveVarValue(cssVars, ref) {
  const m = /^var\((--rc-[\w-]+)\)$/.exec(ref);
  if (!m) return ref;
  return resolveVarValue(cssVars, cssVars[m[1]]);
}

const toSrgbParsed = converter("rgb");
function luminance(cssColor) {
  const c = toSrgbParsed(cssColor);
  if (!c) return 0;
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return round((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05));
}

export function contrastReport(theme) {
  const raw = {};
  Object.assign(raw, rampVars("neutral", theme.color.neutral.hue, theme.color.neutral.chroma));
  for (const [key, spec] of Object.entries(theme.color.accents)) {
    Object.assign(raw, rampVars(key, spec.hue, spec.chroma));
  }
  const rows = [];
  const check = (mode, label, fgRef, bgRef, need) => {
    for (const [k, v] of Object.entries(semanticVars(theme, mode))) if (!(k in raw)) raw[k] = v;
    const fg = resolveVarValue(raw, fgRef);
    const bg = resolveVarValue(raw, bgRef);
    rows.push({ mode, pair: label, ratio: contrast(fg, bg), need, pass: contrast(fg, bg) >= need });
  };
  check("light", "ink/canvas", "var(--rc-ink)", "var(--rc-canvas)", 4.5);
  check("light", "ink-muted/surface", "var(--rc-ink-muted)", "var(--rc-surface)", 4.5);
  check("light", "brand/canvas", "var(--rc-brand)", "var(--rc-canvas)", 4.5);
  check("light", "brand-solid-ink/brand-solid", "var(--rc-brand-solid-ink)", "var(--rc-brand-solid)", 4.5);
  check("light", "success/canvas", "var(--rc-success)", "var(--rc-canvas)", 3);
  check("light", "warn/canvas", "var(--rc-warn)", "var(--rc-canvas)", 3);
  check("light", "danger/canvas", "var(--rc-danger)", "var(--rc-canvas)", 4.5);
  check("dark", "ink/canvas", "var(--rc-ink)", "var(--rc-canvas)", 4.5);
  check("dark", "ink-muted/surface", "var(--rc-ink-muted)", "var(--rc-surface)", 4.5);
  check("dark", "brand/canvas", "var(--rc-brand)", "var(--rc-canvas)", 4.5);
  check("dark", "brand-solid-ink/brand-solid", "var(--rc-brand-solid-ink)", "var(--rc-brand-solid)", 4.5);
  check("dark", "danger/canvas", "var(--rc-danger)", "var(--rc-canvas)", 4.5);
  return rows;
}

// ---------------------------------------------------------------------------
// Theme resolution (no fs): caller supplies a parent-resolver if one exists.
// ---------------------------------------------------------------------------
export function resolveTheme(raw, getParent) {
  let merged = raw.inherits && getParent
    ? deepMerge(getParent(raw.inherits), raw)
    : deepMerge(DEFAULT_THEME, raw);
  merged.name = raw.name;
  return merged;
}
