<script setup>
import { ref } from "vue";
import { Button, Card, Input, Badge, Table, Select } from "@reclaim/ui";

const rows = [
  { name: "payments-api", env: "Production", status: "ok", latency: "128 ms", deployer: "m.rosa", when: "2h ago" },
  { name: "edge-cache", env: "Production", status: "warn", latency: "412 ms", deployer: "j.doe", when: "4h ago" },
  { name: "identity-service", env: "Staging", status: "ok", latency: "96 ms", deployer: "a.fern", when: "6h ago" },
  { name: "report-worker", env: "Production", status: "fail", latency: "—", deployer: "bot", when: "1d ago" },
  { name: "webhooks-relay", env: "Staging", status: "ok", latency: "204 ms", deployer: "m.rosa", when: "1d ago" },
];
const badgeFor = { ok: ["success", "Healthy"], warn: ["warn", "Degraded"], fail: ["danger", "Failing"] };

const messages = [
  { role: "user", text: "Summarize last week's incident reviews." },
  { role: "assistant", text: "Three incidents were reviewed. The payments timeout (INC-204) accounted for 61% of impact. The postmortem is drafted — want me to open the follow-up tickets?" },
];
const draft = ref("");

const showEmpty = ref(false);
const search = ref("");
</script>

<template>
  <div class="space-y-12">
    <!-- Composition: stats + table + toolbar + pagination -->
    <section>
      <h2 class="text-xl mb-4">Services</h2>

      <div class="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <p class="text-xs uppercase tracking-widest text-ink-faint">Requests / min</p>
          <p class="text-3xl font-display mt-1" style="font-family: var(--rc-font-display)">48,201</p>
          <p class="text-xs text-ink-muted mt-1"><span style="color: var(--rc-success)">▲ 4.1%</span> vs last week</p>
        </Card>
        <Card>
          <p class="text-xs uppercase tracking-widest text-ink-faint">p95 latency</p>
          <p class="text-3xl font-display mt-1" style="font-family: var(--rc-font-display)">412 ms</p>
          <p class="text-xs text-ink-muted mt-1"><span style="color: var(--rc-warn)">▲ 38 ms</span> edge-cache regressed</p>
        </Card>
        <Card>
          <p class="text-xs uppercase tracking-widest text-ink-faint">Open incidents</p>
          <p class="text-3xl font-display mt-1" style="font-family: var(--rc-font-display)">2</p>
          <p class="text-xs text-ink-muted mt-1">One SLA risk, owned by platform</p>
        </Card>
      </div>

      <Card :padded="false">
        <div class="flex items-center gap-3 px-[calc(var(--rc-space)*4)] py-[calc(var(--rc-space)*3)] border-b border-line">
          <div class="w-64"><Input v-model="search" id="svc-search" size="sm" placeholder="Search services…" /></div>
          <div class="w-36"><Select id="svc-env" :options="[{value:'all',label:'All envs'},{value:'prod',label:'Production'},{value:'stg',label:'Staging'}]" model-value="all" size="sm" /></div>
          <span class="ml-auto text-xs text-ink-faint">5 of 50</span>
          <Button size="sm" variant="outline">Export</Button>
          <Button size="sm">Deploy service</Button>
        </div>
        <Table>
          <thead>
            <tr><th>Service</th><th>Environment</th><th>Status</th><th>p50</th><th>Deployed by</th><th>When</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.name">
              <td class="font-medium">{{ r.name }}</td>
              <td class="text-ink-muted">{{ r.env }}</td>
              <td><Badge :accent="badgeFor[r.status][0]">{{ badgeFor[r.status][1] }}</Badge></td>
              <td class="font-mono text-xs">{{ r.latency }}</td>
              <td class="text-ink-muted">{{ r.deployer }}</td>
              <td class="text-ink-faint">{{ r.when }}</td>
            </tr>
          </tbody>
        </Table>
        <div class="flex items-center justify-between px-[calc(var(--rc-space)*4)] py-[calc(var(--rc-space)*3)] border-t border-line">
          <span class="text-xs text-ink-muted">Page 1 of 10</span>
          <div class="flex gap-2">
            <Button size="sm" variant="ghost" :disabled="true">Previous</Button>
            <Button size="sm" variant="ghost">Next</Button>
          </div>
        </div>
      </Card>
    </section>

    <!-- Composition: settings form -->
    <section>
      <h2 class="text-xl mb-4">Workspace settings</h2>
      <Card class="max-w-2xl">
        <h3 class="text-lg mb-1">Incident notifications</h3>
        <p class="text-sm text-ink-muted mb-5">Where should we send alerts when a service goes failing?</p>
        <div class="space-y-4">
          <Input label="Slack webhook URL" placeholder="https://hooks.slack.com/services/…" mono
            hint="Team-level webhooks are rotated automatically every 90 days" />
          <Input label="Escalation email" placeholder="oncall@reclaim.tech" error="Domain not verified for this workspace" />
          <Select label="Digest window" model-value="15" :options="[
            { value: '0', label: 'Instant' },
            { value: '15', label: 'Every 15 minutes' },
            { value: '60', label: 'Hourly digest' },
          ]" />
          <div class="flex items-center gap-2 pt-2">
            <Button>Save changes</Button>
            <Button variant="ghost">Cancel</Button>
          </div>
        </div>
      </Card>
    </section>

    <!-- Composition: AI chat thread — the surface agents build most -->
    <section>
      <h2 class="text-xl mb-4">Assistant</h2>
      <Card class="max-w-2xl" :padded="false">
        <div class="p-[calc(var(--rc-space)*5)] space-y-4">
          <div v-for="m in messages" :key="m.role">
            <p v-if="m.role === 'user'" class="text-sm ml-auto w-fit rounded-rc-lg rounded-br-rc-sm px-4 py-2.5 max-w-md"
              style="background: var(--rc-brand-solid); color: var(--rc-brand-solid-ink)">{{ m.text }}</p>
            <p v-else class="text-sm mr-auto w-fit rounded-rc-lg rounded-bl-rc-sm px-4 py-2.5 max-w-lg"
              style="background: var(--rc-surface-2); color: var(--rc-ink)">{{ m.text }}</p>
          </div>
          <div class="flex items-center gap-3 pt-2">
            <span class="inline-flex gap-1 px-2" style="color: var(--rc-ink-faint)">
              <span class="size-1.5 rounded-full bg-current animate-pulse" />
              <span class="size-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
              <span class="size-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
            </span>
            <span class="text-xs text-ink-faint">drafting follow-up tickets</span>
          </div>
        </div>
        <div class="border-t border-line p-[calc(var(--rc-space)*3)] flex gap-2">
          <Input v-model="draft" placeholder="Ask about incidents, deploys, costs…" />
          <Button :disabled="!draft.trim()">Send</Button>
        </div>
      </Card>
    </section>

    <!-- Composition: empty state -->
    <section>
      <h2 class="text-xl mb-4">Empty state</h2>
      <Card class="max-w-md text-center py-10">
        <div class="mx-auto mb-4 size-12 rounded-rc-lg border border-line bg-surface-2 grid place-items-center text-ink-faint">◫</div>
        <h3 class="text-lg">No webhooks yet</h3>
        <p class="text-sm text-ink-muted mt-1 mb-4">Events will stream here once you connect your first endpoint.</p>
        <Button size="sm">Add webhook</Button>
      </Card>
    </section>
  </div>
</template>
