# Design rules — @reclaim/base theme

Qualitative contract. Tokens answer "what value"; this file answers "what rule".
Coding agents: these rules override any habit or default you have. When a rule
and a token conflict, the token wins for *values*, this file wins for *behavior*.

## Voice

- Confident, specific, never cute. UI copy uses plain verbs ("Save changes", not "Hang tight!").
- Sentence case everywhere. No Title Case buttons, no ALL CAPS except micro-labels
  (table headers, stat captions) which use the uppercase tracking-widest treatment.

## Structure

- Never build page chrome out of stacked bordered cards. Sections are separated by
  spacing and occasional hairlines, not nesting. Cards are for *objects* (one row,
  one service, one form), not for regions.
- One primary button per view, right-aligned in its action bar. Everything else is
  soft/outline/ghost.
- Max depth: surface → card → content. No card-in-card.

## Type

- Display font is for h1–h3, stat numbers, and empty states only. Body, labels,
  buttons: text font. Mono is for values that are machine-shaped (IDs, latency, code).
- Never set a font-family directly; use var(--rc-font-display/text/mono).

## Color

- Semantic vars only: --rc-canvas/surface/surface-2/line/line-strong/ink/ink-muted/
  ink-faint/brand*/success*/warn*/danger*. Raw --rc-<ramp>-<step> is off-limits
  outside the theme files themselves.
- Status lives in badges and left-edge accents, not in tinted whole components.
- Link color is --rc-link; a <p> never gets a color unless it is muted/faint by design.

## Motion

- Transitions ≤150ms for state changes, ≤250ms for reveals. No entrance animations
  on load, no gradient beams, no glass, no glow. Nothing loops unless it means
  something (loading indicator).

## Forbidden (the AI-look blacklist)

- Inter, Roboto, system-blue focus defaults, slate-500 borders everywhere, rounded-2xl
  as a personality, emoji as icons, gradient text, shadow-2xl on hover, `animate-…`
  on hero copy, dashboards with 4 identical stat cards and no hierarchy (use size +
  color to rank stats), tables without zebra-free hairline rhythm.

## States

Every interactive surface defines: default, hover, focus-visible (outline ring, never
`outline: none`), active, disabled (opacity .45), loading (spinner inside the button,
label preserved), empty (icon + one-line cause + primary action), error (danger text,
aria-invalid, danger ring on input). If a spec omits one, add it without asking.
