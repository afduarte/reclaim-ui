<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  min: { type: [Number, String], default: 0 },
  max: { type: [Number, String], default: 100 },
  step: { type: [Number, String], default: 1 },
  label: { type: String, default: null },
  // how to render the numeric readout: prefix/suffix strings, or override entirely
  valueText: { type: String, default: null },
  suffix: { type: String, default: "" },
  decimals: { type: Number, default: null },
});
const emit = defineEmits(["update:modelValue", "commit"]);

const display = computed(() => {
  if (props.valueText != null) return props.valueText;
  const n = Number(props.modelValue);
  const shown = props.decimals != null ? n.toFixed(props.decimals) : String(Math.round(n * 1000) / 1000);
  return `${shown}${props.suffix}`;
});
</script>

<template>
  <label class="rc-slider">
    <span v-if="label" class="rc-slider__label">{{ label }}<b class="rc-slider__value">{{ display }}</b></span>
    <input
      type="range"
      class="rc-range"
      :min="min"
      :max="max"
      :step="step"
      :value="Number(props.modelValue)"
      @input="emit('update:modelValue', parseFloat($event.target.value))"
      @change="emit('commit')"
    />
  </label>
</template>
