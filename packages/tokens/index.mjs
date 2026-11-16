// @reclaim/tokens — theme compiler: tokens JSON -> runtime CSS vars + contrast report.
// One source of truth: themes/<name>.tokens.json. Components only read --rc-* vars.
// NOTE: this module is browser-safe (the showcase imports it). Filesystem helpers
// live in ./files.mjs.
import { converter, toGamut, formatCss, parse, differenceCiede2000, filterDeficiencyDeuter, filterDeficiencyProt, filterDeficiencyTrit } from "culori";

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
  if (over === null || typeof over !== "object") return over; // primitives
  if (Array.isArray(over)) return JSON.parse(JSON.stringify(over)); // Proxy-safe
  const out = JSON.parse(JSON.stringify(base ?? {})); // Proxy-safe
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

export function buildThemeCSS(theme, scopeSelector = null, darkSelector = null) {
  // JSON round-trip, not structuredClone: callers may hand us Vue reactive
  // Proxies (the studio does), and structuredClone throws on those
  const t = JSON.parse(JSON.stringify(theme));
  const sel = scopeSelector ?? `:root[data-rc-theme="${t.name}"]`;
  const light = { ...allRampVars(t), ...scaleVars(t), ...semanticVars(t, "light"), "color-scheme": "light" };
  const darkOnly = { ...semanticVars(t, "dark"), "color-scheme": "dark" };
  const darkSel = darkSelector ?? (scopeSelector ? ".dark" : `${sel}.dark`);
  return `${emitBlock(sel, light)}\n\n${emitBlock(darkSel, darkOnly)}\n`;
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
    rows.push({ mode, pair: label, ratio: contrast(fg, bg), need, headroom: round(contrast(fg, bg) - need), pass: contrast(fg, bg) >= need });
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
// Palette intelligence: distinctness (ΔE2000), color-vision deficiency,
// harmony analysis, brand derivation, seeded roll. All pure + browser-safe.
// ---------------------------------------------------------------------------
const dE00 = differenceCiede2000();
const CVD = {
  deuteran: filterDeficiencyDeuter(1),
  protan: filterDeficiencyProt(1),
  tritan: filterDeficiencyTrit(1),
};

/** Resolve the semantic colors a theme actually produces, per mode. */
export function resolvePalette(theme, mode) {
  const raw = allRampVars(theme);
  const sem = semanticVars(theme, mode);
  const out = {};
  for (const [k, v] of Object.entries(sem)) {
    if (k.startsWith("--rc-ring") || k === "--rc-focus-alpha" || k === "--rc-link") continue;
    out[k] = resolveVarValue(raw, v);
  }
  return out;
}

/** Simulate a color under a deficiency type. Returns a CSS color string. */
export function cvdSimulate(cssColor, type) {
  const f = CVD[type];
  const c = f?.(parse(cssColor));
  return c ? formatCss(c) : cssColor;
}

/**
 * Objective checks: can these colors be TOLD APART. Levels:
 * fail = will be confused in practice, warn = effort to distinguish.
 */
export function distinctness(theme) {
  const rows = [];
  for (const mode of ["light", "dark"]) {
    const pal = resolvePalette(theme, mode);
    const keys = Object.keys(theme.color.accents);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = pal[`--rc-${keys[i]}-solid`];
        const b = pal[`--rc-${keys[j]}-solid`];
        if (!a || !b) continue;
        const d = round(dE00(parse(a), parse(b)));
        rows.push({
          mode, kind: "accent", pair: `${keys[i]} ↔ ${keys[j]}`, dE: d,
          level: d < 10 ? "fail" : d < 18 ? "warn" : "ok",
          why: d < 10 ? "indistinguishable at badge/button size"
             : d < 18 ? "distinguishable only side by side"
             : "clearly distinct",
        });
      }
    }
    const near = (label, fg, bg, fail, warn) => {
      const d = round(dE00(parse(pal[fg]), parse(pal[bg])));
      rows.push({
        mode, kind: "surface", pair: label, dE: d,
        level: d < fail ? "fail" : d < warn ? "warn" : "ok",
        why: d < fail ? (label.includes("line") ? "hairline will be invisible" : "panels melt into the page")
           : d < warn ? "separation reads as accident, not design" : "clean separation",
      });
    };
    near("canvas ↔ surface", "--rc-canvas", "--rc-surface", 1.2, 2.2);
    near("surface ↔ surface-2", "--rc-surface", "--rc-surface-2", 1.2, 2.2);
    near("line ↔ canvas", "--rc-line", "--rc-canvas", 1.5, 3);
  }
  return rows;
}

