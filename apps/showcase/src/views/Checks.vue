<script setup>
import { computed, ref, watch } from "vue";
import { state, requestPatch } from "../themes.js";
import {
  DEFAULT_THEME, deepMerge, distinctness, cvdReport, harmony,
  contrastReport, resolvePalette, cvdSimulate, suggestFixes,
} from "@reclaim/tokens";
import { Badge, Button } from "@reclaim/ui";
import Section from "../components/Section.vue";

// analyzes the DRAFT when there is one, else the saved file — what you see is judged
const theme = computed(
  () =>
    state.draft ??
    state.resolved[state.theme] ??
    deepMerge(DEFAULT_THEME, state.rawTokens[state.theme] ?? { name: state.theme }),
);

const dist = computed(() => distinctness(theme.value));
const distProblems = computed(() => dist.value.filter((r) => r.level !== "ok"));
const cvd = computed(() => cvdReport(theme.value));
const harm = computed(() => harmony(theme.value));
const contrast = computed(() => contrastReport(theme.value));
// suggestFixes is the heavy analysis (candidate search) — debounce so dragging
// with this tab open stays smooth; the cheap panels stay live
const fixes = ref([]);
const fixesPending = ref(true);
let fixesTimer = null;
watch(
  () => JSON.stringify(theme.value),
  () => {
    fixesPending.value = true;
    clearTimeout(fixesTimer);
    fixesTimer = setTimeout(() => {
      fixes.value = suggestFixes(theme.value);
      fixesPending.value = false;
    }, 250);
  },
  { immediate: true },
);
const maxHeadroom = computed(
  () => [...contrast.value].sort((a, b) => b.headroom - a.headroom)[0],
);

const accentKeys = computed(() => Object.keys(theme.value.color.accents));
const solids = computed(() => {
  const pal = resolvePalette(theme.value, "light");
  return accentKeys.value.map((k) => ({ k, color: pal[`--rc-${k}-solid`] }));
});
const cvdTypes = [
  { key: "deuteran", label: "Deuteranopia" },
  { key: "protan", label: "Protanopia" },
  { key: "trit", label: "Tritanopia" },
];

const levelBadge = (level) => (level === "fail" ? "danger" : level === "warn" ? "warn" : "success");
</script>

