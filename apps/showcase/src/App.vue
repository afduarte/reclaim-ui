<script setup>
import { ref, onMounted } from "vue";
import { state, themeNames, setTheme, initAll, forkTheme } from "./themes.js";
import Specimens from "./views/Specimens.vue";
import Compositions from "./views/Compositions.vue";
import ThemeEditor from "./components/ThemeEditor.vue";

const view = ref("specimens");
const editorOpen = ref(true);
const forking = ref(false);
const forkName = ref("");

onMounted(initAll);

async function doFork() {
  if (!/^[a-z0-9-]{2,40}$/.test(forkName.value)) return;
  forking.value = true;
  await forkTheme(state.theme, forkName.value);
  forking.value = false;
  forkName.value = "";
}
</script>

<template>
  <div class="min-h-dvh bg-canvas text-ink">
    <!-- top bar -->
    <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <strong class="font-display text-lg leading-none" style="font-family: var(--rc-font-display)">Reclaim&nbsp;Studio</strong>
        <span class="text-xs text-ink-muted font-mono">@reclaim/{{ state.theme }}</span>

        <nav class="ml-6 flex gap-1">
          <button v-for="v in ['specimens', 'compositions']" :key="v"
            class="rounded-rc-sm px-3 py-1.5 text-sm capitalize transition-colors"
            :class="view === v ? '' : 'text-ink-muted hover:bg-surface-2'"
            :style="view === v ? { background: 'var(--rc-brand-soft)', color: 'var(--rc-brand-soft-ink)', fontWeight: 550 } : {}"
            @click="view = v">{{ v }}</button>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <select class="rc-input !h-8 !w-auto !px-2 text-sm" :value="state.theme" @change="setTheme($event.target.value)">
            <option v-for="n in themeNames" :key="n" :value="n">{{ n }}</option>
          </select>
          <button class="rc-btn rc-btn--sm rc-btn--ghost" @click="state.dark = !state.dark">
            {{ state.dark ? "Light" : "Dark" }}
          </button>
          <button class="rc-btn rc-btn--sm rc-btn--outline" @click="editorOpen = !editorOpen">
            {{ editorOpen ? "Hide editor" : "Edit theme" }}
          </button>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-7xl gap-8 px-6 py-8 items-start">
      <main class="flex-1 min-w-0">
        <Specimens v-if="view === 'specimens'" />
        <Compositions v-else />
      </main>

      <aside v-if="editorOpen" class="w-80 shrink-0 sticky top-20">
        <ThemeEditor @fork="doFork" :forking="forking" v-model:forkName="forkName" />
      </aside>
    </div>
  </div>
</template>
