<script setup>
defineProps({ title: String, note: String });
</script>

<template>
  <section class="mb-12">
    <div class="mb-4 flex items-baseline gap-3">
      <h2 class="text-xl">{{ title }}</h2>
      <span v-if="note" class="text-xs text-ink-faint">{{ note }}</span>
    </div>
    <div class="rc-card p-[calc(var(--rc-space)*6)]">
      <slot />
    </div>
  </section>
</template>