/**
 * Color-vision safety: pairwise ΔE under each simulation, focused on the
 * status colors (the ones that carry meaning). A collision here is an
 * accessibility problem, not taste.
 */
export function cvdReport(theme) {
  const rows = [];
  const pal = resolvePalette(theme, "light");
  const keys = Object.keys(theme.color.accents);
  for (const type of Object.keys(CVD)) {
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = cvdSimulate(pal[`--rc-${keys[i]}-solid`], type);
        const b = cvdSimulate(pal[`--rc-${keys[j]}-solid`], type);
        const d = round(dE00(parse(a), parse(b)));
        if (d < 16) rows.push({ type, pair: `${keys[i]} ↔ ${keys[j]}`, dE: d, level: d < 8 ? "fail" : "warn" });
      }
    }
  }
  return rows;
}

/** Hue-relationship vocabulary — advisory only. Never red: taste is not a bug. */
function hueRelation(delta) {
  if (!Number.isFinite(delta)) return { x: NaN, rel: "unknown", note: "missing hue value" };
  const d = ((delta % 360) + 360) % 360;
  const x = Math.min(d, 360 - d); // shortest arc on the wheel, 0..180
  if (x < 15) return { x, rel: "same family", note: "near-identical hue — differentiation must come from chroma/lightness" };
  if (x < 45) return { x, rel: "analogous", note: "neighbors on the wheel — calm, cohesive" };
  if (x < 75) return { x, rel: "subdued contrast", note: "the quiet zone — neither cohesive nor tense" };
  if (x < 105) return { x, rel: "contrast", note: "clearly different, still balanced" };
  if (x < 135) return { x, rel: "triadic", note: "vibrant tension — classic multi-accent scheme" };
  if (x < 165) return { x, rel: "split-complementary", note: "tension with room to breathe" };
  return { x, rel: "complementary", note: "maximum tension — bold and deliberate, or an accident about to happen" };
}

export function harmony(theme) {
  const hues = {};
  for (const [k, spec] of Object.entries(theme.color.accents)) hues[k] = spec.hue;
  hues.neutral = theme.color.neutral.hue;
  if (theme.color.canvas) hues.paper = theme.color.canvas.hue;

  const pairs = [];
  const names = Object.keys(hues);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (names[i] === "neutral" && names[j] === "paper") continue;
      const delta = hues[names[j]] - hues[names[i]];
      const r = hueRelation(delta);
      pairs.push({ a: names[i], b: names[j], angle: round(r.x), rel: r.rel, note: r.note });
    }
  }

  const accentHues = Object.values(theme.color.accents).map((a) => a.hue);
  const spread = Math.max(...accentHues) - Math.min(...accentHues);
  const chromas = Object.values(theme.color.accents).map((a) => a.chroma);
  const chromaSpread = round(Math.max(...chromas) - Math.min(...chromas));

  // scheme classification uses accent↔accent relations only — gray's "relationship"
  // to your brand is cohesion, not a scheme
  const accentPairs = pairs.filter((p) => accentHues.includes(hues[p.a]) && accentHues.includes(hues[p.b]));
  const inBand = (lo, hi) => accentPairs.filter((p) => p.angle >= lo && p.angle <= hi).length;
  let scheme = "custom spread";
  if (spread <= 60) scheme = "analogous";
  else if (inBand(105, 135) >= 2) scheme = "triadic";
  else if (inBand(135, 165) >= 2) scheme = "split-complementary";
  else if (inBand(165, 180) >= 1) scheme = "complementary core";

  const notes = [];
  if (chromaSpread > 0.1) notes.push(`accent chromas span ${chromaSpread} — mixed saturation families read as uncoordinated; aim within ~0.08`);
  for (const p of pairs) {
    const bothStatusish = ["brand", "success", "warn", "danger"].includes(p.a) && ["brand", "success", "warn", "danger"].includes(p.b);
    if (bothStatusish && p.angle < 15) notes.push(`${p.a} ↔ ${p.b} are ${p.angle}° apart — same family; their different roles will blur in practice`);
  }
  const status = ["success", "warn", "danger"].map((k) => ({ k, h: theme.color.accents[k]?.hue })).filter((s) => s.h != null);
  const priors = { success: [140, 175], warn: [65, 100], danger: [10, 40] };
  for (const s of status) {
    const [lo, hi] = priors[s.k];
    if (s.h < lo || s.h > hi) notes.push(`${s.k} at ${s.h}° departs the recognizable region (${lo}–${hi}°) — users will hesitate on meaning`);
  }
  return { scheme, pairs, notes };
}

