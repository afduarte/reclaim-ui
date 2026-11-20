<script setup>
import { computed } from "vue";
import { ToastClose, ToastDescription, ToastRoot, ToastTitle } from "reka-ui";

const props = defineProps({
  title: { type: String, default: "" },
  description: { type: String, default: null },
  accent: { type: String, default: null }, // null | success | warn | danger
});

// Dismissal lifetime is owned by the store (see ../toast.js), so the primitive
// never auto-closes itself.
const duration = Infinity;

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
  <ToastRoot class="rc-toast" :style="accentVars" :duration="duration">
    <ToastTitle class="rc-toast__title">{{ title }}</ToastTitle>
    <ToastDescription v-if="description" class="rc-toast__desc">{{ description }}</ToastDescription>
    <ToastClose class="rc-toast__close" aria-label="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" />
      </svg>
    </ToastClose>
  </ToastRoot>
</template>
