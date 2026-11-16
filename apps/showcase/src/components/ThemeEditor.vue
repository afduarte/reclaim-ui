<script setup>
import { reactive, ref, watch, computed } from "vue";
import { state, workingTheme, contrastRows, saveTheme, setTheme, plain, ensureFonts, loadFont, previewTheme, clearPreview, FONT_LOADERS } from "../themes.js";
import { DEFAULT_THEME, deepMerge, rampHex, pickColor, contrastReport, deriveFromBrand, rollPalette, suggestFontPairings } from "@reclaim/tokens";
import { Button, Input, Select, Slider, ColorPicker, Card, Badge } from "@reclaim/ui";
import { extractLogoPalette } from "../logo.js";

const emit = defineEmits(["fork"]);
defineProps({ forking: Boolean });
const forkName = defineModel("forkName", { type: String, default: "" });

const adv = ref(false); // advanced token controls
const tintPaper = computed({
  get: () => !!t.color.canvas,
  set: (on) => { t.color.canvas = on ? { hue: t.color.neutral.hue, chroma: 0.02 } : null; },
});

const CURATED_FONTS = Object.keys(FONT_LOADERS);
const fontOptions = CURATED_FONTS.map((f) => ({ value: f, label: f }));

// ---- draft model ------------------------------------------------------------
// baseline = theme as last loaded/saved (the file). t = local draft.
// Dragging edits the draft and previews it via inline vars ONLY. Nothing
// touches disk until Save theme. Revert = back to baseline (= last save).
const t = reactive(deepMerge(DEFAULT_THEME, workingTheme.value));
const baseline = ref(plain(t));
const syncedTheme = ref(state.theme);

let internalAssign = false;
const syncFrom = (src) => {
  if (!src) return;
  const merged = deepMerge(DEFAULT_THEME, plain(src));
  if (JSON.stringify(merged) === JSON.stringify(t)) return;
  internalAssign = true;
  Object.assign(t, plain(merged));
};
syncFrom(state.resolved[state.theme] ?? state.rawTokens[state.theme]);

const dig = (obj, path) => path.split(".").reduce((a, k) => a?.[k], obj);
const put = (obj, path, v) => {
  const ks = path.split(".");
  let c = obj;
  for (const k of ks.slice(0, -1)) c = c[k];
  c[ks.at(-1)] = v;
};
// snapshot that PRESERVES reactive tracking (plain() strips the proxy via
// toRaw before stringify — fine for writes, poison for computeds)
const tracked = () => JSON.parse(JSON.stringify(t));

const isD = (path) => dig(t, path) !== dig(baseline.value, path);
const revert = (path) => {
  const v = dig(baseline.value, path);
  if (v !== undefined) put(t, path, v); // dynamic accents absent from baseline: no-op (✕ removes them)
};
const anyDirty = computed(() => JSON.stringify(tracked()) !== JSON.stringify(baseline.value));

// theme switching: drafts belong to a theme; confirm before discarding
let restoring = false;
watch(
  () => state.theme,
  (n, o) => {
    if (restoring) { restoring = false; return; } // coming back to keep the draft
    const src = state.resolved[n] ?? state.rawTokens[n];
    // a fork writes the draft as the new theme's file — adopting it is not a discard
    const draftIsNewTheme = src && JSON.stringify(deepMerge(DEFAULT_THEME, plain(src))) === JSON.stringify(plain(t));
    if (anyDirty.value && n !== syncedTheme.value && !draftIsNewTheme) {
      if (!window.confirm(`Discard unsaved draft in "${syncedTheme.value}"?`)) {
        restoring = true;
        setTheme(o);
        return;
      }
    }
    if (n !== syncedTheme.value) {
      // new session context: adopt whatever the file says, re-baseline
      syncFrom(state.resolved[n] ?? state.rawTokens[n]);
      baseline.value = plain(t);
      syncedTheme.value = n;
    }
  },
);
// resolved data arriving (initial load / theme switch fetch)
watch(
  () => state.resolved[state.theme],
  (r) => {
    if (!r || anyDirty.value) return; // never clobber an in-progress draft
    syncFrom(r);
    baseline.value = plain(t);
    syncedTheme.value = state.theme;
  },
);

