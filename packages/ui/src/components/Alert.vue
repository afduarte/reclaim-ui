<script setup>
import { computed } from "vue";

const props = defineProps({
  accent: { type: String, default: null }, // null | success | warn | danger
  title: { type: String, default: null },
});

// Accent indirection (Button/Badge pattern): the left edge reads var(--rc-a).
const accentVars = computed(() => {
  if (!props.accent || props.accent === "brand") return null;
  const a = props.accent;
  return {
    "--rc-a-solid": `var(--rc-${a}-solid)`,
    "--rc-a-solid-hover": `var(--rc-${a}-solid-hover)`,
    "--rc-a-solid-ink": `var(--rc-${a}-solid-ink)`,
    "--rc-a-soft": `var(--rc-${a}-soft)`,
    "--rc-a-soft-ink": `var(--rc-${a}-soft-ink)`,
    "--rc-a-border": `var(--rc-${a}-border)`,
    "--rc-a": `var(--rc-${a})`,
  };
});
</script>

<template>
  <div class="rc-alert" :style="accentVars" role="alert">
    <p v-if="title" class="rc-alert__title">{{ title }}</p>
    <div class="rc-alert__body"><slot /></div>
  </div>
</template>
