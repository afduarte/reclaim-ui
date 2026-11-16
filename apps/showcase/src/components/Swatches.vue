<script setup>
import { computed } from "vue";
import { state } from "../themes.js";

const props = defineProps({ ramp: { type: String, default: "neutral" } });

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const resolved = computed(() => state.resolved[state.theme] ?? {});
const info = computed(() => {
  const c = resolved.value.color;
  if (!c) return null;
  return props.ramp === "neutral" ? c.neutral : c.accents?.[props.ramp] ?? null;
});
</script>

<template>
  <div>
    <div class="grid grid-cols-11 gap-1 mb-2">
      <div
        v-for="s in steps"
        :key="s"
        class="h-14 rounded-rc-sm border border-line"
        :style="{ background: `var(--rc-${ramp}-${s})` }"
        :title="`--rc-${ramp}-${s}`"
      />
    </div>
    <div class="grid grid-cols-11 gap-1">
      <span v-for="s in steps" :key="s" class="text-center font-mono text-xs text-ink-faint">{{ s }}</span>
    </div>
    <p v-if="info" class="mt-2 font-mono text-xs text-ink-muted">
      {{ ramp }}: hue {{ info.hue }} · chroma {{ info.chroma }}
    </p>
  </div>
</template>