// ---- preview on every edit; persistence is deliberate -----------------------
watch(t, () => {
  if (internalAssign) { internalAssign = false; return; }
  state.draft = plain(t);
  previewTheme(plain(t));
}, { deep: true });

// adopt one-click fixes requested by the Checks view
watch(
  () => state.pendingPatch,
  (p) => {
    if (!p) return;
    put(t, p.path, p.to);
    state.pendingPatch = null;
    state.notice = `applied: ${p.why}`;
  },
);

async function saveDraft() {
  const ok = await saveTheme(plain(t));
  if (!ok) return;
  // the draft IS the file now: re-baseline, hand preview back to file CSS
  baseline.value = plain(t);
  syncedTheme.value = state.theme;
  clearPreview();
}

function revertAll() {
  Object.assign(t, plain(baseline.value)); // watcher previews the restore
}

// ---- fonts ------------------------------------------------------------------
function loadGoogleFont(family) {
  const id = `gf-${family.toLowerCase().replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300..900&display=swap`;
  link.onerror = () => {
    link.remove();
    state.notice = `Google Font "${family}" failed to load (check name / network)`;
  };
  document.head.appendChild(link);
}

async function setFont(slot, family) {
  if (!family) return;
  if (CURATED_FONTS.includes(family)) {
    try { await loadFont(family); } catch { /* apply anyway if load fails */ }
  } else {
    loadGoogleFont(family);
  }
  t.fonts[slot] = family; // draft edit; preview watcher picks it up
}

const freeText = reactive({ display: "", text: "", mono: "" });
function applyFreeFont(slot) {
  const v = freeText[slot].trim();
  if (v) setFont(slot, v);
  freeText[slot] = "";
}

// pairing chips: ranked candidates for each slot given the other two, with reasons
const pairings = computed(() => suggestFontPairings(tracked()));

// ---- color pickers -----------------------------------------------------------
const seedHex = (kind, key) => {
  const spec = kind === "neutral" ? t.color.neutral : t.color.accents[key];
  return rampHex(spec?.hue ?? 0, spec?.chroma ?? 0, 6);
};
function applyPick(kind, key, hex) {
  const { hue, chroma } = pickColor(hex, kind === "neutral" ? 0.3 : 1);
  if (kind === "neutral") {
    t.color.neutral.hue = hue;
    t.color.neutral.chroma = Math.min(0.035, chroma);
  } else {
    t.color.accents[key].hue = hue;
    t.color.accents[key].chroma = Math.min(0.28, chroma);
  }
}

