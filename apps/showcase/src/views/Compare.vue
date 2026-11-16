<script setup>
import { computed, watch, onBeforeUnmount } from "vue";
import { state } from "../themes.js";
import { DEFAULT_THEME, deepMerge, buildThemeCSS } from "@reclaim/tokens";
import ComparePane from "../components/ComparePane.vue";

const saved = computed(
  () =>
    state.resolved[state.theme] ??
    deepMerge(DEFAULT_THEME, state.rawTokens[state.theme] ?? { name: state.theme }),
);
const draft = computed(() => state.draft ?? saved.value);
const hasDraft = computed(
  () => !!state.draft && JSON.stringify(state.draft) !== JSON.stringify(saved.value),
);

// each pane carries its own scoped copy of the theme CSS — class selectors on
// the pane beat the inline draft vars on <html>, so "saved" stays truthful
function applyCSS(id, theme, sel) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = buildThemeCSS(theme, sel, `${sel}.dark`);
}
watch([saved, draft], () => {
  applyCSS("rc-pane-saved-css", saved.value, ".rc-pane-saved");
  applyCSS("rc-pane-draft-css", draft.value, ".rc-pane-draft");
}, { immediate: true });
onBeforeUnmount(() => {
  for (const id of ["rc-pane-saved-css", "rc-pane-draft-css"]) document.getElementById(id)?.remove();
});
</script>

<template>
  <div>
    <div class="mb-4 flex items-baseline gap-3">
      <h2 class="text-xl">Saved vs draft</h2>
      <span class="text-xs" style="color: var(--rc-ink-faint)">
        {{ hasDraft ? "left is the file on disk, right is your unsaved draft" : "no draft yet — the two are identical; edit something" }}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-6 items-start">
      <ComparePane label="Saved file" cls="rc-pane-saved" />
      <ComparePane label="Draft" cls="rc-pane-draft" />
    </div>
  </div>
</template>