/**
 * From one brand color, derive the rest by guideline:
 * status hues stay in recognizable regions with chroma scaled from the brand;
 * neutral tint rides the brand family — or its complement when the brand is a
 * status-color lookalike — at whisper chroma.
 */
export function deriveFromBrand(brandHue, brandChroma) {
  const region = (lo, hi, prefer) => {
    const d = Math.abs(brandHue - prefer);
    return clamp(prefer + (brandHue > prefer ? -1 : 1) * Math.min(12, d * 0.1), lo, hi);
  };
  const nearStatus = (h) => [155, 85, 25].some((s) => Math.abs(((h - s + 540) % 360) - 180) < 30);
  const accents = {
    brand: { hue: round(brandHue), chroma: round(clamp(brandChroma, 0.08, 0.24)) },
    success: { hue: round(region(140, 175, 155)), chroma: round(clamp(brandChroma * 0.8, 0.09, 0.15)) },
    warn: { hue: round(region(65, 100, 85)), chroma: round(clamp(brandChroma * 0.9, 0.1, 0.17)) },
    danger: { hue: round(region(10, 40, 25)), chroma: round(clamp(brandChroma * 0.95, 0.13, 0.2)) },
  };
  const neutral = nearStatus(brandHue)
    ? { hue: round((brandHue + 180) % 360), chroma: round(clamp(brandChroma * 0.06, 0.006, 0.014)) }
    : { hue: round(brandHue), chroma: round(clamp(brandChroma * 0.07, 0.006, 0.016)) };
  return { accents, neutral };
}

/** Deterministic seeded palette roll with scheme variety. */
export function rollPalette(seed) {
  // proper mulberry32 — an LCG would correlate consecutive seeds
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng(); // warmup: first output of consecutive small seeds is correlated
  const schemes = ["analogous", "triadic", "split-complementary", "complementary"];
  const scheme = schemes[Math.floor(rng() * schemes.length)];
  const brand = Math.round(rng() * 360);
  const brandChroma = round(0.11 + rng() * 0.11);
  const derived = deriveFromBrand(brand, brandChroma);
  // the scheme label must describe what was actually rolled: the neutral tint
  // sits at the scheme's angle from the brand
  const tintOffsets = {
    analogous: [30, -30],
    triadic: [120, 240],
    "split-complementary": [150, 210],
    complementary: [180, 180],
  }[scheme];
  const neutral = {
    hue: round((brand + tintOffsets[Math.floor(rng() * tintOffsets.length)] + 360) % 360),
    chroma: derived.neutral.chroma,
  };
  const color = { neutral, canvas: null, accents: derived.accents };
  // report the scheme the way harmony() will judge it, from the brand↔tint
  // angle actually rolled — labels must survive their own analysis
  const tintAngle = Math.abs(((neutral.hue - brand + 540) % 360) - 180);
  const judged = tintAngle <= 45 ? "analogous"
    : tintAngle >= 105 && tintAngle < 135 ? "triadic"
    : tintAngle >= 135 && tintAngle < 165 ? "split-complementary"
    : tintAngle >= 165 ? "complementary"
    : scheme;
  return { scheme: judged, color, seed: seed >>> 0 };
}

/**
 * One-click fix proposals. For every detected problem, try a small set of
 * principled candidates (status hues only move within their recognizable
 * regions; brand moves last) and keep only candidates that provably clear
 * the problem without introducing new contrast failures. Each suggestion is
 * a single atomic patch; applying one re-runs the analysis, so cascading
 * fixes surface iteratively.
 */
