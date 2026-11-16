<script setup>
import { reactive, ref, watch, computed } from "vue";
import { state, workingTheme, contrastRows, saveTheme, plain, ensureFonts, loadFont, previewTheme, clearPreview, FONT_LOADERS } from "../themes.js";
import { DEFAULT_THEME, deepMerge, rampHex, pickColor } from "@reclaim/tokens";
import { Button, Input, Select, Slider, ColorPicker, Card, Badge } from "@reclaim/ui";

const emit = defineEmits(["fork"]);
defineProps({ forking: Boolean });
const forkName = defineModel("forkName", { type: String, default: "" });

const CURATED_FONTS = Object.keys(FONT_LOADERS);
const fontOptions = CURATED_FONTS.map((f) => ({ value: f, label: f }));

// ---- editable mirror + session baseline ------------------------------------
// t        = live editor state (what the preview shows)
// baseline = the theme as it was when this session opened it. Saving does NOT
//            move the baseline: "revert" always means "back to what it was".
const t = reactive(deepMerge(DEFAULT_THEME, workingTheme.value));
const baseline = ref(plain(t));

let internalAssign = false;
const syncFrom = (src) => {
  if (!src) return;
  const merged = deepMerge(DEFAULT_THEME, plain(src));
  if (JSON.stringify(merged) === JSON.stringify(t)) return;
  internalAssign = true;
  Object.assign(t, plain(merged));
};
syncFrom(state.resolved[state.theme]);
// baseline resets only when a session context begins (theme opened/switched/
// forked) — NOT after saves, or "revert" would forget what the session started
// with. resolved arrives async, so we latch until it lands for this theme.
let resetBaselineOnSync = true;
watch(() => state.theme, () => { resetBaselineOnSync = true; });
watch(
  () => [state.theme, state.resolved[state.theme]],
  () => {
    if (state.dirty) return;
    syncFrom(state.resolved[state.theme] ?? state.rawTokens[state.theme]);
    if (resetBaselineOnSync && state.resolved[state.theme]) {
      baseline.value = plain(t);
      resetBaselineOnSync = false;
    }
  },
);

// ---- dirty / revert ----------------------------------------------------------
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
function revertAll() {
  Object.assign(t, plain(baseline.value));
  saveNow();
}

// ---- persistence lifecycle -------------------------------------------------
// Preview is instant (inline vars); saves are commit-driven (slider release,
// color-panel close, font apply) with a slow safety net for programmatic edits.
let saving = false;
let pending = false;
let mutCount = 0;
let timer = null;

async function saveNow() {
  clearTimeout(timer);
  if (saving) { pending = true; return; }
  saving = true;
  let lastSeen = mutCount;
  do {
    pending = false;
    lastSeen = mutCount;
    const ok = await saveTheme(plain(t));
    if (!ok) break;
  } while (pending); // user moved again mid-save -> persist the latest, not the stale
  saving = false;
  if (lastSeen === mutCount) {
    clearPreview(); // quiet page, file CSS matches preview exactly: hand over
    state.dirty = false;
  }
}

function queueSave() {
  state.dirty = true;
  mutCount++;
  previewTheme(plain(t)); // reflow-free live feedback on every input event
  clearTimeout(timer);
  timer = setTimeout(saveNow, 1500); // safety net: edits with no commit signal
}
watch(t, () => {
  if (internalAssign) { internalAssign = false; return; }
  queueSave();
}, { deep: true });

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
    t.fonts[slot] = family;
    saveNow(); // async apply has no native commit event — persist now
  } else {
    loadGoogleFont(family);
    t.fonts[slot] = family;
  }
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

const fails = computed(() => contrastRows.value.filter((r) => !r.pass));
const accentKeys = computed(() => Object.keys(t.color?.accents ?? {}));
const forkValid = computed(() => /^[a-z0-9-]{2,40}$/.test(forkName.value));
</script>

