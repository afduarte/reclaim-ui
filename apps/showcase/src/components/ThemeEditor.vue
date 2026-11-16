<script setup>
import { reactive, ref, watch, computed } from "vue";
import { state, workingTheme, contrastRows, saveTheme, plain } from "../themes.js";
import { DEFAULT_THEME, deepMerge } from "@reclaim/tokens";
import { Button } from "@reclaim/ui";

const emit = defineEmits(["fork"]);
defineProps({ forking: Boolean });
const forkName = defineModel("forkName", { type: String, default: "" });

const CURATED_FONTS = [
  "Fraunces", "Archivo", "Bricolage Grotesque", "Space Grotesk", "Sora", "Outfit",
  "Public Sans", "Figtree", "Albert Sans", "Geist", "Source Serif 4", "Newsreader",
  "JetBrains Mono", "IBM Plex Mono", "Fragment Mono",
];

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
watch(() => [state.theme, state.resolved[state.theme]], () => { if (!state.dirty) syncFrom(state.resolved[state.theme] ?? state.rawTokens[state.theme]); });

let timer = null;
function queueSave() {
  state.dirty = true;
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

// open picker: any Google Font, loaded live for exploration
function loadGoogleFont(family) {
  const id = `gf-${family.toLowerCase().replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,opsz,wght@0,9..144,300..900&display=swap`;
  document.head.appendChild(link);
}

function setFont(slot, family) {
  if (family && !CURATED_FONTS.includes(family)) loadGoogleFont(family);
  t.fonts[slot] = family;
}

const freeText = reactive({ display: "", text: "", mono: "" });
function applyFreeFont(slot) {
  const v = freeText[slot].trim();
  if (v) setFont(slot, v);
  freeText[slot] = "";
}

const fails = computed(() => contrastRows.value.filter((r) => !r.pass));
const accentKeys = computed(() => Object.keys(t.color?.accents ?? {}));
</script>

<template>
  <div class="rc-card p-5 space-y-6 text-sm">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold">Theme editor</h3>
      <span class="font-mono text-xs" :class="state.dirty ? 'text-ink-faint' : ''" style="color: var(--rc-ink-faint)">
        themes/{{ t.name }}.tokens.json{{ state.dirty ? " · writing" : "" }}
      </span>
    </div>
    <p v-if="state.notice" class="text-xs font-mono" style="color: var(--rc-success)">{{ state.notice }}</p>

    <!-- Type -->
    <fieldset class="space-y-3">
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Type</legend>
      <div v-for="slot in ['display', 'text', 'mono']" :key="slot">
        <label class="rc-field__label !mb-1 capitalize">{{ slot }}</label>
        <select class="rc-input" :value="t.fonts[slot]" @change="setFont(slot, $event.target.value)">
          <option v-for="f in CURATED_FONTS" :key="f" :value="f">{{ f }}</option>
          <option v-if="!CURATED_FONTS.includes(t.fonts[slot])" :value="t.fonts[slot]">{{ t.fonts[slot] }} (external)</option>
        </select>
        <div class="flex gap-1 mt-1">
          <input class="rc-input !h-7 !text-xs" placeholder="try any Google Font…" v-model="freeText[slot]"
            @keyup.enter="applyFreeFont(slot)" />
          <button class="rc-btn rc-btn--sm rc-btn--ghost" @click="applyFreeFont(slot)">load</button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">size {{ t.type.base }}px</span>
          <input type="range" min="14" max="19" step="0.5" v-model.number="t.type.base" class="w-full rc-check-native !h-auto" />
        </label>
        <label class="block">
          <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">ratio {{ t.type.ratio.toFixed(2) }}</span>
          <input type="range" min="1.067" max="1.422" step="0.001" v-model.number="t.type.ratio" class="w-full rc-check-native !h-auto" />
        </label>
      </div>
    </fieldset>

    <!-- Neutrals -->
    <fieldset class="space-y-2">
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Neutrals (hue-tinted grays)</legend>
      <label class="block">
        <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">hue {{ t.color.neutral.hue }}°</span>
        <input type="range" min="0" max="360" v-model.number="t.color.neutral.hue" class="w-full rc-check-native !h-auto" />
      </label>
      <label class="block">
        <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">chroma {{ t.color.neutral.chroma.toFixed(3) }}</span>
        <input type="range" min="0" max="0.035" step="0.001" v-model.number="t.color.neutral.chroma" class="w-full rc-check-native !h-auto" />
      </label>
    </fieldset>

    <!-- Accents -->
    <fieldset class="space-y-3">
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Accents</legend>
      <div v-for="k in accentKeys" :key="k" class="space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="size-3 rounded-full border border-line" :style="{ background: `var(--rc-${k}-600)` }" />
          <span class="font-medium capitalize">{{ k }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">hue {{ t.color.accents[k].hue }}°</span>
            <input type="range" min="0" max="360" v-model.number="t.color.accents[k].hue" class="w-full rc-check-native !h-auto" />
          </label>
          <label class="block">
            <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">chroma {{ t.color.accents[k].chroma.toFixed(3) }}</span>
            <input type="range" min="0" max="0.28" step="0.005" v-model.number="t.color.accents[k].chroma" class="w-full rc-check-native !h-auto" />
          </label>
        </div>
      </div>
    </fieldset>

    <!-- Geometry -->
    <fieldset class="space-y-2">
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Geometry</legend>
      <label class="block">
        <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">radius {{ t.scale.radius }}px</span>
        <input type="range" min="0" max="24" v-model.number="t.scale.radius" class="w-full rc-check-native !h-auto" />
      </label>
      <label class="block">
        <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">density {{ t.scale.density.toFixed(2) }}</span>
        <input type="range" min="0.85" max="1.2" step="0.01" v-model.number="t.scale.density" class="w-full rc-check-native !h-auto" />
      </label>
      <label class="block">
        <span class="font-mono text-xs" style="color:var(--rc-ink-muted)">shadow {{ t.scale.shadow.toFixed(2) }}</span>
        <input type="range" min="0" max="1" step="0.05" v-model.number="t.scale.shadow" class="w-full rc-check-native !h-auto" />
      </label>
    </fieldset>

    <!-- Contrast gate -->
    <fieldset>
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">Contrast (WCAG AA)</legend>
      <p v-if="!contrastRows.length" class="text-xs" style="color:var(--rc-ink-faint)">report pending — dev server required</p>
      <template v-else>
        <p v-if="!fails.length" class="text-xs mt-1" style="color: var(--rc-success)">All {{ contrastRows.length }} pairs pass</p>
        <ul v-else class="mt-1 space-y-0.5">
          <li v-for="f in fails" :key="f.mode + f.pair" class="font-mono text-xs" style="color: var(--rc-danger)">
            {{ f.mode }} {{ f.pair }} · {{ f.ratio }} &lt; {{ f.need }}
          </li>
        </ul>
      </template>
    </fieldset>

    <!-- Fork / snapshot -->
    <fieldset class="pt-1 border-t border-line">
      <legend class="text-xs uppercase tracking-widest font-mono" style="color:var(--rc-ink-faint)">New client theme</legend>
      <div class="flex gap-2 mt-2">
        <input class="rc-input" placeholder="client-name" v-model="forkName" pattern="[a-z0-9-]+" />
        <Button size="sm" variant="outline" :disabled="!/^[a-z0-9-]{2,40}$/.test(forkName)" @click="emit('fork')">Fork</Button>
      </div>
      <p class="text-xs mt-2" style="color: var(--rc-ink-faint)">
        Forks are snapshots (inheritance dropped) — per-client themes should be pinned.
      </p>
    </fieldset>
  </div>
</template>
