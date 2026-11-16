<script setup>
// Swatch that opens the OS color panel on click. The component knows nothing
// about color spaces — it speaks hex; callers map hex to their own model
// (e.g. hue/chroma ramps) on update.
const props = defineProps({
  modelValue: { type: String, default: "#888888" }, // hex preview + picker seed
  shape: { type: String, default: "circle" }, // circle | square
  title: { type: String, default: "Pick a color" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <label
    class="rc-swatch"
    :class="shape === 'square' ? 'rc-swatch--square' : 'rc-swatch--circle'"
    :style="{ background: props.modelValue }"
    :title="title"
  >
    <input
      type="color"
      :value="props.modelValue"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </label>
</template>
