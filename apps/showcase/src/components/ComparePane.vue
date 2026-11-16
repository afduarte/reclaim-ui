<script setup>
import { Button, Badge, Table } from "@reclaim/ui";

defineProps({ label: String, cls: String });
import { state } from "../themes.js";

const caption = {
  class: "font-mono text-xs uppercase tracking-widest mb-1 block",
  style: { color: "var(--rc-ink-faint)" },
};
</script>

<template>
  <div>
    <h3 class="font-mono text-xs uppercase tracking-widest mb-2" style="color: var(--rc-ink-faint)">{{ label }}</h3>
    <div
      :class="['rc-pane', cls, { dark: state.dark }]"
      style="background: var(--rc-canvas); color: var(--rc-ink); font-family: var(--rc-font-text); border: 1px solid var(--rc-line); border-radius: var(--rc-radius-lg); padding: calc(var(--rc-space) * 6)"
    >
      <h2 class="text-2xl mb-1">Service status</h2>
      <p class="text-sm mb-5" style="color: var(--rc-ink-muted)">
        Every state pinned and visible — <a href="#" @click.prevent>links</a> included.
      </p>

      <!-- button state matrix -->
      <div class="mb-5">
        <span v-bind="caption">Button states</span>
        <div class="flex gap-3">
          <div><Button size="sm">Primary</Button></div>
          <div><Button size="sm" class="is-hover">Hover</Button></div>
          <div><Button size="sm" class="is-focus">Focus</Button></div>
          <div><Button size="sm" class="is-active">Active</Button></div>
          <div><Button size="sm" :disabled="true">Off</Button></div>
        </div>
      </div>

      <!-- variants + loading -->
      <div class="mb-5">
        <span v-bind="caption">Variants</span>
        <div class="flex gap-2 flex-wrap">
          <Button size="sm" variant="soft">Soft</Button>
          <Button size="sm" variant="outline">Outline</Button>
          <Button size="sm" variant="ghost">Ghost</Button>
          <Button size="sm" accent="danger">Danger</Button>
          <Button size="sm" :loading="true">Busy</Button>
        </div>
      </div>

      <!-- input state matrix -->
      <div class="mb-5 grid grid-cols-2 gap-3">
        <div>
          <span v-bind="caption">Input · default</span>
          <input class="rc-input" value="ops@reclaim.tech" />
        </div>
        <div>
          <span v-bind="caption">Input · hover</span>
          <input class="rc-input is-hover" value="ops@reclaim.tech" />
        </div>
        <div>
          <span v-bind="caption">Input · focus</span>
          <input class="rc-input is-focus" value="ops@reclaim.tech" />
        </div>
        <div>
          <span v-bind="caption">Input · invalid</span>
          <input class="rc-input" aria-invalid="true" value="not-an-email" />
        </div>
      </div>

      <!-- native controls + badges -->
      <div class="mb-5 flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="rc-check-native" checked /> Alerts
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" name="cmp" class="rc-check-native" checked /> Compact
        </label>
        <Badge>brand</Badge>
        <Badge accent="success">healthy</Badge>
        <Badge accent="warn">degraded</Badge>
        <Badge accent="danger">failing</Badge>
      </div>

      <!-- table with pinned hover row -->
      <div class="mb-5" style="border: 1px solid var(--rc-line); border-radius: var(--rc-radius)">
        <Table>
          <thead><tr><th>Service</th><th>p50</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>payments-api</td><td class="font-mono text-xs">128 ms</td><td><Badge accent="success">ok</Badge></td></tr>
            <tr class="is-hover"><td>edge-cache ← hover pinned</td><td class="font-mono text-xs">412 ms</td><td><Badge accent="warn">slow</Badge></td></tr>
          </tbody>
        </Table>
      </div>

      <!-- depth, code, quote -->
      <div class="grid grid-cols-2 gap-4">
        <div style="background: var(--rc-surface); border: var(--rc-card-border, 1px solid var(--rc-line)); border-radius: var(--rc-radius-lg); box-shadow: var(--rc-shadow-2); padding: calc(var(--rc-space) * 4)">
          <p class="text-xs uppercase tracking-widest" style="color: var(--rc-ink-faint)">Requests / min</p>
          <p class="text-3xl" style="font-family: var(--rc-font-display)">48,201</p>
          <p class="text-xs" style="color: var(--rc-success)">▲ 4.1% vs last week</p>
        </div>
        <div>
          <pre class="font-mono text-xs" style="background: var(--rc-surface-2); border-radius: var(--rc-radius); padding: calc(var(--rc-space) * 3); margin-bottom: calc(var(--rc-space)*3)">--rc-brand-solid: oklch(…)</pre>
          <blockquote class="text-sm" style="border-left: 2px solid var(--rc-brand); padding-left: calc(var(--rc-space) * 3); color: var(--rc-ink-muted)">
            The contract, rendered twice.
          </blockquote>
        </div>
      </div>
    </div>
  </div>
</template>
