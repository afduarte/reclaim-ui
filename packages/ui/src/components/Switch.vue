<script setup>
import { SwitchRoot, SwitchThumb } from "reka-ui";

// disabled etc. must land on the reka primitive, not the label.
defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: null },
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <label class="rc-switch-field">
    <SwitchRoot
      v-bind="$attrs"
      :id="props.id"
      class="rc-switch"
      :model-value="props.modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <SwitchThumb class="rc-switch__thumb" />
    </SwitchRoot>
    <span v-if="label" class="rc-check__label">{{ label }}</span>
  </label>
</template>
