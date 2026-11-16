// @reclaim/tokens — theme compiler: tokens JSON -> runtime CSS vars + contrast report.
// One source of truth: themes/<name>.tokens.json. Components only read --rc-* vars.
// NOTE: this module is browser-safe (the showcase imports it). Filesystem helpers
// live in ./files.mjs.
import { converter, toGamut, formatCss, parse } from "culori";

// ---------------------------------------------------------------------------
// Ramp model: 11 steps (50..950) on a fixed OKLCH lightness curve.
// Themes tune hue + chroma (+ contrast curve in advanced mode); the curve
// keeps every ramp AA-legible by design.
// ---------------------------------------------------------------------------
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const L_CURVE = [0.985, 0.962, 0.93, 0.885, 0.82, 0.745, 0.655, 0.525, 0.415, 0.3, 0.165];
const C_PROFILE = [0.3, 0.55, 0.75, 0.88, 0.97, 1.0, 1.0, 0.92, 0.78, 0.6, 0.42];
const L_MID = 0.55; // contrast curve pivots around this lightness

const toSrgb = toGamut("rgb", "oklch");
const round = (x) => Math.round(x * 1000) / 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function rampColor(hue, chroma, idx, contrast = 1) {
  const l = clamp(L_MID + (L_CURVE[idx] - L_MID) * contrast, 0.02, 0.994);
  const c = chroma * C_PROFILE[idx];
  return formatCss(toSrgb({ mode: "oklch", l, c, h: hue }));
}

function rampVars(prefix, hue, chroma, contrast) {
  const out = {};
  STEPS.forEach((step, i) => {
    out[`--rc-${prefix}-${step}`] = rampColor(hue, chroma, i, contrast);
  });
  return out;
}

