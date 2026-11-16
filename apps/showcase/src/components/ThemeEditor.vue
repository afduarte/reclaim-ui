<script setup>
import { reactive, watch, computed } from "vue";
import { state, workingTheme, contrastRows, saveTheme, plain, ensureFonts, previewTheme, FONT_LOADERS } from "../themes.js";
import { DEFAULT_THEME, deepMerge, rampHex, pickColor } from "@reclaim/tokens";
import { Button, Input, Select, Slider, ColorPicker, Card, Badge } from "@reclaim/ui";

const emit = defineEmits(["fork"]);
defineProps({ forking: Boolean });
const forkName = defineModel("forkName", { type: String, default: "" });

const CURATED_FONTS = Object.keys(FONT_LOADERS);
const fontOptions = CURATED_FONTS.map((f) => ({ value: f, label: f }));

// local editable mirror: defaults <- raw file <- resolved (as it arrives)
const t = reactive(deepMerge(DEFAULT_THEME, workingTheme.value));
let internalAssign = false;
const syncFrom = (src) => {
  if (!src) return;
  const merged = deepMerge(DEFAULT_THEME, plain(src));
  if (JSON.stringify(merged) === JSON.stringify(t)) return;
  internalAssign = true;
  Object.assign(t, plain(merged));
};
syncFrom(state.resolved[state.theme]);
watch(
  () => [state.theme, state.resolved[state.theme]],
  () => { if (!state.dirty) syncFrom(state.resolved[state.theme] ?? state.rawTokens[state.theme]); },
);

let timer = null;
function queueSave() {
  state.dirty = true;
  // instant, reflow-free preview via inline vars on <html>; disk write follows
  previewTheme(plain(t));
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const ok = await saveTheme(plain(t));
    if (ok) t.name = state.theme; // save may have re-materialized file
  }, 250);
}
watch(t, () => {
  if (internalAssign) { internalAssign = false; return; }
  queueSave();
}, { deep: true });

// fonts ---------------------------------------------------------------------
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

function setFont(slot, family) {
  if (!family) return;
  if (CURATED_FONTS.includes(family)) ensureFonts({ fonts: { [slot]: family } });
  else loadGoogleFont(family);
  t.fonts[slot] = family;
}

const freeText = reactive({ display: "", text: "", mono: "" });
function applyFreeFont(slot) {
  const v = freeText[slot].trim();
  if (v) setFont(slot, v);
  freeText[slot] = "";
}