<template>
  <Card>
    <div class="space-y-6 text-sm">
      <div>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-base font-semibold">Theme editor</h3>
          <Button v-if="anyDirty" size="sm" variant="ghost" @click="revertAll">Revert all</Button>
        </div>
        <p class="text-xs leading-relaxed mt-1" style="color: var(--rc-ink-muted)">
          Previews instantly, writes on release. Controls turn amber when they differ from
          the theme as opened — ↺ puts one back, Revert all puts everything back.
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
            :dirty="isD('type.base')" @commit="saveNow" @revert="revert('type.base')" />
          <Slider label="ratio" :decimals="3" v-model="t.type.ratio" :min="1.067" :max="1.422" :step="0.001"
            :dirty="isD('type.ratio')" @commit="saveNow" @revert="revert('type.ratio')" />
        </div>
      </section>

      <!-- Neutrals -->
      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <ColorPicker :model-value="seedHex('neutral')" shape="square" title="Pick the neutral tint — the grays follow it"
            :dirty="isD('color.neutral.hue') || isD('color.neutral.chroma')"
            @update:model-value="applyPick('neutral', null, $event)" @commit="saveNow"
            @revert="revert('color.neutral.hue'); revert('color.neutral.chroma')" />
          <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Neutrals · hue-tinted grays</h4>
        </div>
        <Slider label="hue" suffix="°" v-model="t.color.neutral.hue" :min="0" :max="360"
          :dirty="isD('color.neutral.hue')" @commit="saveNow" @revert="revert('color.neutral.hue')" />
        <Slider label="chroma" :decimals="3" v-model="t.color.neutral.chroma" :min="0" :max="0.035" :step="0.001"
          :dirty="isD('color.neutral.chroma')" @commit="saveNow" @revert="revert('color.neutral.chroma')" />
      </section>

      <!-- Accents -->
      <section class="space-y-3">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Accents</h4>
        <div v-for="k in accentKeys" :key="k" class="space-y-1.5">
          <div class="flex items-center gap-2">
            <ColorPicker :model-value="seedHex('accent', k)" :title="`Pick a color for ${k}`"
              :dirty="isD(`color.accents.${k}.hue`) || isD(`color.accents.${k}.chroma`)"
              @update:model-value="applyPick('accent', k, $event)" @commit="saveNow"
              @revert="revert(`color.accents.${k}.hue`); revert(`color.accents.${k}.chroma`)" />
            <span class="font-medium capitalize">{{ k }}</span>
          </div>
          <div class="space-y-1">
            <Slider label="hue" suffix="°" v-model="t.color.accents[k].hue" :min="0" :max="360"
              :dirty="isD(`color.accents.${k}.hue`)" @commit="saveNow" @revert="revert(`color.accents.${k}.hue`)" />
            <Slider label="chroma" :decimals="3" v-model="t.color.accents[k].chroma" :min="0" :max="0.28" :step="0.005"
              :dirty="isD(`color.accents.${k}.chroma`)" @commit="saveNow" @revert="revert(`color.accents.${k}.chroma`)" />
          </div>
        </div>
      </section>

      <!-- Geometry -->
      <section class="space-y-1.5">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Geometry</h4>
        <Slider label="radius" suffix="px" v-model="t.scale.radius" :min="0" :max="24"
          :dirty="isD('scale.radius')" @commit="saveNow" @revert="revert('scale.radius')" />
        <Slider label="density" :decimals="2" v-model="t.scale.density" :min="0.85" :max="1.2" :step="0.01"
          :dirty="isD('scale.density')" @commit="saveNow" @revert="revert('scale.density')" />
        <Slider label="shadow" :decimals="2" v-model="t.scale.shadow" :min="0" :max="1" :step="0.05"
          :dirty="isD('scale.shadow')" @commit="saveNow" @revert="revert('scale.shadow')" />
      </section>

      <!-- Contrast gate -->
      <section>
        <h4 class="text-xs uppercase tracking-widest font-mono mb-2" style="color:var(--rc-ink-faint)">Contrast · WCAG AA</h4>
        <div class="min-h-[3.5rem]">
          <p v-if="!contrastRows.length" class="text-xs" style="color:var(--rc-ink-faint)">report pending — dev server required</p>
          <Badge v-else-if="!fails.length" accent="success">All {{ contrastRows.length }} pairs pass</Badge>
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
          <Button size="sm" variant="outline" :disabled="!forkValid" @click="emit('fork')">Fork</Button>
        </div>
        <p class="text-xs mt-2" style="color: var(--rc-ink-faint)">
          Forks are snapshots (inheritance dropped) — per-client themes should be pinned.
        </p>
      </section>
    </div>
  </Card>
</template>
