<script setup>
const props = defineProps({
  accent: { type: String, default: null }, // null | success | warn | danger | brand
  variant: { type: String, default: "soft" }, // soft | outline
});

const accentVars = () => {
  if (!props.accent || props.accent === "brand") return null;
  const a = props.accent;
  return {
    "--rc-a-soft": `var(--rc-${a}-soft)`,
    "--rc-a-soft-ink": `var(--rc-${a}-soft-ink)`,
    "--rc-a-border": `var(--rc-${a}-border)`,
    "--rc-a": `var(--rc-${a})`,
  };
};
</script>

<template>
  <span
    class="rc-badge rc-badge--dot"
    :class="{ 'rc-badge--outline': variant === 'outline' }"
    :style="accentVars()"
  ><slot /></span>
</template>
