---
name: reclaim-ui
description: Use when building or modifying any UI in projects consuming the @reclaim registry. Enforces the Reclaim design system: semantic tokens only, copy-in components, per-client themes, WCAG AA contrast, and the theme's docs rules.
---

# Reclaim Design System

This project consumes the Reclaim registry (`@reclaim` in components.json).

## Rules

1. Build UI from `@reclaim` components already installed in the project
   (`src/components/reclaim/`). Check that folder before creating anything new.
2. Never hardcode colors, radii, shadows, or font stacks. Use Tailwind semantic
   utilities (`bg-canvas`, `text-ink-muted`, `border-line`) or `--rc-*` CSS vars.
   Raw ramp vars (`--rc-neutral-500`) are off-limits outside theme files.
3. Read the active theme's rules — they were installed with the base and are
   binding: run `curl <registry-home>/r/base-style.json | jq -r .docs` or view
   the registry site. Follow its blacklist (fonts, motion, composition).
4. New variants/behaviors belong in the design-system repo, not in one-off
   call-site styles. If something can't be composed from existing parts, stop
   and flag it as a design-system change.
5. Every interactive surface you add must include: hover, focus-visible,
   disabled, loading (for async actions), empty and error states.
6. Dark mode: the app must set/remove `.dark` on `<html>`; tokens handle the
   rest. Never branch UI code on color scheme.

## Install (new project)

```
npx shadcn-vue@latest add "@reclaim/base-style" "@reclaim/button" "@reclaim/input" …
```

List what exists: `curl <registry-home>/registry.json | jq '.items[] | {name, type}'`