export function suggestFixes(theme) {
  const clone = (th) => JSON.parse(JSON.stringify(th));
  const applyPath = (th, path, v) => {
    const ks = path.split(".");
    let c = th;
    for (const k of ks.slice(0, -1)) c = c[k];
    c[ks.at(-1)] = v;
  };
  const baseFails = new Set(contrastReport(theme).filter((r) => !r.pass).map((r) => r.mode + r.pair));
  const noNewContrastFail = (th) =>
    contrastReport(th).every((r) => r.pass || baseFails.has(r.mode + r.pair));

  const regions = { success: [140, 175], warn: [65, 100], danger: [10, 40] };
  // global problem score: a candidate must REDUCE this, or it just trades one
  // collision for another (the oscillation trap)
  const score = (th) => {
    let s = 0;
    for (const r of contrastReport(th)) if (!r.pass) s += 100;
    for (const r of cvdReport(th)) s += r.level === "fail" ? 40 : 15;
    for (const r of distinctness(th)) s += r.level === "fail" ? 30 : r.level === "warn" ? 10 : 0;
    return s;
  };
  const hueCandidates = (mover, th) => {
    const spec = th.color.accents[mover];
    const out = [];
    for (const d of [5, -5, 10, -10, 15, -15, 20, -20, 30, -30, 45, -45]) {
      const h = Math.round((((spec.hue + d) % 360) + 360) % 360);
      if (regions[mover] && (h < regions[mover][0] || h > regions[mover][1])) continue;
      out.push({ path: `color.accents.${mover}.hue`, to: h, why: `shift ${mover} ${d > 0 ? "+" : ""}${d}°` });
    }
    // region edges: the boldest legal move for a status color
    if (regions[mover]) {
      for (const edge of regions[mover]) {
        if (edge !== spec.hue) out.push({ path: `color.accents.${mover}.hue`, to: edge, why: `move ${mover} to ${edge}° (region edge)` });
      }
    }
    for (const dc of [-0.03, 0.03]) {
      const c = round(clamp(spec.chroma + dc, 0.05, 0.24));
      if (c !== spec.chroma) out.push({ path: `color.accents.${mover}.chroma`, to: c, why: `${dc < 0 ? "reduce" : "raise"} ${mover} chroma` });
    }
    return out;
  };
  // prefer moving the status color before brand; brand moves last
  const orderMovers = (a, b) => [a, b].sort((x, y) => (x === "brand" ? 1 : 0) - (y === "brand" ? 1 : 0));

  const suggestions = [];
  const seen = new Set();
  const offer = (problem, severity, th, candidates, clears) => {
    const cur = score(th);
    for (const c of candidates) {
      const key = problem + c.path + c.to;
      if (seen.has(key)) continue;
      const next = clone(th);
      applyPath(next, c.path, c.to);
      // must clear THIS problem, strictly improve the overall score, and never
      // introduce new contrast failures
      if (clears(next) && score(next) < cur && noNewContrastFail(next)) {
        seen.add(key);
        suggestions.push({ problem, severity, ...c });
        return;
      }
    }
  };

  // 1) contrast failures (hard)
  for (const r of contrastReport(theme).filter((x) => !x.pass)) {
    const k = r.pair.split("/")[0];
    const cands = [];
    if (r.pair === "ink/canvas") cands.push({ path: "mapping.inkStep", to: 950, why: "set ink to 950" });
    if (r.pair === "ink-muted/surface") {
      cands.push({ path: "ramps.contrast", to: round((theme.ramps?.contrast ?? 1) + 0.06), why: "deepen the ramp (contrast curve)" });
      cands.push({ path: "mapping.surfaceLift", to: Math.max(0, (theme.mapping?.surfaceLift ?? 1) - 1), why: "lower surface lift" });
    }
    if (k === "brand") {
      cands.push({ path: "mapping.solidStep", to: Math.min(800, (theme.mapping?.solidStep ?? 700) + 100), why: "deeper solid step" });
      cands.push({ path: "color.accents.brand.chroma", to: round(Math.max(0.05, theme.color.accents.brand.chroma - 0.02)), why: "less saturated brand" });
      cands.push({ path: "ramps.contrast", to: round((theme.ramps?.contrast ?? 1) + 0.06), why: "deepen the ramp" });
    }
    if (["success", "warn", "danger"].includes(k)) {
      cands.push(...hueCandidates(k, theme));
      cands.push({ path: "ramps.contrast", to: round((theme.ramps?.contrast ?? 1) + 0.06), why: "deepen the ramp" });
    }
    offer(`${r.mode} ${r.pair} contrast`, "fail", theme, cands,
      (th) => contrastReport(th).find((x) => x.mode === r.mode && x.pair === r.pair)?.pass === true);
  }

  // 2) color-vision collisions (hard — accessibility)
  for (const row of cvdReport(theme)) {
    const [a, b] = row.pair.split(" ↔ ");
    const cands = orderMovers(a, b).flatMap((m) => hueCandidates(m, theme));
    offer(`${row.type}: ${row.pair}`, row.level, theme, cands,
      (th) => !cvdReport(th).some((x) => x.type === row.type && x.pair === row.pair));
  }

  // 3) distinctness (accent pairs hard on fail, soft on warn; surfaces hard on fail)
  for (const row of distinctness(theme).filter((r) => r.level !== "ok")) {
    if (row.kind === "accent") {
      const [a, b] = row.pair.split(" ↔ ");
      const cands = orderMovers(a, b).flatMap((m) => hueCandidates(m, theme));
      offer(`${row.mode} ${row.pair}`, row.level, theme, cands, (th) => {
        const fresh = distinctness(th).find((r) => r.mode === row.mode && r.pair === row.pair);
        if (!fresh) return true;
        return row.level === "fail" ? fresh.level !== "fail" : fresh.level === "ok";
      });
    } else if (row.pair.includes("line")) {
      offer(`${row.mode} ${row.pair}`, row.level, theme,
        [{ path: "mapping.borderStep", to: Math.min(6, (theme.mapping?.borderStep ?? 3) + 1), why: "one step stronger borders" }],
        (th) => distinctness(th).find((r) => r.mode === row.mode && r.pair === row.pair)?.level === "ok");
    } else {
      offer(`${row.mode} ${row.pair}`, row.level, theme,
        [{ path: "mapping.surfaceLift", to: Math.min(5, (theme.mapping?.surfaceLift ?? 1) + 1), why: "raise surface lift" }],
        (th) => distinctness(th).find((r) => r.mode === row.mode && r.pair === row.pair)?.level === "ok");
    }
  }

  // 4) harmony priors (advisory): snap out-of-region status hues to nearest edge
  const curScore = score(theme);
  for (const [k, [lo, hi]] of Object.entries(regions)) {
    const h = theme.color.accents[k]?.hue;
    if (h != null && (h < lo || h > hi)) {
      const to = clamp(h, lo, hi);
      const next = clone(theme);
      applyPath(next, `color.accents.${k}.hue`, to);
      if (score(next) > curScore) continue; // advisory, but never actively harmful
      suggestions.push({
        problem: `${k} outside recognizable region`, severity: "note",
        path: `color.accents.${k}.hue`, to, why: `snap ${k} to ${to}°`,
      });
    }
  }

  const rank = { fail: 0, warn: 1, note: 2 };
  return suggestions.sort((x, y) => rank[x.severity] - rank[y.severity]).slice(0, 8);
}

