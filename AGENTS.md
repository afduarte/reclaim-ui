# AGENTS.md — Reclaim design system

This repo **is** the design system. Client-facing UI is generated from it, never
hand-styled. If you are an AI coding agent working in this repo or consuming it:

## Hard rules

1. **Never style a component with one-off colors, radii, or fonts.** All values come
   from `--rc-*` semantic vars (see `packages/ui/src/styles/tailwind.css` for the map).
   If a needed token doesn't exist, that is a design-system change: edit
   `themes/<name>.tokens.json`, run `npm run gen`, and read the contrast report.
2. **Contrast failures are not warnings to ignore.** After any theme edit run
   `npm run gen`; every ⚠ means that theme can no longer ship. Fix hue/chroma or the
   semantic mapping in `packages/tokens/index.mjs` before continuing.
3. **Read the theme's rules file** (`themes/<active-theme>.md`) before writing UI copy,
   structure, or motion. Its blacklist is binding.
4. Components live in `packages/ui/src/components`. New variants are added to the
   component CSS classes in `tailwind.css` — not to inline styles in call sites.

## Layout

- `themes/*.tokens.json` — source of truth per client theme (sparse overrides + `inherits`)
- `themes/*.rc.css` — GENERATED, never edited
- `packages/tokens` — the compiler (ramp model, semantics, contrast gate)
- `packages/ui` — Vue 3 components; reference semantic vars only
- `apps/showcase` — theme studio: live gallery + editor (`npm run dev` → :5273)
- `packages/registry` — shadcn-compatible registry build (`npm run registry:build`)

## Working loop

- Tweak visuals for a client: open the showcase, select their theme, manipulate —
  every save writes back here. Prefer 2–4 deliberate moves (font pairing, neutral tint,
  one accent) over fiddling many sliders.
- Consume from another repo: add the registry URL to `components.json`,
  `npx shadcn@canary init @reclaim/<theme>` then `add @reclaim/<theme>/<component>`.
- New client: fork their theme in the showcase (snapshot, no inheritance) and edit
  `themes/<client>.md` to encode their specific rules.

## Git etiquette

Token commits are design changes: keep `themes/<name>.tokens.json` diffs reviewable —
one theme per commit, commit message names the design intent ("acme: warm neutrals, serif display").
