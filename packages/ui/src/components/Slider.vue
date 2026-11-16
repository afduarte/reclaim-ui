<script setup>
const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  min: { type: [Number, String], default: 0 },
  max: { type: [Number, String], default: 100 },
  step: { type: [Number, String], default: 1 },
  label: { type: String, default: null },
  suffix: { type: String, default: "" },
  dirty: { type: Boolean, default: false }, // differs from session baseline
  trackGradient: { type: String, default: null }, // CSS background for the track
});
const emit = defineEmits(["update:modelValue", "commit", "revert"]);

const set = (raw) => {
  const n = parseFloat(raw);
  if (Number.isFinite(n)) emit("update:modelValue", n);
};
</script>

<template>
  <div class="rc-slider" :class="{ 'rc-slider--dirty': dirty }">
    <div v-if="label || dirty" class="rc-slider__head">
      <span class="rc-slider__name">{{ label }}</span>
      <span class="rc-slider__controls">
        <span class="rc-slider__valuebox">
          <input
            class="rc-slider__num"
            type="number"
            :min="min"
            :max="max"
            :step="step"
            :value="Number(props.modelValue)"
            @input="set($event.target.value)"
            @change="emit('commit')"
          />
          <span v-if="suffix" class="rc-slider__suffix">{{ suffix }}</span>
        </span>
        <button
          v-if="dirty"
          class="rc-revert"
          type="button"
          title="Revert to session baseline"
          @click.prevent="emit('revert')"
        >↺</button>
      </span>
    </div>
    <input
      type="range"
      class="rc-range"
      :aria-label="label"
      :style="trackGradient ? { '--range-bg': trackGradient } : null"
      :min="min"
      :max="max"
      :step="step"
      :value="Number(props.modelValue)"
      @input="set($event.target.value)"
      @change="emit('commit')"
    />
  </div>
</template>