// the gate runs on the DRAFT, client-side — you can fail AA before you save, not after
const liveReport = computed(() => {
  try { return contrastReport(tracked()); } catch { return contrastRows.value; }
});
// ---- gradient tracks ---------------------------------------------------------
function hueGrad(chroma) {
  const stops = [];
  for (let a = 0; a <= 360; a += 30) stops.push(rampHex(a, chroma, 6));
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
function chromaGrad(hue, maxC) {
  const stops = [];
  for (let i = 0; i <= 10; i++) stops.push(rampHex(hue, (i / 10) * maxC, 6));
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

// ---- derive / roll -------------------------------------------------------------
function deriveRest() {
  const b = t.color.accents.brand;
  const { accents, neutral } = deriveFromBrand(b.hue, b.chroma);
  for (const k of ["success", "warn", "danger"]) if (t.color.accents[k]) Object.assign(t.color.accents[k], accents[k]);
  Object.assign(t.color.neutral, neutral);
  state.notice = "derived status + neutral from brand";
}
const rollSeed = ref(String(Math.floor(Math.random() * 99999)));
function roll() {
  const r = rollPalette(Number(rollSeed.value) || (Date.now() & 0xffff));
  Object.assign(t.color.neutral, r.color.neutral);
  t.color.canvas = null;
  for (const k of Object.keys(r.color.accents)) if (t.color.accents[k]) Object.assign(t.color.accents[k], r.color.accents[k]);
  state.notice = `rolled ${r.scheme} tint — seed ${r.seed}`;
}

// ---- logo → brand extraction --------------------------------------------------
const logoInput = ref(null);
const logoColors = ref([]);
const logoOver = ref(false);

async function handleLogoFile(f) {
  if (!f) return;
  try {
    logoColors.value = await extractLogoPalette(f);
    state.notice = logoColors.value.length
      ? `extracted ${logoColors.value.length} colors from logo`
      : "no colors found in that image";
  } catch (err) {
    state.notice = `logo read failed: ${err?.message ?? err}`;
  }
}
function onLogo(e) {
  handleLogoFile(e.target.files?.[0]);
  e.target.value = "";
}
function onLogoDrop(e) {
  logoOver.value = false;
  handleLogoFile(e.dataTransfer?.files?.[0]);
}
function applyLogoColor(c, derive = false) {
  t.color.accents.brand.hue = c.hue;
  t.color.accents.brand.chroma = Math.min(0.24, Math.max(0.08, c.chroma));
  if (derive) deriveRest();
  else state.notice = `brand set to ${c.hue}° — hit Derive or pick more swatches`;
}

// ---- dynamic accent roles ------------------------------------------------------
const newAccent = ref("");
const newAccentValid = computed(() =>
  /^[a-z][a-z0-9-]{1,18}$/.test(newAccent.value.trim()) && !t.color.accents?.[newAccent.value.trim()],
);
function addAccent() {
  const name = newAccent.value.trim();
  if (!newAccentValid.value) return;
  const hues = Object.values(t.color.accents).map((a) => a.hue);
  let best = 0, bestScore = -1;
  for (let h = 0; h < 360; h += 15) {
    const min = Math.min(...hues.map((x) => Math.abs((((h - x + 540) % 360) - 180))));
    if (min > bestScore) { bestScore = min; best = h; }
  }
  t.color.accents[name] = { hue: best, chroma: 0.13 };
  newAccent.value = "";
  state.notice = `added "${name}" at ${best}° — farthest from existing accents`;
}
function removeAccent(k) {
  if (k !== "brand") delete t.color.accents[k];
}

const fails = computed(() => liveReport.value.filter((r) => !r.pass));

// don't let a refresh eat the draft
watch(anyDirty, (d) => {
  if (d) window.addEventListener("beforeunload", preventClose);
  else window.removeEventListener("beforeunload", preventClose);
});
function preventClose(e) { e.preventDefault(); e.returnValue = ""; }
const accentKeys = computed(() => Object.keys(t.color?.accents ?? {}));
const forkValid = computed(() => /^[a-z0-9-]{2,40}$/.test(forkName.value));
</script>

<template>
  <Card>
    <div class="space-y-6 text-sm">
      <div>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-base font-semibold">Theme editor</h3>
          <div class="flex items-center gap-2">
            <Badge v-if="anyDirty" accent="warn" variant="outline">unsaved</Badge>
            <Button v-if="anyDirty" size="sm" variant="ghost" @click="revertAll">Revert all</Button>
            <Button size="sm" :disabled="!anyDirty" @click="saveDraft">Save theme</Button>
          </div>
        </div>
        <p class="text-xs leading-relaxed mt-1" style="color: var(--rc-ink-muted)">
          Changes preview live but touch nothing until <em>Save theme</em>. Amber controls
          differ from the saved file — ↺ reverts one, Revert all reverts the session.
        </p>
        <p class="min-h-[1.25rem] text-xs font-mono mt-1" style="color: var(--rc-success)">{{ state.notice }}</p>
      </div>

      <!-- start from a logo: the entry action belongs at the top -->
      <div
        class="rounded-rc border border-dashed px-4 py-3 text-center cursor-pointer transition-colors"
        :class="logoOver ? '' : 'hover:bg-surface-2'"
        :style="logoOver
          ? 'border-color: var(--rc-brand); background: var(--rc-brand-soft)'
          : 'border-color: var(--rc-line-strong); color: var(--rc-ink-muted)'"
        @click="logoInput.click()"
        @dragover.prevent="logoOver = true"
        @dragleave="logoOver = false"
        @drop.prevent="onLogoDrop"
      >
        <span class="text-sm">Drop a client logo here, or <span style="color: var(--rc-link)">browse…</span></span>
        <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="onLogo" />
      </div>

      <div v-if="logoColors.length" class="space-y-2">
        <div class="flex items-center gap-1.5">
          <span class="font-mono text-xs" style="color:var(--rc-ink-faint)">from logo:</span>
          <Button size="sm" variant="soft" @click="applyLogoColor(logoColors[0], true)">use top as brand + derive</Button>
          <Button size="sm" variant="ghost" @click="logoColors = []">dismiss</Button>
        </div>
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="c in logoColors" :key="c.hex"
            class="rc-swatch rc-swatch--circle" :style="{ background: c.hex }"
            :title="`hue ${c.hue}° · chroma ${c.chroma} · ${Math.round(c.share * 100)}% of logo — click sets brand`"
            @click="applyLogoColor(c)"
          />
        </div>
      </div>

      <!-- advanced switch -->
      <label class="flex items-center gap-2 text-xs font-mono cursor-pointer select-none" style="color: var(--rc-ink-muted)">
        <input type="checkbox" v-model="adv" class="rc-check-native" />
        Advanced token controls
      </label>

      <!-- Type -->
      <section class="space-y-3">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Type</h4>
        <div v-for="slot in ['display', 'text', 'mono']" :key="slot" class="space-y-1">
          <Select
            :label="slot"
            :model-value="t.fonts[slot]"
            :dirty="isD(`fonts.${slot}`)"
            :options="fontOptions.concat(CURATED_FONTS.includes(t.fonts[slot]) ? [] : [{ value: t.fonts[slot], label: t.fonts[slot] + ' (external)' }])"
            size="sm"
            @update:model-value="setFont(slot, $event)"
            @revert="setFont(slot, dig(baseline, `fonts.${slot}`))"
          />
          <div class="flex gap-1 items-center">
            <Input v-model="freeText[slot]" placeholder="try any Google Font…" size="sm" @keyup.enter="applyFreeFont(slot)" />
            <Button size="sm" variant="ghost" @click="applyFreeFont(slot)">load</Button>
          </div>
          <div class="flex gap-1.5 items-center flex-wrap">
            <span class="font-mono text-xs" style="color:var(--rc-ink-faint)">pairs:</span>
            <Button
              v-for="p in pairings[slot]" :key="p.family"
              size="sm" variant="ghost" :title="p.reasons.join(' · ')"
              @click="setFont(slot, p.family)"
            >{{ p.family }} <span class="font-mono ml-1" style="color: var(--rc-ink-faint)">{{ p.score }}</span></Button>
          </div>
        </div>
        <div class="space-y-1">
          <Slider label="size" suffix="px" v-model="t.type.base" :min="14" :max="19" :step="0.5"
            :dirty="isD('type.base')" @revert="revert('type.base')" />
          <Slider label="ratio" v-model="t.type.ratio" :min="1.067" :max="1.422" :step="0.001"
            :dirty="isD('type.ratio')" @revert="revert('type.ratio')" />
          <Slider label="heading tracking" v-model="t.type.trackingHeading" :min="-0.04" :max="0.02" :step="0.001"
            :dirty="isD('type.trackingHeading')" @revert="revert('type.trackingHeading')" />
          <template v-if="adv">
            <Slider label="leading · body" v-model="t.type.lineHeightBody" :min="1.3" :max="1.9" :step="0.01"
              :dirty="isD('type.lineHeightBody')" @revert="revert('type.lineHeightBody')" />
            <Slider label="leading · heading" v-model="t.type.lineHeightHeading" :min="1" :max="1.3" :step="0.01"
              :dirty="isD('type.lineHeightHeading')" @revert="revert('type.lineHeightHeading')" />
            <Slider label="weight · heading" v-model="t.type.weightHeading" :min="500" :max="750" :step="50"
              :dirty="isD('type.weightHeading')" @revert="revert('type.weightHeading')" />
            <Slider label="weight · ui" v-model="t.type.weightUI" :min="450" :max="650" :step="50"
              :dirty="isD('type.weightUI')" @revert="revert('type.weightUI')" />
            <Slider label="small scale" v-model="t.type.smallScale" :min="0.75" :max="0.95" :step="0.005"
              :dirty="isD('type.smallScale')" @revert="revert('type.smallScale')" />
          </template>
        </div>
      </section>

      <!-- Neutrals -->
      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <ColorPicker :model-value="seedHex('neutral')" shape="square" title="Pick the neutral tint — the grays follow it"
            :dirty="isD('color.neutral.hue') || isD('color.neutral.chroma')"
            @update:model-value="applyPick('neutral', null, $event)"
            @revert="revert('color.neutral.hue'); revert('color.neutral.chroma')" />
          <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Neutrals · hue-tinted grays</h4>
        </div>
        <Slider label="hue" suffix="°" v-model="t.color.neutral.hue" :min="0" :max="360"
          :track-gradient="hueGrad(t.color.neutral.chroma)"
          :dirty="isD('color.neutral.hue')" @revert="revert('color.neutral.hue')" />
        <Slider label="chroma" v-model="t.color.neutral.chroma" :min="0" :max="0.035" :step="0.001"
          :track-gradient="chromaGrad(t.color.neutral.hue, 0.035)"
          :dirty="isD('color.neutral.chroma')" @revert="revert('color.neutral.chroma')" />
        <Slider v-if="adv" label="contrast curve" v-model="t.ramps.contrast" :min="0.7" :max="1.3" :step="0.01"
          :dirty="isD('ramps.contrast')" @revert="revert('ramps.contrast')" />
      </section>

      <!-- Surfaces (advanced) -->
      <section v-if="adv" class="space-y-1.5">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Surfaces</h4>
        <label class="flex items-center gap-2 text-xs cursor-pointer select-none" style="color: var(--rc-ink-muted)">
          <input type="checkbox" v-model="tintPaper" class="rc-check-native" />
          tint paper independently from grays
        </label>
        <template v-if="t.color.canvas">
          <Slider label="paper hue" suffix="°" v-model="t.color.canvas.hue" :min="0" :max="360"
            :track-gradient="hueGrad(t.color.canvas.chroma)"
            :dirty="isD('color.canvas.hue')" @revert="revert('color.canvas.hue')" />
          <Slider label="paper chroma" v-model="t.color.canvas.chroma" :min="0" :max="0.05" :step="0.002"
            :track-gradient="chromaGrad(t.color.canvas.hue, 0.05)"
            :dirty="isD('color.canvas.chroma')" @revert="revert('color.canvas.chroma')" />
        </template>
        <Slider label="surface lift" v-model="t.mapping.surfaceLift" :min="0" :max="4" :step="1"
          :dirty="isD('mapping.surfaceLift')" @revert="revert('mapping.surfaceLift')" />
        <Slider label="border step" v-model="t.mapping.borderStep" :min="2" :max="5" :step="1"
          :dirty="isD('mapping.borderStep')" @revert="revert('mapping.borderStep')" />
        <Select label="ink step" size="sm"
          :model-value="String(t.mapping.inkStep)"
          :dirty="isD('mapping.inkStep')"
          :options="[{ value: '800', label: '800 · soft' }, { value: '900', label: '900' }, { value: '950', label: '950 · harsh' }]"
          @update:model-value="t.mapping.inkStep = Number($event)"
          @revert="revert('mapping.inkStep')" />
      </section>

      <!-- Accents -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Accents</h4>
          <div class="flex items-center gap-1.5">
            <Input v-model="rollSeed" size="sm" placeholder="seed" class="w-20" />
            <Button size="sm" variant="ghost" @click="roll">Roll</Button>
          </div>
        </div>
        <Button size="sm" variant="outline" class="w-full" @click="deriveRest">
          Derive status + neutral from brand
        </Button>
        <div v-for="k in accentKeys" :key="k" class="space-y-1.5">
          <div class="flex items-center gap-2">
            <ColorPicker :model-value="seedHex('accent', k)" :title="`Pick a color for ${k}`"
              :dirty="isD(`color.accents.${k}.hue`) || isD(`color.accents.${k}.chroma`)"
              @update:model-value="applyPick('accent', k, $event)"
              @revert="revert(`color.accents.${k}.hue`); revert(`color.accents.${k}.chroma`)" />
            <span class="font-medium capitalize">{{ k }}</span>
            <button v-if="k !== 'brand'" class="rc-revert ml-auto" title="Remove accent role" @click="removeAccent(k)">✕</button>
          </div>
          <div class="space-y-1">
            <Slider label="hue" suffix="°" v-model="t.color.accents[k].hue" :min="0" :max="360"
              :track-gradient="hueGrad(t.color.accents[k].chroma)"
              :dirty="isD(`color.accents.${k}.hue`)" @revert="revert(`color.accents.${k}.hue`)" />
            <Slider label="chroma" v-model="t.color.accents[k].chroma" :min="0" :max="0.28" :step="0.005"
              :track-gradient="chromaGrad(t.color.accents[k].hue, 0.28)"
              :dirty="isD(`color.accents.${k}.chroma`)" @revert="revert(`color.accents.${k}.chroma`)" />
          </div>
        </div>
        <template v-if="adv">
          <Slider label="solid step" v-model="t.mapping.solidStep" :min="500" :max="800" :step="100"
            :dirty="isD('mapping.solidStep')" @revert="revert('mapping.solidStep')" />
          <Slider label="ring alpha" v-model="t.mapping.ringAlpha" :min="0.2" :max="0.8" :step="0.05"
            :dirty="isD('mapping.ringAlpha')" @revert="revert('mapping.ringAlpha')" />
        </template>
        <div class="flex gap-1.5 items-center pt-1 border-t border-line">
          <Input v-model="newAccent" size="sm" placeholder="new role: secondary, info…" />
          <Button size="sm" variant="outline" :disabled="!newAccentValid" @click="addAccent">+ accent</Button>
        </div>
      </section>

      <!-- Dark mode (advanced) -->
      <section v-if="adv" class="space-y-1.5">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Dark mode</h4>
        <Slider label="canvas lift" v-model="t.dark.canvasLift" :min="0" :max="3" :step="1"
          :dirty="isD('dark.canvasLift')" @revert="revert('dark.canvasLift')" />
      </section>

      <!-- Geometry -->
      <section class="space-y-1.5">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Geometry</h4>
        <Slider label="radius" suffix="px" v-model="t.scale.radius" :min="0" :max="24"
          :dirty="isD('scale.radius')" @revert="revert('scale.radius')" />
        <Slider label="density" v-model="t.scale.density" :min="0.85" :max="1.2" :step="0.01"
          :dirty="isD('scale.density')" @revert="revert('scale.density')" />
        <Slider label="shadow" v-model="t.scale.shadow" :min="0" :max="1" :step="0.05"
          :dirty="isD('scale.shadow')" @revert="revert('scale.shadow')" />
        <template v-if="adv">
          <Slider label="control height" suffix="px" v-model="t.scale.controlH" :min="28" :max="44" :step="1"
            :dirty="isD('scale.controlH')" @revert="revert('scale.controlH')" />
          <Slider label="space unit" suffix="px" v-model="t.scale.spaceUnit" :min="3" :max="6" :step="0.5"
            :dirty="isD('scale.spaceUnit')" @revert="revert('scale.spaceUnit')" />
          <Slider label="radius spread" v-model="t.scale.radiusSpread" :min="0.5" :max="1.5" :step="0.05"
            :dirty="isD('scale.radiusSpread')" @revert="revert('scale.radiusSpread')" />
          <Slider label="shadow hue" suffix="°" v-model="t.scale.shadowHue" :min="0" :max="360"
            :dirty="isD('scale.shadowHue')" @revert="revert('scale.shadowHue')" />
          <Slider label="shadow chroma" v-model="t.scale.shadowChroma" :min="0" :max="0.06" :step="0.005"
            :dirty="isD('scale.shadowChroma')" @revert="revert('scale.shadowChroma')" />
          <Slider label="motion" v-model="t.scale.motion" :min="0.5" :max="2" :step="0.05"
            :dirty="isD('scale.motion')" @revert="revert('scale.motion')" />
        </template>
      </section>

      <!-- Components (advanced) -->
      <section v-if="adv" class="space-y-2">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Components</h4>
        <Select label="table headers" size="sm"
          :model-value="t.components.tableCase"
          :dirty="isD('components.tableCase')"
          :options="[{ value: 'uppercase', label: 'Uppercase micro' }, { value: 'none', label: 'Sentence case' }]"
          @update:model-value="t.components.tableCase = $event"
          @revert="revert('components.tableCase')" />
        <label class="flex items-center gap-2 text-xs cursor-pointer select-none" style="color: var(--rc-ink-muted)">
          <input type="checkbox" v-model="t.components.badgePill" class="rc-check-native" /> pill badges
        </label>
        <label class="flex items-center gap-2 text-xs cursor-pointer select-none" style="color: var(--rc-ink-muted)">
          <input type="checkbox" v-model="t.components.cardBorder" class="rc-check-native" /> card borders
        </label>
      </section>

      <!-- Contrast gate -->
      <section>
        <h4 class="text-xs uppercase tracking-widest font-mono mb-2" style="color:var(--rc-ink-faint)">Contrast · WCAG AA</h4>
        <div class="min-h-[3.5rem]">
          <p v-if="!liveReport.length" class="text-xs" style="color:var(--rc-ink-faint)">computing…</p>
          <Badge v-else-if="!fails.length" accent="success">All {{ liveReport.length }} pairs pass</Badge>
          <ul v-else class="space-y-1">
            <li v-for="f in fails" :key="f.mode + f.pair">
              <Badge accent="danger" variant="outline">{{ f.mode }} {{ f.pair }} · {{ f.ratio }} &lt; {{ f.need }}</Badge>
            </li>
          </ul>
        </div>
      </section>

      <!-- Fork / snapshot -->
      <section class="pt-1 border-t border-line">
        <h4 class="text-xs uppercase tracking-widest font-mono mb-2" style="color:var(--rc-ink-faint)">New client theme</h4>
        <div class="flex gap-2 items-center">
          <Input v-model="forkName" placeholder="client-name" size="sm" />
          <Button size="sm" variant="outline" :disabled="!forkValid" @click="emit('fork', plain(t))">Fork</Button>
        </div>
        <p class="text-xs mt-2" style="color: var(--rc-ink-faint)">
          Forks snapshot the current draft (inheritance dropped) — per-client themes should be pinned.
        </p>
      </section>
    </div>
  </Card>
</template>
