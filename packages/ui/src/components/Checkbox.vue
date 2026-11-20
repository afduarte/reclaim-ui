<script setup>
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";

// checked/indeterminate/disabled etc. must land on the reka primitive, not the label.
defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: null },
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <label class="rc-check">
    <CheckboxRoot
      v-bind="$attrs"
      :id="props.id"
      class="rc-check__box"
      :model-value="props.modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <CheckboxIndicator>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="3" />
        </svg>
      </CheckboxIndicator>
    </CheckboxRoot>
    <span v-if="label" class="rc-check__label">{{ label }}</span>
  </label>
</template>