/**
 * Font pairing — attribute catalog over the curated ship list plus a scoring
 * model on classic pairing rules: contrast in class, kinship in proportion.
 * Scores are advisory with attached reasons; unknown families (Google picks)
 * get a neutral stand-in profile so suggestions keep working.
 */
export const FONT_CATALOG = {
  "Fraunces": { role: ["display"], cls: "serif", width: "wide", contrast: "high", temp: "quirky", x: "mid" },
  "Newsreader": { role: ["display", "text"], cls: "serif", width: "normal", contrast: "medium", temp: "warm", x: "high" },
  "Source Serif 4": { role: ["display", "text"], cls: "serif", width: "normal", contrast: "medium", temp: "neutral", x: "mid" },
  "Archivo": { role: ["display", "text"], cls: "grotesque", width: "narrow", contrast: "medium", temp: "cool", x: "high" },
  "Bricolage Grotesque": { role: ["display"], cls: "grotesque", width: "wide", contrast: "low", temp: "quirky", x: "mid" },
  "Space Grotesk": { role: ["display", "text"], cls: "geometric", width: "narrow", contrast: "low", temp: "cool", x: "mid" },
  "Sora": { role: ["display"], cls: "geometric", width: "normal", contrast: "low", temp: "cool", x: "high" },
  "Outfit": { role: ["display"], cls: "geometric", width: "normal", contrast: "low", temp: "neutral", x: "high" },
  "Public Sans": { role: ["text"], cls: "grotesque", width: "normal", contrast: "low", temp: "neutral", x: "high" },
  "Figtree": { role: ["text"], cls: "humanist", width: "normal", contrast: "low", temp: "warm", x: "high" },
  "Albert Sans": { role: ["text"], cls: "geometric", width: "normal", contrast: "low", temp: "neutral", x: "high" },
  "Geist": { role: ["text"], cls: "grotesque", width: "normal", contrast: "low", temp: "cool", x: "high" },
  "Instrument Sans": { role: ["text"], cls: "humanist", width: "normal", contrast: "low", temp: "neutral", x: "high" },
  "JetBrains Mono": { role: ["mono"], cls: "mono", width: "normal", contrast: "low", temp: "cool", x: "high" },
  "Inconsolata": { role: ["mono"], cls: "mono", width: "normal", contrast: "low", temp: "neutral", x: "high" },
  "Victor Mono": { role: ["mono"], cls: "mono", width: "normal", contrast: "low", temp: "quirky", x: "mid" },
};

