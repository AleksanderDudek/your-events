# Design: apply the "Idź na miasto" design system

**Date:** 2026-07-17
**Status:** approved (brainstorming), pending implementation plan

## Goal

Restyle the app to the "Idź na miasto" design system supplied in
`~/Downloads/Your Events Website Design (1)/claude-code-prompt.md` (sections
§1–§6). Everything reels-related is out of scope. The result: a warm,
disciplined, coral-primary look with color-coded category badges and full
light **and** dark mode.

## Context and constraints

- **Stack mismatch with the brief.** The brief assumes "plain HTML/CSS". This
  repo is Next.js 16 (App Router, `output: 'export'` — fully static) with
  **MUI + Emotion + SCSS**. Every §6 component rule is re-expressed as MUI
  theme overrides and/or SCSS modules, not raw CSS.
- **Two parallel styling systems** both must react to dark mode:
  1. Raw CSS custom properties in `src/styles/tokens.scss` (consumed by SCSS
     modules and inline `var(--color-*)`).
  2. The MUI theme palette in `src/styles/theme.ts` (consumed by MUI
     components and `sx`).
- **Static export = no server.** A theme cannot be chosen server-side; it must
  be resolved before paint by an inline script to avoid a flash of the wrong
  theme (FOUC).
- **Category color is currently DB-driven.** `DbCategory` carries `color` and
  `icon` (`src/types/event.types.ts`), and `EventCard` paints its last-resort
  fallback box with `categoryData.color`.

## Decisions (locked during brainstorming)

1. **Scope:** tokens + MUI theme + the components §6 specifies. Not a screen/IA
   rework (design-system §06 mockups are reference only, not a rebuild).
2. **Category color:** the brief's 13 hardcoded hues **override** the DB. They
   become `--cat-<slug>` CSS vars; the DB `color` remains a fallback for any
   category outside the 13.
3. **Dark mode:** auto (`prefers-color-scheme`) **plus** a manual header toggle
   that overrides and persists (localStorage), applied as `data-theme` on
   `<html>`.
4. **Fallback art:** the 130 `fallbacks/*.png` (1080×1080 category art,
   mislabelled "reels fallback" but not video) are imported as EventCard image
   placeholders.

## Architecture

### Theming mechanism (the load-bearing decision)

Use **MUI's built-in CSS-variables mode**:

```ts
createTheme({
  cssVariables: { colorSchemeSelector: '[data-theme]' },
  colorSchemes: { light: { palette: {...} }, dark: { palette: {...} } },
  // ...typography, shape, components
})
```

- Emits both palettes as CSS variables at build time and flips via the **same
  `[data-theme]` attribute** the brief's CSS uses — one signal drives both
  styling systems.
- No hydration re-render, no FOUC on the static export.
- Preserves MUI color math (`alpha()`, channel tokens), which plain `var()`
  palette strings break.

The alternative — two `createTheme` objects swapped by React state — was
rejected: it re-renders on hydration and flashes the wrong theme on a static
export.

**No-FOUC init:** an inline `<script>` in `layout.tsx` `<head>` sets
`data-theme` before paint:

```
theme = localStorage['inm-theme']  // 'light' | 'dark' | null
if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.dataset.theme = theme
```

`tokens.scss` dark values are scoped to `[data-theme="dark"]` **and**
`@media (prefers-color-scheme: dark)` so raw `var(--color-*)` consumers flip in
lockstep with MUI.

### Token strategy (minimize diff)

`tokens.scss` gets the brief's §1 names (`--primary`, `--bg`, `--surface`,
`--surface-2`, `--ink`, `--ink-muted`, `--border`, `--shadow`, radii). To avoid
editing every `var(--color-*)` call site, the **existing `--color-*` names are
kept as aliases** pointing at the new brief tokens, e.g.:

```
--primary: #F4553B;
--color-accent-primary: var(--primary);   /* alias — existing consumers keep working */
--color-bg-base: var(--bg);
--color-text-primary: var(--ink);
/* ...etc */
```

A dark block redefines the brief tokens (`--bg`, `--surface`, `--ink`,
`--primary`, `--shadow`, …) under `[data-theme="dark"]` + the media query; the
aliases inherit automatically.

### Category color tokens

Add 13 `--cat-<slug>` variables. `<slug> = slugify(display_name)` — this is
exactly the brief's slugs (e.g. `sport-i-fitness`, `wellness-i-duchowosc`), so
one `var(--cat-${slugify(name)})` lookup needs no mapping table. Each var
**flips to the lighter variant** under dark mode:

```
:root { --cat-muzyka: #7C5CE0; /* ...13 base hues (brief §2 "Base") */ }
[data-theme="dark"], @media (prefers-color-scheme: dark) {
  --cat-muzyka: #A78BFA; /* ...13 dark-mode text variants */
}
```

- **Chip / icon / text** use `var(--cat-<slug>)` directly (flips by theme).
- **Chip background** is a tint: `color-mix(in oklab, var(--cat-<slug>) 14%,
  var(--surface))` on light, `22%` on dark (§2).
- **Solid fills** that need the saturated base regardless of theme (selected
  chip, EventCard color-box last resort) use a non-flipping
  `--cat-<slug>-solid` set once in `:root` (= the light base hue). This is the
  one place two vars per category are justified.
