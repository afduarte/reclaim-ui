<script setup>
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: null },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="rc-field">
    <label v-if="label" :for="id" class="rc-field__label">{{ label }}</label>
    <select
      :id="id"
      class="rc-input"
      style="appearance: auto"
      :value="props.modelValue"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