const NEUTRAL_PROFILE = { cls: "sans", width: "normal", contrast: "low", temp: "neutral", x: "mid" };
const profile = (f) => FONT_CATALOG[f] ?? NEUTRAL_PROFILE;
const TEMP_RANK = { cool: 0, neutral: 1, warm: 2, quirky: 3 };

export function scoreFontPair(a, b) {
  const A = profile(a);
  const B = profile(b);
  let s = 50;
  const reasons = [];
  // class contrast: the backbone of pairing
  if (A.cls === "serif" && B.cls !== "serif") { s += 22; reasons.push("serif display × sans text — the classic contrast"); }
  else if (A.cls !== "serif" && B.cls === "serif") { s += 18; reasons.push("sans display × serif text — editorial inversion"); }
  else if (A.cls !== B.cls) { s += 8; reasons.push(`${A.cls} × ${B.cls} — subtle kinship, different DNA`); }
  else if (A.cls === B.cls && A.cls !== "mono") { s -= 8; reasons.push(`same class (${A.cls}) — needs strong contrast elsewhere to not mush`); }
  // temperature: quirky needs a calm anchor; one step apart is deliberate;
  // cool↔warm is mild tension, not a crime
  const dt = Math.abs(TEMP_RANK[A.temp] - TEMP_RANK[B.temp]);
  const quirkyInvolved = A.temp === "quirky" || B.temp === "quirky";
  if (quirkyInvolved) {
    const other = A.temp === "quirky" ? B.temp : A.temp;
    if (other === "neutral") { s += 14; reasons.push("quirky + neutral — the wild one gets a calm partner"); }
    else if (other === "warm") { s -= 10; reasons.push("quirky + warm — both expressive, nothing holds the line"); }
    else if (other === "quirky") { s -= 12; reasons.push("two quirky voices — clown mode unless that's the brief"); }
    else s -= 4;
  } else if (dt === 1) { s += 12; reasons.push(`${A.temp} ↔ ${B.temp} — one step apart, reads deliberate`); }
  else if (dt === 0) s += 4;
  else { s -= 4; reasons.push("cool ↔ warm tension — mild; works if class contrast is strong"); }
  // width rhythm
  if (A.width === "narrow" && B.width === "narrow") { s -= 12; reasons.push("both narrow — cramped together"); }
  else if (A.width === "wide" && B.width === "wide") { s -= 10; reasons.push("both wide — bloated rhythm"); }
  else if (A.width !== B.width && (A.width === "normal" || B.width === "normal")) s += 6;
  // stroke contrast complement
  if (A.contrast === "high" && B.contrast === "low") s += 8;
  return { score: Math.max(0, Math.min(100, s)), reasons };
}

