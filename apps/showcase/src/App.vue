<script setup>
import { ref, computed, onMounted } from "vue";
import { state, themeNames, setTheme, initAll, forkTheme } from "./themes.js";
import { Button, Select } from "@reclaim/ui";
import Specimens from "./views/Specimens.vue";
import Compositions from "./views/Compositions.vue";
import ThemeEditor from "./components/ThemeEditor.vue";

const view = ref("specimens");
const editorOpen = ref(true);
const forking = ref(false);
const forkName = ref("");

onMounted(initAll);

const themeOptions = computed(() => themeNames.value.map((n) => ({ value: n, label: n })));

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
    <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <strong class="text-lg leading-none" style="font-family: var(--rc-font-display)">Reclaim&nbsp;Studio</strong>
        <span class="font-mono text-xs" style="color: var(--rc-ink-muted)">@reclaim/{{ state.theme }}</span>

        <nav class="ml-6 flex gap-1">
          <Button
            v-for="v in ['specimens', 'compositions']"
            :key="v"
            size="sm"
            :variant="view === v ? 'soft' : 'ghost'"
            class="capitalize"
            @click="view = v"
          >{{ v }}</Button>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <div class="w-32">
            <Select size="sm" :model-value="state.theme" :options="themeOptions" @update:model-value="setTheme($event)" />
          </div>
          <Button size="sm" variant="ghost" @click="state.dark = !state.dark">
            {{ state.dark ? "Light" : "Dark" }}
          </Button>
          <Button size="sm" variant="outline" @click="editorOpen = !editorOpen">
            {{ editorOpen ? "Hide editor" : "Edit theme" }}
          </Button>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-7xl gap-8 px-6 py-8 items-start">
      <aside v-if="editorOpen" class="w-80 shrink-0 sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
        <ThemeEditor @fork="doFork" :forking="forking" v-model:forkName="forkName" />
      </aside>

      <main class="flex-1 min-w-0">
        <Specimens v-if="view === 'specimens'" />
        <Compositions v-else />
      </main>
    </div>
  </div>
</template>
