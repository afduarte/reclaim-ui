<script setup>
const props = defineProps({
  padded: { type: Boolean, default: true },
  elevated: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
});
</script>

<template>
  <div
    class="rc-card"
    :class="[padded ? 'p-[calc(var(--rc-space)*5)]' : '', { 'rc-card--interactive': interactive }]"
    :style="elevated ? { boxShadow: 'var(--rc-shadow-3)' } : null"
  >
    <slot />
  </div>
</template>