/** Top pairing candidates for each slot, given the theme's current choices. */
export function suggestFontPairings(theme) {
  const cur = theme.fonts;
  const out = { display: [], text: [], mono: [] };
  for (const [name, a] of Object.entries(FONT_CATALOG)) {
    if (name !== cur.text && a.role.includes("text")) out.text.push({ family: name, ...scoreFontPair(cur.display, name) });
    if (name !== cur.display && a.role.includes("display")) out.display.push({ family: name, ...scoreFontPair(name, cur.text) });
    if (name !== cur.mono && a.role.includes("mono")) {
      const temps = [profile(cur.display).temp, profile(cur.text).temp];
      const score = 60 + (temps.includes("quirky") && a.temp === "quirky" ? 20
        : temps.includes("cool") && a.temp === "cool" ? 18
        : a.temp === "neutral" ? 14 : 0);
      out.mono.push({
        family: name, score,
        reasons: [a.temp === "neutral" ? "neutral mono — lets both voices speak" : `matches the ${a.temp} side of your pairing`],
      });
    }
  }
  const top = (arr) => arr.sort((x, y) => y.score - x.score).slice(0, 3);
  return { display: top(out.display), text: top(out.text), mono: top(out.mono) };
}

/**
 * K-means color quantization in OKLab for logo extraction. Pure function over
 * raw RGBA pixels (browser wrapper lives in the studio) so it's testable in
 * node and reusable by CI/agents. Ranked by share × vividness — the color
 * that dominates AND carries chroma is the likely brand color.
 */
export function quantizePixels(pixels, k = 5) {
  const toLab = converter("oklab");
  const pts = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const lab = toLab({ mode: "rgb", r: pixels[i] / 255, g: pixels[i + 1] / 255, b: pixels[i + 2] / 255 });
    if (lab) pts.push(lab);
  }
  if (!pts.length) return [];
  const chromaOf = (p) => Math.hypot(p.a, p.b);
  const dist = (p, c) => (p.l - c.l) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;

  // farthest-point init seeded by the most saturated pixel
  let seed = 0;
  for (let i = 1; i < pts.length; i++) if (chromaOf(pts[i]) > chromaOf(pts[seed])) seed = i;
  const centers = [{ ...pts[seed] }];
  while (centers.length < Math.min(k, pts.length)) {
    let best = -1, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.min(...centers.map((c) => dist(pts[i], c)));
      if (d > best) { best = d; bi = i; }
    }
    centers.push({ ...pts[bi] });
  }

  const assign = new Array(pts.length);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist(pts[i], centers[c]);
        if (d < bd) { bd = d; bi = c; }
      }
      assign[i] = bi;
    }
    const sums = centers.map(() => ({ l: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]];
      s.l += pts[i].l; s.a += pts[i].a; s.b += pts[i].b; s.n++;
    }
    centers.forEach((c, ci) => {
      if (!sums[ci].n) return;
      c.l = sums[ci].l / sums[ci].n; c.a = sums[ci].a / sums[ci].n; c.b = sums[ci].b / sums[ci].n;
    });
  }

  const counts = centers.map(() => 0);
  assign.forEach((a) => counts[a]++);
  const toHex = (lch) => {
    const c = toSrgb({ mode: "oklch", l: lch.l, c: Math.hypot(lch.a, lch.b), h: ((Math.atan2(lch.b, lch.a) * 180 / Math.PI) + 360) % 360 });
    return "#" + [c.r, c.g, c.b].map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("");
  };
  return centers
    .map((c, i) => ({
      hex: toHex(c),
      hue: Math.round(((Math.atan2(c.b, c.a) * 180 / Math.PI) + 360) % 360),
      chroma: round(Math.hypot(c.a, c.b)),
      share: round(counts[i] / pts.length),
    }))
    .filter((c, i, arr) => c.share >= 0.02 && arr.findIndex((x) => x.hex === c.hex) === i)
    // brand color of a logo is the CHROMATIC one, not the most common —
    // white/gray background must not outrank it; chroma^0.8 dominates share
    .sort((x, y) => y.share * Math.pow(y.chroma, 0.8) - x.share * Math.pow(x.chroma, 0.8));
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
