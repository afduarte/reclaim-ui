<script setup>
import { ref, computed } from "vue";
import { ToastProvider } from "reka-ui";
import { Button, Input, Badge, Select, Checkbox, Switch, Alert, Separator, Toast } from "@reclaim/ui";
import { state } from "../themes.js";
import Section from "../components/Section.vue";
import Swatches from "../components/Swatches.vue";

const demoText = ref("editable value");
const demoInvalid = ref("not-an-email");
const demoSelect = ref("weekly");
const demoCheck = ref(false);
const demoSwitch = ref(false);

const geometryNote = computed(() => {
  const t = state.resolved[state.theme];
  return t ? `radius ${t.scale.radius}px · density ${t.scale.density}` : "";
});
</script>

<template>
  <div>
    <Section title="Typography" note="each slot labeled · display: var(--rc-font-display) · text: var(--rc-font-text) · mono: var(--rc-font-mono)">
      <div class="space-y-5">
        <!-- slot specimens: bound to the vars, so they track drags live -->
        <div class="grid gap-3 rounded-rc border border-line bg-canvas px-5 py-4">
          <div class="flex items-baseline gap-4">
            <span class="w-16 font-mono text-xs uppercase tracking-widest" style="color: var(--rc-ink-faint)">Display</span>
            <p class="text-2xl truncate" style="font-family: var(--rc-font-display); letter-spacing: var(--rc-tracking-heading)">
              Reclaim the look you own — AaBbCc 0123
            </p>
          </div>
          <div class="flex items-baseline gap-4">
            <span class="w-16 font-mono text-xs uppercase tracking-widest" style="color: var(--rc-ink-faint)">Text</span>
            <p style="font-family: var(--rc-font-text)">The quick brown fox jumps over the lazy dog — AaBbCc 0123</p>
          </div>
          <div class="flex items-baseline gap-4">
            <span class="w-16 font-mono text-xs uppercase tracking-widest" style="color: var(--rc-ink-faint)">Mono</span>
            <p class="text-sm" style="font-family: var(--rc-font-mono)">const theme = { radius: 10 } — AaBbCc 0123</p>
          </div>
        </div>

        <h1 class="text-4xl">The quip: reclaim the look you own</h1>
        <h2 class="text-3xl">H2 — section titles, generous tracking-negative</h2>
        <h3 class="text-2xl">H3 — card titles</h3>
        <h4 class="text-xl">H4 — group labels</h4>
        <p class="text-lg max-w-prose">
          Lead paragraph — body text at <code class="font-mono text-sm">--rc-text-lg</code>. Notice the
          rhythm: <em>em-italic</em> stays inside the measure, <strong>strong</strong> uses weight not color.
        </p>
        <p class="max-w-prose">
          Body — sentence about hairline borders and hue-tinted neutrals. Inline
          <a href="#" @click.prevent>links read as designed</a>, not as accidents.
        </p>
        <p class="text-sm text-ink-muted max-w-prose">
          Muted helper text (ink-muted on surface must pass AA — the compiler checks this on every save).
        </p>
        <p class="text-xs text-ink-faint uppercase tracking-widest">Micro label / table headers</p>
        <pre class="font-mono text-sm bg-surface-2 rounded-rc p-3 overflow-x-auto">const theme = { radius: 10, neutral: { hue: 264, chroma: 0.011 } }</pre>
        <blockquote class="border-l-2 pl-4 text-lg" style="border-color: var(--rc-brand)">
          “A design system is a contract between the design and everyone who builds with it — including agents.”
        </blockquote>
      </div>
    </Section>

    <Section title="Buttons" note="variants × sizes × states">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button accent="danger">Danger</Button>
          <Button accent="success" variant="soft">Success</Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button :loading="true">Loading</Button>
          <Button :disabled="true">Disabled</Button>
          <Button class="rc-btn--icon">＋</Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outline" accent="danger">Outline danger</Button>
          <Button variant="ghost" accent="danger">Ghost danger</Button>
          <Button variant="ghost" accent="success">Ghost success</Button>
          <Button variant="outline">Outline neutral</Button>
        </div>
        <p class="text-xs text-ink-faint">Tab through the row: focus rings use <code class="font-mono">--rc-ring-soft</code>, never browser defaults.</p>
      </div>
    </Section>

    <Section title="Form fields">
      <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-w-3xl">
        <Input label="Project name" v-model="demoText" hint="Shown to your clients" />
        <Select label="Billing cadence" v-model="demoSelect" :options="[
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'annual', label: 'Annual' },
        ]" />
        <Input label="Owner email" v-model="demoInvalid"
          :error="demoInvalid.includes('@') ? null : 'Enter a valid email address'" mono />
        <div class="flex items-end gap-4 pb-1 col-span-2">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="rc-check-native" checked /> Allow preview comments
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="radio" name="r" class="rc-check-native" checked /> Compact tables
          </label>
        </div>
      </div>
    </Section>

    <Section title="Selection" note="checkbox + switch — reka-ui primitives, states via data-*">
      <div class="flex flex-wrap items-center gap-6">
        <Checkbox v-model="demoCheck" label="Email me digests" />
        <Checkbox :model-value="true" label="Checked" />
        <Checkbox label="Disabled" :disabled="true" />
        <Switch v-model="demoSwitch" label="Smooth charts" />
        <Switch :model-value="true" label="On" />
        <Switch label="Disabled" :disabled="true" />
      </div>
    </Section>

    <Section title="Alerts" note="left-edge accent carries status, body stays neutral">
      <div class="space-y-3 max-w-2xl">
        <Alert title="Sync started">Queued 12 items; nothing to roll back.</Alert>
        <Alert accent="success" title="Deploy succeeded">Registry published at 14:23 — no contrast regressions.</Alert>
        <Alert accent="warn" title="Stale data">3 sensors have not reported for over 6 hours.</Alert>
        <Alert accent="danger" title="Permission denied">Only admins can delete a location with rooms.</Alert>
      </div>
    </Section>

    <Section title="Separators" note="hairlines for rhythm, not borders around regions">
      <div class="max-w-xl space-y-3">
        <p class="text-sm">Two sentences apart, a hairline between.</p>
        <Separator />
        <div class="flex items-center gap-3 text-sm">
          Vertical <Separator orientation="vertical" /> keeps columns apart.
        </div>
      </div>
    </Section>

    <Section title="Toasts" note="store-driven; Toaster mounts once at the app root">
      <div class="space-y-3 max-w-sm">
        <ToastProvider>
          <Toast title="Saved" description="Location renamed." accent="success" />
          <Toast title="Something went wrong" description="Session expired — sign in again." accent="danger" />
        </ToastProvider>
      </div>
    </Section>

    <Section title="Badges" note="soft + outline, per accent">
      <div class="flex flex-wrap gap-2">
        <Badge>brand</Badge>
        <Badge accent="success">deployed</Badge>
        <Badge accent="warn">rate limited</Badge>
        <Badge accent="danger">failing</Badge>
        <Badge variant="outline">outline</Badge>
        <Badge variant="outline" accent="success">outline</Badge>
      </div>
    </Section>

    <Section title="Color ramps" note="OKLCH — hue + chroma come from the theme, legibility is compiled">
      <div class="space-y-6">
        <Swatches ramp="neutral" />
        <Swatches ramp="brand" />
        <Swatches ramp="success" />
        <Swatches ramp="warn" />
        <Swatches ramp="danger" />
      </div>
    </Section>

    <Section title="Geometry" note="radius · density · shadow strength">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="w-20 h-20 border border-line bg-surface" style="border-radius: var(--rc-radius-sm)" />
        <div class="w-20 h-20 border border-line bg-surface" style="border-radius: var(--rc-radius)" />
        <div class="w-20 h-20 border border-line bg-surface" style="border-radius: var(--rc-radius-lg)" />
        <div class="w-20 h-20 border border-line bg-surface" style="border-radius: var(--rc-radius-xl)" />
        <div class="w-32 h-20 bg-surface border border-line rounded-rc" style="box-shadow: var(--rc-shadow-1)" />
        <div class="w-32 h-20 bg-surface border border-line rounded-rc" style="box-shadow: var(--rc-shadow-2)" />
        <div class="w-32 h-20 bg-surface border border-line rounded-rc" style="box-shadow: var(--rc-shadow-3)" />
        <div class="font-mono text-xs text-ink-muted leading-relaxed">
          {{ geometryNote }}<br />
          control height = 36px × density<br />
          spacing unit = 4px × density
        </div>
      </div>
    </Section>
  </div>
</template>
