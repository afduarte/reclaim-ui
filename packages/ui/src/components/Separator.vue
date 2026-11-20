<script setup>
import { Separator } from "reka-ui";

defineProps({
  orientation: { type: String, default: "horizontal" },
  decorative: { type: Boolean, default: true },
});
</script>

<template>
  <Separator class="rc-separator" :orientation="orientation" :decorative="decorative" />
</template>
