<script setup>
import { computed, useAttrs } from "vue";

const props = defineProps({
  variant: { type: String, default: "solid" }, // solid | soft | outline | ghost
  size: { type: String, default: "md" }, // sm | md | lg
  accent: { type: String, default: null }, // null = brand; success | warn | danger
  icon: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
// NOTE: no `click` emit declared — @click falls through to the native button.

// Accent indirection: components read var(--rc-a-*), the theme supplies brand
// defaults; a non-null accent maps the named accent onto those slots at runtime.
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

const classes = computed(() => [
  "rc-btn",
  `rc-btn--${props.variant}`,
  { "rc-btn--sm": props.size === "sm", "rc-btn--lg": props.size === "lg" },
  { "rc-btn--icon": props.icon },
]);
</script>

<template>
  <button
    :class="classes"
    :style="accentVars"
    :disabled="$attrs.disabled ?? loading"
    :data-loading="loading || undefined"
  >
    <span v-if="loading" aria-hidden="true" class="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot v-else />
  </button>
</template>
