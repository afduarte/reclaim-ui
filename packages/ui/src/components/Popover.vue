<script setup>
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";

// Generic anchored popover: pass the toggleable element through #trigger and
// the floating panel through the default slot. `open` is optional — leave it
// undefined for an uncontrolled popover.
const props = defineProps({
  side: { type: String, default: "bottom" },
  align: { type: String, default: "start" },
  sideOffset: { type: Number, default: 6 },
  open: { type: Boolean, default: undefined },
});
const emit = defineEmits(["update:open"]);
</script>

<template>
  <PopoverRoot :open="props.open" @update:open="emit('update:open', $event)">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="rc-popover"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :collision-padding="8"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
