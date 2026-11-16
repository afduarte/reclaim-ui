<script setup>
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: null },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  size: { type: String, default: "md" }, // sm | md
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);

const sizeStyle = () =>
  props.size === "sm" ? { height: "calc(var(--rc-control-h) * 0.82)", fontSize: "var(--rc-text-xs)" } : null;
</script>

<template>
  <div class="rc-field">
    <label v-if="label" :for="id" class="rc-field__label">{{ label }}</label>
    <select
      :id="id"
      class="rc-input"
      :style="[sizeStyle(), { appearance: 'auto' }]"
      :value="props.modelValue"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