// color pickers: hex from the OS panel -> ramp params -------------------------
const seedHex = (kind, key) => {
  const spec = kind === "neutral" ? t.color.neutral : t.color.accents[key];
  return rampHex(spec?.hue ?? 0, spec?.chroma ?? 0, 6); // step 600
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

// for the live slot preview: stack the chosen family over its generic fallback
const fontStack = (family, kind) =>
  `"${family}", ${kind === "mono" ? "ui-monospace, monospace" : "ui-sans-serif, sans-serif"}`;
</script>

<template>
  <Card>
    <div class="space-y-6 text-sm">
      <div>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">Theme editor</h3>
          <span class="font-mono text-xs" style="color: var(--rc-ink-faint)">
            themes/{{ t.name }}.tokens.json{{ state.dirty ? " · writing" : "" }}
          </span>
        </div>
        <p class="text-xs leading-relaxed mt-1" style="color: var(--rc-ink-muted)">
          Every control edits that one file, live — swatches open a color picker, sliders fine-tune
          hue/chroma, and the gallery re-renders from the result. Undo any session with
          <code class="font-mono">git checkout -- themes/{{ t.name }}.tokens.json</code>.
        </p>
        <p v-if="state.notice" class="text-xs font-mono mt-1" style="color: var(--rc-success)">{{ state.notice }}</p>
      </div>

      <!-- Type -->
      <section class="space-y-3">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Type</h4>

        <!-- live slot preview: each line renders in the font it labels -->
        <div class="rounded-rc border border-line bg-canvas px-4 py-3 space-y-2">
          <p class="text-xl leading-none" :style="{ fontFamily: fontStack(t.fonts.display), letterSpacing: 'var(--rc-tracking-heading)' }">
            Display — some text here
          </p>
          <p :style="{ fontFamily: fontStack(t.fonts.text) }">
            Text — some other text
          </p>
          <p class="text-sm" :style="{ fontFamily: fontStack(t.fonts.mono, 'mono') }">
            Mono — some more text
          </p>
        </div>

        <div v-for="slot in ['display', 'text', 'mono']" :key="slot" class="space-y-1">
          <Select
            :label="slot"
            :model-value="t.fonts[slot]"
            :options="fontOptions.concat(CURATED_FONTS.includes(t.fonts[slot]) ? [] : [{ value: t.fonts[slot], label: t.fonts[slot] + ' (external)' }])"
            size="sm"
            @update:model-value="setFont(slot, $event)"
          />
          <div class="flex gap-1 items-center">
            <Input v-model="freeText[slot]" placeholder="try any Google Font…" size="sm" @keyup.enter="applyFreeFont(slot)" />
            <Button size="sm" variant="ghost" @click="applyFreeFont(slot)">load</Button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Slider label="size" suffix="px" v-model="t.type.base" :min="14" :max="19" :step="0.5" />
          <Slider label="ratio" :decimals="2" v-model="t.type.ratio" :min="1.067" :max="1.422" :step="0.001" />
        </div>
      </section>

      <!-- Neutrals -->
      <section class="space-y-2">
        <div class="flex items-center gap-2">
          <ColorPicker :model-value="seedHex('neutral')" shape="square" title="Pick the neutral tint — the grays follow it"
            @update:model-value="applyPick('neutral', null, $event)" />
          <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Neutrals · hue-tinted grays</h4>
        </div>
        <Slider label="hue" suffix="°" v-model="t.color.neutral.hue" :min="0" :max="360" />
        <Slider label="chroma" :decimals="3" v-model="t.color.neutral.chroma" :min="0" :max="0.035" :step="0.001" />
      </section>

      <!-- Accents -->
      <section class="space-y-3">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Accents</h4>
        <div v-for="k in accentKeys" :key="k" class="space-y-1.5">
          <div class="flex items-center gap-2">
            <ColorPicker :model-value="seedHex('accent', k)" :title="`Pick a color for ${k}`"
              @update:model-value="applyPick('accent', k, $event)" />
            <span class="font-medium capitalize">{{ k }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <Slider label="hue" suffix="°" v-model="t.color.accents[k].hue" :min="0" :max="360" />
            <Slider label="chroma" :decimals="3" v-model="t.color.accents[k].chroma" :min="0" :max="0.28" :step="0.005" />
          </div>
        </div>
      </section>

      <!-- Geometry -->
      <section class="space-y-2">
        <h4 class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Geometry</h4>
        <Slider label="radius" suffix="px" v-model="t.scale.radius" :min="0" :max="24" />
        <Slider label="density" :decimals="2" v-model="t.scale.density" :min="0.85" :max="1.2" :step="0.01" />
        <Slider label="shadow" :decimals="2" v-model="t.scale.shadow" :min="0" :max="1" :step="0.05" />
      </section>

      <!-- Contrast gate -->
      <section>
        <h4 class="text-xs uppercase tracking-widest font-mono mb-2" style="color:var(--rc-ink-faint)">Contrast · WCAG AA</h4>
        <p v-if="!contrastRows.length" class="text-xs" style="color:var(--rc-ink-faint)">report pending — dev server required</p>
        <Badge v-else-if="!fails.length" accent="success">All {{ contrastRows.length }} pairs pass</Badge>
        <ul v-else class="space-y-1">
          <li v-for="f in fails" :key="f.mode + f.pair">
            <Badge accent="danger" variant="outline">{{ f.mode }} {{ f.pair }} · {{ f.ratio }} &lt; {{ f.need }}</Badge>
          </li>
        </ul>
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