- **Resolver:** a small helper (e.g. `categoryColorVar(name)` in
  `src/lib/utils.ts`) returns `var(--cat-${slugify(name)}, <db-color-or-fallback>)`
  so any category outside the 13 still resolves via the DB `color`.

## Component-level changes

| Area | File(s) | Change |
|---|---|---|
| Tokens | `src/styles/tokens.scss` | Brief §1 palette + aliases; dark block; 13 `--cat-*` (+ `-solid`). |
| MUI theme | `src/styles/theme.ts` | `cssVariables` + `colorSchemes{light,dark}`; button pill radius / 44px / `translateY(-1px)` hover / no default shadow; chip, input, card overrides per §6. |
| Fonts | `src/app/layout.tsx`, `tokens.scss` | Google Fonts `<link>` → Bricolage Grotesque + Figtree, `subset=latin-ext`; point `--font-display`/`--font-body` at them. `--font-mono` untouched (brief specifies no web mono). |
| Logo | `src/components/common/AppHeader/AppHeader.tsx` | 4-point spark SVG (coral) left of the wordmark. |
| Favicon | `public/favicons/*` | Spark-on-coral-tile. |
| Category icons | `public/category-icons/*.svg` | Regenerate all 13 from §5 (uniform 1.8 stroke, `currentColor`); **adds** `sztuka-i-wystawy`, `imprezy-i-rozrywka`, `dla-dzieci`, `zwierzeta`. |
| Inline icon | `src/components/ui/CategoryIcon/` (new) | Slug→path map from §5; inline SVG so `color: var(--cat-<slug>)` tints it. |
| CategoryChip | `src/components/ui/CategoryChip/CategoryChip.tsx` | Per-category tinted pill (§2): `color-mix` bg, `--cat-<slug>` text, 16px inline icon; selected = solid color + white. Fix stray `var(--font-dm-sans)` → `--font-body`. |
| EventCard | `src/components/common/EventCard/EventCard.tsx` + `.module.scss` | Date badge → stacked day-number (Bricolage 800 20px) + month tile (§6), reusing `formatDay`/`formatMonth`. Fallback chain gains category art: real → `/fallbacks/{slug}-{1..10}.png` (deterministic per event) → color box. |
| Fallback art | `public/fallbacks/*.png` | Copy the 130 PNGs in. |
| AppHeader | `AppHeader.tsx` + `.module.scss` | Glass = `--bg` @ 80% + blur; add `ThemeToggle` beside the PL/EN switch. |
| AppFooter | `src/components/common/AppFooter/*` | `--surface-2` bg, muted text, spark symbol. |
| Search / buttons | `SearchInput`, theme overrides | Pill radius, `--surface-2` bg, 2px coral focus ring, ≥44px targets. |
| Body canvas | `src/app/globals.scss` | Replace the loud 4-color radial wash with the brief's disciplined warm canvas (subtle single tint); add dark variant. |
| Dark-mode plumbing | `layout.tsx` (inline script), `ThemeToggle` (new client component) | Set/persist `data-theme`; toggle sun/moon. |

## Data flow (category color, end to end)

```
event.categoryMain ("Taniec")
  → slugify() → "taniec"
  → CSS var  → var(--cat-taniec)   [#EE4F86 light / #F78BB4 dark]
       ├─ CategoryChip text + inline icon color
       ├─ chip bg = color-mix(... 14%/22%, var(--surface))
       └─ selected chip / color-box = var(--cat-taniec-solid)
  → not one of the 13? → falls back to event.category.color (DB)
```

## Error handling / edge cases

- **Category not in the 13:** resolver's CSS-var fallback yields the DB color;
  no crash, no missing color.
- **Missing fallback PNG:** `onError` advances to the existing color-box stage
  — the current last resort is preserved.
- **`prefers-reduced-motion`:** all new hover/press motion (150–200ms) respects
  it (already honored in `globals.scss`; extend to new transitions).
- **Polish diacritics:** `latin-ext` subset is mandatory on the font link.
- **Contrast:** text ≥ 4.5:1; no pure `#fff` text on tinted chips in dark mode
  (use the light category variant as text, per §7).

## Testing

- Unit specs that assert current styling must be updated:
  `CategoryChip.spec.tsx` (color/variant assertions),
  `EventCard.spec.tsx` (fallback-chain / date-badge assertions).
- e2e suite (`e2e/*.spec.ts`) must still pass; watch `a11y.spec.ts` (contrast,
  focus) and any selector coupled to header/footer markup.
- **Build verification:** run `next build` (static export) and a dev render
  early to confirm MUI `cssVariables` mode + Emotion behave under
  `output: 'export'`. This is the primary technical risk.

## Explicitly out of scope (reels)

- Design-system §07 "Reels (Remotion)".
- `uploads/*.mp4`, `reels-prompt.md`, `Reels Fallback Gallery.dc.html`.
- The `fallbacks/` PNGs are reused **only** as web card art; no video, no
  Remotion, no reels UI.

## Risks

1. **MUI cssVariables × static export × Emotion** — verify build + no FOUC
   early; may need `AppRouterCacheProvider` from `@mui/material-nextjs` if style
   ordering flickers (currently not used).
2. **Alias token churn** — the `--color-*`→brief-token aliasing must cover every
   name currently referenced; a missed alias renders as an unset var.
3. **Test coupling** — styling assertions in specs and any markup-coupled e2e
   selectors need updating alongside the components.