<template>
  <div>
    <Section title="Suggested fixes" note="every candidate was verified to clear its problem without introducing new contrast failures or trading problems">
      <p v-if="fixesPending" class="text-xs font-mono" style="color: var(--rc-ink-faint)">searching for verified fixes…</p>
      <p v-else-if="!fixes.length" class="text-sm"><Badge accent="success">Nothing one-clickable — palette is in good shape</Badge></p>
      <div v-else class="space-y-1">
        <div v-for="f in fixes" :key="f.problem + f.path + f.to" class="flex items-center gap-3 py-2 border-b border-line last:border-0">
          <Badge :accent="f.severity === 'fail' ? 'danger' : f.severity === 'warn' ? 'warn' : 'brand'" variant="outline"
            style="width: 4.5rem; justify-content: center">{{ f.severity }}</Badge>
          <span class="text-sm flex-1">
            {{ f.problem }}
            <span style="color: var(--rc-ink-faint)">— {{ f.why }}</span>
          </span>
          <Button size="sm" variant="outline" @click="requestPatch(f)">Apply</Button>
        </div>
        <p class="text-xs pt-2" style="color: var(--rc-ink-faint)">
          Applied fixes land in your draft — review in Compare, then Save theme when it's right.
        </p>
      </div>
    </Section>

    <Section title="Contrast headroom" note="pass/fail is the floor — headroom is the freedom">
      <div class="space-y-2">
        <div v-for="r in contrast" :key="r.mode + r.pair" class="flex items-center gap-3">
          <span class="w-40 font-mono text-xs" style="color: var(--rc-ink-muted)">{{ r.mode }} {{ r.pair }}</span>
          <div class="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div class="h-full rounded-full"
              :style="{ width: `${Math.min(100, (r.ratio / 12) * 100)}%`, background: r.pass ? 'var(--rc-success-solid)' : 'var(--rc-danger-solid)' }" />
          </div>
          <span class="w-24 text-right font-mono text-xs">{{ r.ratio }} <span style="color: var(--rc-ink-faint)">(+{{ r.headroom }})</span></span>
          <Badge :accent="r.pass ? 'success' : 'danger'" variant="outline" style="width: 4.5rem; justify-content: center">
            {{ r.pass ? "pass" : "fail" }}
          </Badge>
        </div>
        <p v-if="maxHeadroom && maxHeadroom.headroom > 4" class="text-xs pt-2" style="color: var(--rc-ink-muted)">
          Most slack: <strong>{{ maxHeadroom.mode }} {{ maxHeadroom.pair }}</strong> (+{{ maxHeadroom.headroom }}) —
          you could afford a softer ink, a tinted surface, or a more adventurous chroma there without losing AA.
        </p>
      </div>
    </Section>

    <Section title="Distinctness" note="ΔE2000 between the colors as they actually render — objective, not opinion">
      <p v-if="!distProblems.length" class="text-sm"><Badge accent="success">All {{ dist.length }} comparisons clearly separable</Badge></p>
      <div v-else class="space-y-2">
        <div v-for="r in distProblems" :key="r.mode + r.pair" class="flex items-center gap-3">
          <Badge :accent="levelBadge(r.level)" variant="outline" style="width: 4.5rem; justify-content: center">{{ r.level }}</Badge>
          <span class="w-40 font-mono text-xs" style="color: var(--rc-ink-muted)">{{ r.mode }} {{ r.pair }}</span>
          <span class="font-mono text-xs w-14">{{ r.dE }}</span>
          <span class="text-xs" style="color: var(--rc-ink-muted)">{{ r.why }}</span>
        </div>
      </div>
    </Section>

    <Section title="Color vision" note="status colors must survive deuteranopia/protanopia/tritanopia — accessibility, not taste">
      <div class="space-y-4">
        <div v-for="t in cvdTypes" :key="t.key" class="flex items-center gap-3">
          <span class="w-32 text-xs font-mono" style="color: var(--rc-ink-muted)">{{ t.label }}</span>
          <div class="flex gap-1">
            <span v-for="s in solids" :key="s.k" class="size-8 rounded-rc-sm border border-line"
              :style="{ background: cvdSimulate(s.color, t.key) }" :title="`${s.k} simulated`" />
          </div>
        </div>
        <div v-if="!cvd.length" class="text-sm"><Badge accent="success">No status confusions under any simulation</Badge></div>
        <div v-else class="space-y-1.5">
          <div v-for="r in cvd" :key="r.type + r.pair" class="flex items-center gap-3">
            <Badge :accent="r.level === 'fail' ? 'danger' : 'warn'" variant="outline" style="width: 4.5rem; justify-content: center">{{ r.level }}</Badge>
            <span class="w-40 font-mono text-xs" style="color: var(--rc-ink-muted)">{{ r.type }} · {{ r.pair }}</span>
            <span class="text-xs" style="color: var(--rc-ink-muted)">
              dE {{ r.dE }} — {{ r.level === "fail" ? "these will be confused; shift one hue" : "distinguishable with effort; consider more separation" }}
            </span>
          </div>
        </div>
      </div>
    </Section>

    <Section title="Harmony" note="advisory vocabulary — unconventional is allowed, incoherent is not">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm">Scheme:</span>
          <Badge>{{ harm.scheme }}</Badge>
        </div>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <div v-for="p in harm.pairs" :key="p.a + p.b" class="flex items-baseline gap-2 text-xs">
            <span class="font-mono" style="color: var(--rc-ink-muted)">{{ p.a }} ↔ {{ p.b }}</span>
            <span class="font-medium">{{ p.rel }}</span>
            <span style="color: var(--rc-ink-faint)">{{ p.angle }}°</span>
          </div>
        </div>
        <ul v-if="harm.notes.length" class="space-y-1 pt-1 border-t border-line">
          <li v-for="n in harm.notes" :key="n" class="text-xs" style="color: var(--rc-warn)">{{ n }}</li>
        </ul>
        <p v-else class="text-xs" style="color: var(--rc-ink-faint)">No coherence warnings — relationships look intentional.</p>
      </div>
    </Section>
  </div>
</template>
