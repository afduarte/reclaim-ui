<script setup>
import { ref, useId } from "vue";
import Calendar from "./Calendar.vue";
import Popover from "./Popover.vue";

// Date-only field: an input-looking trigger that opens a Calendar in a
// popover. Time-of-day selection is deliberately not part of this component.
// (The sibling imports below are rewritten by the registry build when the
// components ship to separate directories — keep these exact paths.)
const props = defineProps({
  modelValue: { type: Date, default: null },
  label: { type: String, default: null },
  hint: { type: String, default: null },
  error: { type: String, default: null },
  placeholder: { type: String, default: "Pick a date" },
  size: { type: String, default: "md" }, // sm | md
  id: { type: String, default: null },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);

const sizeStyle = () =>
  props.size === "sm" ? { height: "calc(var(--rc-control-h) * 0.82)", fontSize: "var(--rc-text-xs)" } : null;

const displayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const display = () => (props.modelValue ? displayFmt.format(props.modelValue) : "");

const autoId = useId();
const fieldId = () => props.id ?? autoId;
const invalid = () => Boolean(props.error);

function onPick(d) {
  emit("update:modelValue", d);
  open.value = false;
}
</script>

<template>
  <div class="rc-field">
    <label v-if="label" :for="fieldId()" class="rc-field__label">{{ label }}</label>
    <Popover v-model:open="open">
      <template #trigger>
        <button
          type="button"
          :id="fieldId()"
          class="rc-input rc-datepicker__trigger"
          :style="sizeStyle()"
          :aria-invalid="invalid() ? 'true' : undefined"
        >
          <span v-if="modelValue">{{ display() }}</span>
          <span v-else class="rc-datepicker__placeholder">{{ placeholder }}</span>
          <svg class="rc-datepicker__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <rect width="18" height="18" x="3" y="4" rx="2" stroke="currentColor" stroke-width="2" />
            <path d="M3 10h18" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </template>
      <Calendar :model-value="modelValue" @update:model-value="onPick" />
    </Popover>
    <p v-if="error" class="rc-field__error">{{ error }}</p>
    <p v-else-if="hint" class="rc-field__hint">{{ hint }}</p>
  </div>
</template>
