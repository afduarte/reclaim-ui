<script setup>
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: null },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  size: { type: String, default: "md" }, // sm | md
  dirty: { type: Boolean, default: false },
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue", "revert"]);

const sizeStyle = () =>
  props.size === "sm" ? { height: "calc(var(--rc-control-h) * 0.82)", fontSize: "var(--rc-text-xs)" } : null;
</script>

<template>
  <div class="rc-field">
    <div v-if="label" class="flex items-baseline justify-between">
      <label :for="id" class="rc-field__label !mb-0">{{ label }}</label>
      <button
        v-if="dirty"
        class="rc-revert"
        type="button"
        title="Revert to session baseline"
        @click.prevent="emit('revert')"
      >↺</button>
    </div>
    <select
      :id="id"
      class="rc-input"
      :class="{ 'rc-input--dirty': dirty }"
      :style="[sizeStyle(), { appearance: 'auto' }]"
      :value="props.modelValue"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
