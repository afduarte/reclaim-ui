<script setup>
import { useId } from "vue";

const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  label: { type: String, default: null },
  hint: { type: String, default: null },
  error: { type: String, default: null },
  mono: { type: Boolean, default: false },
  type: { type: String, default: "text" },
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);

const autoId = useId();
const fieldId = () => props.id ?? autoId;
const invalid = () => Boolean(props.error);
</script>

<template>
  <div class="rc-field">
    <label v-if="label" :for="fieldId()" class="rc-field__label">{{ label }}</label>
    <input
      :id="fieldId()"
      class="rc-input"
      :class="{ 'rc-input--mono': mono }"
      :type="type"
      :value="props.modelValue"
      :aria-invalid="invalid() ? 'true' : undefined"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" class="rc-field__error">{{ error }}</p>
    <p v-else-if="hint" class="rc-field__hint">{{ hint }}</p>
  </div>
</template>
