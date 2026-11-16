<script setup>
import { reactive, ref, watch, computed } from "vue";
import { state, workingTheme, contrastRows, saveTheme, setTheme, plain, ensureFonts, loadFont, previewTheme, clearPreview, FONT_LOADERS } from "../themes.js";
import { DEFAULT_THEME, deepMerge, rampHex, pickColor, contrastReport } from "@reclaim/tokens";
import { Button, Input, Select, Slider, ColorPicker, Card, Badge } from "@reclaim/ui";

const emit = defineEmits(["fork"]);
defineProps({ forking: Boolean });
const forkName = defineModel("forkName", { type: String, default: "" });

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
const isD = (path) => dig(t, path) !== dig(baseline.value, path);
const revert = (path) => { put(t, path, dig(baseline.value, path)); };
const anyDirty = computed(() => JSON.stringify(plain(t)) !== JSON.stringify(baseline.value));

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
  previewTheme(plain(t));
}, { deep: true });

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
  try { return contrastReport(plain(t)); } catch { return contrastRows.value; }
});
const fails = computed(() => liveReport.value.filter((r) => !r.pass));
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
        </div>
        <div class="space-y-1">
          <Slider label="size" suffix="px" :decimals="1" v-model="t.type.base" :min="14" :max="19" :step="0.5"
            :dirty="isD('type.base')" @revert="revert('type.base')" />
          <Slider label="ratio" :decimals="3" v-model="t.type.ratio" :min="1.067" :max="1.422" :step="0.001"
            :dirty="isD('type.ratio')" @revert="revert('type.ratio')" />
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
          :dirty="isD('color.neutral.hue')" @revert="revert('color.neutral.hue')" />
        <Slider label="chroma" :decimals="3" v-model="t.color.neutral.chroma" :min="0" :max="0.035" :step="0.001"
          :dirty="isD('color.neutral.chroma')" @revert="revert('color.neutral.chroma')" />
      </section>

      <!-- Accents -->
      <section class="space-y-3">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Accents</h4>
        <div v-for="k in accentKeys" :key="k" class="space-y-1.5">
          <div class="flex items-center gap-2">
            <ColorPicker :model-value="seedHex('accent', k)" :title="`Pick a color for ${k}`"
              :dirty="isD(`color.accents.${k}.hue`) || isD(`color.accents.${k}.chroma`)"
              @update:model-value="applyPick('accent', k, $event)"
              @revert="revert(`color.accents.${k}.hue`); revert(`color.accents.${k}.chroma`)" />
            <span class="font-medium capitalize">{{ k }}</span>
          </div>
          <div class="space-y-1">
            <Slider label="hue" suffix="°" v-model="t.color.accents[k].hue" :min="0" :max="360"
              :dirty="isD(`color.accents.${k}.hue`)" @revert="revert(`color.accents.${k}.hue`)" />
            <Slider label="chroma" :decimals="3" v-model="t.color.accents[k].chroma" :min="0" :max="0.28" :step="0.005"
              :dirty="isD(`color.accents.${k}.chroma`)" @revert="revert(`color.accents.${k}.chroma`)" />
          </div>
        </div>
      </section>

      <!-- Geometry -->
      <section class="space-y-1.5">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Geometry</h4>
        <Slider label="radius" suffix="px" v-model="t.scale.radius" :min="0" :max="24"
          :dirty="isD('scale.radius')" @revert="revert('scale.radius')" />
        <Slider label="density" :decimals="2" v-model="t.scale.density" :min="0.85" :max="1.2" :step="0.01"
          :dirty="isD('scale.density')" @revert="revert('scale.density')" />
        <Slider label="shadow" :decimals="2" v-model="t.scale.shadow" :min="0" :max="1" :step="0.05"
          :dirty="isD('scale.shadow')" @revert="revert('scale.shadow')" />
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