/** Every ramp the theme needs: neutral, accents, and paper when overridden. */
export function allRampVars(theme) {
  const k = theme.ramps?.contrast ?? 1;
  const vars = {};
  Object.assign(vars, rampVars("neutral", theme.color.neutral.hue, theme.color.neutral.chroma, k));
  if (theme.color.canvas) {
    Object.assign(vars, rampVars("paper", theme.color.canvas.hue, theme.color.canvas.chroma, k));
  }
  for (const [key, spec] of Object.entries(theme.color.accents)) {
    Object.assign(vars, rampVars(key, spec.hue, spec.chroma, k));
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Schema defaults. Themes only need to state what differs. Advanced groups
// default to the historical behavior, so existing themes are unaffected.
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
    canvas: null, // { hue, chroma } -> independent paper ramp for backgrounds
    accents: {
      brand: { hue: 264, chroma: 0.165 },
      success: { hue: 155, chroma: 0.13 },
      warn: { hue: 85, chroma: 0.15 },
      danger: { hue: 25, chroma: 0.18 },
    },
  },
  ramps: { contrast: 1 }, // <1 softer, >1 punchier (stretches L around midpoint)
  mapping: {
    surfaceLift: 1, // steps from canvas to surface (surface-2 = 2x)
    borderStep: 3, // neutral index for hairlines (3 -> 300; strong = +1)
    inkStep: 950, // neutral step for body ink (800 | 900 | 950)
    solidStep: 700, // accent step for solid buttons (vivid: 500-600 w/ dark ink)
    ringAlpha: 0.45,
  },
  type: {
    base: 16,
    ratio: 1.2,
    trackingHeading: -0.015,
    lineHeightBody: 1.55,
    lineHeightHeading: 1.12,
    weightHeading: 600,
    weightUI: 550,
    smallScale: 0.875, // xs/sm anchor relative to base
  },
  scale: {
    radius: 10,
    density: 1,
    shadow: 0.65,
    controlH: 36, // px at density 1, independent of spacing
    spaceUnit: 4, // px at density 1
    radiusSpread: 1, // how far sm/lg/xl fan out from the base radius
    shadowHue: 264,
    shadowChroma: 0, // >0 gives tinted ambient shadows
    motion: 1, // duration multiplier for component transitions
  },
  dark: {
    canvasLift: 0, // raise dark canvas off 950 toward charcoal (0-3 steps)
  },
  components: {
    tableCase: "uppercase", // uppercase | none
    badgePill: true,
    cardBorder: true,
  },
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
// ---------------------------------------------------------------------------
function semanticVars(theme, mode) {
  const light = mode === "light";
  const map = theme.mapping ?? {};
  const lift = map.surfaceLift ?? 1;
  const border = map.borderStep ?? 3;
  const inkStep = String(map.inkStep ?? 950);
  const solidStep = Number(map.solidStep ?? 700);
  const solidHover = Math.min(900, solidStep + 100);
  const paperName = theme.color.canvas ? "paper" : "neutral";
  const n = (step) => `var(--rc-neutral-${step})`;
  const p = (idx) => `var(--rc-${paperName}-${STEPS[clamp(idx, 0, 10)]})`;
  const a = (key, step) => `var(--rc-${key}-${step})`;
  const pick = (l, d) => (light ? l : d);
  // vivid solids (500-600) need dark ink; deep solids (700+) need light ink
  const solidInk = solidStep >= 650 ? n(50) : n(950);
  const darkLift = theme.dark?.canvasLift ?? 0;
  const canvasIdx = light ? 0 : 10 - darkLift;

  const vars = {
    "--rc-canvas": p(canvasIdx),
    "--rc-surface": p(light ? Math.min(9, lift) : canvasIdx - 1),
    "--rc-surface-2": p(light ? Math.min(9, lift * 2) : canvasIdx - 2),
    "--rc-line": n(STEPS[clamp(light ? border : canvasIdx - border, 0, 10)]),
    "--rc-line-strong": n(STEPS[clamp(light ? border + 1 : canvasIdx - border - 1, 0, 10)]),
    "--rc-ink": pick(n(inkStep), n(50)),
    "--rc-ink-muted": pick(n(800), n(300)),
    "--rc-ink-faint": n(500),
    "--rc-ring": a("brand", pick(600, 500)),
    "--rc-ring-soft": "color-mix(in oklab, var(--rc-ring) calc(var(--rc-ring-alpha) * 100%), transparent)",
    "--rc-ring-alpha": `${map.ringAlpha ?? 0.45}`,
    "--rc-focus-alpha": "0.45",
  };
  for (const key of Object.keys(theme.color.accents)) {
    vars[`--rc-${key}`] = a(key, pick(700, 300)); // text/links
    vars[`--rc-${key}-solid`] = a(key, pick(solidStep, Math.max(400, solidStep - 100)));
    vars[`--rc-${key}-solid-hover`] = a(key, pick(solidHover, Math.max(400, solidStep - 200)));
    vars[`--rc-${key}-solid-ink`] = light ? solidInk : pick(n(50), n(950));
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
  const s = theme.scale;
  const ty = theme.type;
  const comp = theme.components ?? {};
  const spread = s.radiusSpread ?? 1;
  const small = ty.smallScale ?? 0.875;
  const t = (exp) => `${round(ty.base * Math.pow(ty.ratio, exp))}px`;
  const shadowInk = `oklch(0.22 ${(s.shadowChroma ?? 0)} ${(s.shadowHue ?? 264)})`;
  const mix = (pct) =>
    `color-mix(in oklab, var(--rc-shadow-ink) calc(${pct} * var(--rc-shadow-strength)), transparent)`;
  const vars = {
    "--rc-font-display": fontStack(theme.fonts.display, "sans"),
    "--rc-font-text": fontStack(theme.fonts.text, "sans"),
    "--rc-font-mono": fontStack(theme.fonts.mono, "mono"),
    "--rc-text-xs": `${round(ty.base * Math.max(0.6, small - 0.0625))}px`,
    "--rc-text-sm": `${round(ty.base * small)}px`,
    "--rc-text-base": `${round(ty.base)}px`,
    "--rc-text-lg": t(1),
    "--rc-text-xl": t(2),
    "--rc-text-2xl": t(3),
    "--rc-text-3xl": t(4),
    "--rc-text-4xl": t(5),
    "--rc-tracking-heading": `${ty.trackingHeading}em`,
    "--rc-leading-body": `${ty.lineHeightBody ?? 1.55}`,
    "--rc-leading-heading": `${ty.lineHeightHeading ?? 1.12}`,
    "--rc-weight-heading": `${ty.weightHeading ?? 600}`,
    "--rc-weight-ui": `${ty.weightUI ?? 550}`,
    "--rc-radius-sm": `${round(s.radius * clamp(1 - 0.45 * spread, 0.1, 1))}px`,
    "--rc-radius": `${round(s.radius)}px`,
    "--rc-radius-lg": `${round(s.radius * (1 + 0.65 * spread))}px`,
    "--rc-radius-xl": `${round(s.radius * (1 + 1.3 * spread))}px`,
    "--rc-density": `${round(s.density)}`,
    "--rc-control-h": `calc(${round((s.controlH ?? 36) * s.density)}px)`,
    "--rc-space": `calc(${round((s.spaceUnit ?? 4) * s.density)}px)`,
    "--rc-shadow-strength": `${round(s.shadow)}`,
    "--rc-shadow-ink": shadowInk,
    "--rc-shadow-1": `0 1px 2px ${mix(14)}`,
    "--rc-shadow-2": `0 4px 12px -2px ${mix(18)}, 0 1px 3px ${mix(10)}`,
    "--rc-shadow-3": `0 16px 40px -8px ${mix(24)}, 0 3px 8px ${mix(12)}`,
    "--rc-motion": `${round(s.motion ?? 1)}`,
    "--rc-table-th-transform": comp.tableCase ?? "uppercase",
    "--rc-badge-radius": comp.badgePill === false ? "var(--rc-radius-sm)" : "999px",
    "--rc-card-border": comp.cardBorder === false ? "none" : "1px solid var(--rc-line)",
  };
  return vars;
}

// "@fontsource-variable/*" registers families as "<Name> Variable"; plain and
// Google-loaded names match the bare name. Stacking both makes every source work.
function fontStack(f, generic) {
  const g = generic === "mono" ? "ui-monospace, monospace" : "ui-sans-serif, system-ui, sans-serif";
  return `"${f} Variable", "${f}", ${g}`;
}

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
  const sel = scopeSelector ?? `:root[data-rc-theme="${t.name}"]`;
  const light = { ...allRampVars(t), ...scaleVars(t), ...semanticVars(t, "light"), "color-scheme": "light" };
  const darkOnly = { ...semanticVars(t, "dark"), "color-scheme": "dark" };
  return `${emitBlock(sel, light)}\n\n${emitBlock(scopeSelector ? ".dark" : `${sel}.dark`, darkOnly)}\n`;
}

/** Flat var map for a resolved theme in a mode — used by the studio's live
 *  preview (applied inline on <html>, no stylesheet round-trip). */
export function themeVars(theme, mode) {
  return { ...allRampVars(theme), ...scaleVars(theme), ...semanticVars(theme, mode) };
}

/** #rrggbb of a ramp step — lets UIs show/seed color pickers from hue+chroma. */
export function rampHex(hue, chroma, idx, contrast = 1) {
  const c = toSrgb({
    mode: "oklch",
    l: clamp(L_MID + (L_CURVE[idx] - L_MID) * contrast, 0.02, 0.994),
    c: chroma * C_PROFILE[idx],
    h: hue,
  });
  const hex = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
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

/** Flat selector->vars map for shadcn registry `cssVars` fields. */
export function themeCSSVars(theme) {
  const vars = { ...allRampVars(theme), ...scaleVars(theme) };
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
  const raw = allRampVars(theme);
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
