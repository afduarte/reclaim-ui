# Reclaim UI

A design system **for AI agents to build with** — one component library, many
client themes, distributed as a [shadcn-compatible registry](https://ui.shadcn.com/docs/registry).

The goal is the opposite of "the AI look": every consumer project installs
*your* components styled by *your* tokens, and every design decision (font
pairing, hue-tinted neutrals, density, shape language) lives in the theme file —
never in one-off classes agents can drift from.

## How it works

```
themes/<name>.tokens.json          ← single source of truth per client (sparse overrides + inherits)
        │  npm run gen
        ▼
themes/<name>.rc.css + report.json ← generated runtime vars + WCAG AA contrast gate
        │  npm run registry:build
        ▼
packages/registry/dist/            ← static registry: 3 bases, N style twins, components
```

- **`packages/tokens`** — the compiler. 11-step OKLCH ramps on a fixed
  lightness curve (you tune hue + chroma, legibility is structural), a
  semantic layer (`--rc-canvas/surface/line/ink/brand/...`), and a contrast
  validator that runs on every save.
- **`packages/ui`** — Vue 3 components (`Button`, `Input`, `Select`, `Card`,
  `Badge`, `Table`). They reference only semantic vars + `--rc-a-*` accent
  slots, so the same component source renders every client theme.
- **`apps/showcase`** — the theme studio (below). Gallery of specimens &
  compositions, live editor writing back to this repo, Google Font
  experimentation with a curated self-hosted ship list.
- **`packages/registry`** — shadcn registry build. Each theme ships as
  `registry:base` (for `init`) and a `registry:style` twin (for `add`), with
  design rules embedded in the item's `docs` field so agents receive them.

## Commands

```bash
npm install
npm run gen        # compile themes + contrast reports
npm run dev        # theme studio → http://localhost:5273
npm run build      # gen + showcase build + registry build
```

## Using the registry from a Vue project

```bash
npx shadcn-vue@latest add "@reclaim/base-style" "@reclaim/button" "@reclaim/input" "@reclaim/card"
```

Order matters: put the theme first when installing into a fresh project (it
suppresses shadcn's default style). For a dedicated per-client project prefer:

```bash
npx shadcn-vue@latest init http://<registry>/r/acme-base.json
```

Registry items carry their theme's design rules (`docs`), which Claude Code /
Cursor surface on install; see also `AGENTS.md` and `.claude/skills/reclaim-ui/`.

## Agent workflow (the intended loop)

1. New client → fork a theme in the studio (snapshot) → tune 2–4 deliberate
   moves: font pairing, neutral tint, one accent, density.
2. Encode taste rules in `themes/<client>.md` (quantitative stuff belongs in
   tokens, not prose).
3. `npm run gen` must stay AA-clean; commit `themes/<client>.tokens.json`
   (studio saves write here).
4. Publish (GitHub Pages workflow) → agents consume the registry; audit their
   output against the same gallery.

## Status / roadmap

- [x] Token compiler + contrast gate, 3 example themes (base, acme, verdant)
- [x] Vue component slice (6 primitives, variant system via accent slots)
- [x] Theme studio with write-through editor + font explorer
- [x] Registry build, verified end-to-end against `shadcn-vue` 2.9 CLI
- [ ] More components on Reka UI (dialog, select-menu, popover, checkbox…)
- [ ] Svelte port (same theme JSON; shadcn-svelte speaks the same registry)
- [ ] CI: fail on contrast regression (`npm run gen` currently warns)
- [ ] Per-theme component variant defaults (theme JSON → recipe selection)

Hosting: `publish-registry.yml` deploys `packages/registry/dist` to GitHub
Pages at `https://afduarte.github.io/reclaim-ui/` (set `RECLAIM_REGISTRY_HOME`
in the workflow once the repo exists there).
