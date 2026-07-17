# "Idź na miasto" Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the your-events app to the "Idź na miasto" design system (coral primary, warm neutrals, category-coded badges, Bricolage Grotesque + Figtree, light **and** dark mode), excluding everything reels-related.

**Architecture:** One `[data-theme]` attribute drives both styling systems. MUI runs in `cssVariables` + `colorSchemes` mode so its palette flips on `[data-theme="dark"]`; the same selector flips the raw `--color-*`/`--cat-*` custom properties in `tokens.scss`. MUI's `InitColorSchemeScript` sets the attribute before paint (no FOUC on the static export) and owns persistence; a `ThemeToggle` uses MUI's `useColorScheme()`. Category color resolves from `--cat-<slug>` where `<slug> = slugify(display_name)`, falling back to the DB `color`.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), MUI 7 + Emotion, SCSS modules, TypeScript, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-17-idz-na-miasto-design-system-design.md`

---

## Refinements to the spec (decided while planning, consistent with its intent)

1. **Dark-mode mechanism uses MUI built-ins**, not a hand-rolled inline script. `InitColorSchemeScript attribute="data-theme"` (no FOUC) + `useColorScheme()` (toggle) replace the custom script and the `inm-theme` localStorage key. MUI always resolves `system` to a concrete `light`/`dark` value on the attribute.
2. **Dark CSS-var block is keyed to `[data-theme="dark"]` only — NOT also `@media (prefers-color-scheme: dark)`.** Because MUI's script always writes the attribute, a parallel media query would override an explicit user choice (user picks Light while OS is Dark → media query would wrongly force dark). The attribute is the single source of truth.
3. **Category icons:** the brief's 13 stroke glyphs live in one source (`CategoryIcon/paths.ts`) rendered inline (so `currentColor` tints them in chips). The existing `public/category-icons/*.svg` (600×400 gradient illustrations) are **left as-is** — EventCard no longer uses them (its fallback becomes the PNG art), so regenerating them adds no value and is dropped. All 13 glyphs still exist in the codebase in the brief's style, satisfying "add the 4 missing."

---

## File structure

**Modified:**
- `src/styles/tokens.scss` — brief §1 palette + aliases + dark block + 13 `--cat-*`
- `src/styles/theme.ts` — `cssVariables` + `colorSchemes{light,dark}` + §6 component overrides
- `src/lib/utils.ts` — export `slugify`; add `categoryColorVar()`, `categoryFallbackImage()`
- `src/app/layout.tsx` — font link, `InitColorSchemeScript`, `suppressHydrationWarning`
- `src/app/providers.tsx` — `defaultMode="system"` on ThemeProvider
- `src/app/globals.scss` — disciplined body canvas + dark variant
- `src/app/manifest.ts` — `theme_color`, `background_color`
- `src/components/ui/CategoryChip/CategoryChip.tsx` (+ `.spec.tsx`) — per-category tint + icon
- `src/components/common/EventCard/EventCard.tsx` + `.module.scss` (+ `.spec.tsx`) — date badge + PNG fallback
- `src/components/common/AppHeader/AppHeader.tsx` — spark logo + glass + ThemeToggle mount
- `src/components/common/AppFooter/AppFooter.tsx` + `.module.scss` — surface-2 + spark
- `src/components/ui/SearchInput/SearchInput.tsx` — pill radius + surface-2

**Created:**
- `src/components/ui/CategoryIcon/paths.tsx` — 13 glyph path data (single source; `.tsx` because it contains JSX)
- `src/components/ui/CategoryIcon/CategoryIcon.tsx` (+ `.spec.tsx`) — inline tinted SVG
- `src/components/common/ThemeToggle/ThemeToggle.tsx` — sun/moon, `useColorScheme()`
- `src/components/common/Spark/Spark.tsx` — the 4-point spark symbol (reused by header/footer)
- `public/fallbacks/*.png` — 130 category-art placeholders (copied in)
- `public/favicons/favicon.svg` — spark on coral tile (overwrite)

---

## Task 1: Verify baseline is green

**Files:** none (checkpoint).

- [ ] **Step 1: Run the unit suite**

Run: `pnpm test`
Expected: PASS (all current specs green). Record the pass count so later tasks can confirm no regressions.

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 3: Confirm dev build compiles**

Run: `pnpm build`
Expected: static export completes without error. This is the baseline for the MUI-cssVariables risk check.

---

## Task 2: Palette & core tokens (`tokens.scss`)

**Files:**
- Modify: `src/styles/tokens.scss`

Replace the palette with the brief's §1 values, keep every existing `--color-*` name as an alias (so no call site changes), and add a `[data-theme="dark"]` block. `--font-*` are updated in Task 4.

- [ ] **Step 1: Rewrite the `:root` block and add dark block**

Replace the entire contents of `src/styles/tokens.scss` with:

```scss
// "Idź na miasto" design system tokens (brief §1).
//   Brief tokens are the source of truth; the legacy --color-* names are kept
//   as aliases so existing var(--color-*) consumers keep working untouched.
//   Dark mode flips on [data-theme="dark"] ONLY — MUI's InitColorSchemeScript
//   always writes that attribute (resolving `system` to light/dark), so a
//   prefers-color-scheme media query here would override explicit user choice.

:root {
  // --- Brand (brief §1) ---
  --primary: #f4553b;
  --primary-hover: #d9432f;
  --primary-tint: #fde9e4;
  --accent: #ffc53d;

  // --- Warm neutrals ---
  --bg: #fbf8f3;
  --surface: #ffffff;
  --surface-2: #f4efe7;
  --ink: #221c26;
  --ink-muted: #6e6575;
  --border: #e9e2d9;
  --shadow: 0 2px 8px rgba(34, 28, 38, 0.07), 0 8px 24px rgba(34, 28, 38, 0.06);

  // --- Radii & motion ---
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;
  --transition-base: 200ms ease;
  --transition-slow: 400ms ease;

  // --- Typography (families set in Task 4) ---
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'DM Mono', ui-monospace, 'SFMono-Regular', monospace;

  // --- Legacy aliases → brief tokens (do not remove; many components use these) ---
  --color-bg-base: var(--bg);
  --color-bg-surface: var(--surface);
  --color-bg-elevated: var(--surface-2);
  --color-accent-primary: var(--primary);
  --color-accent-primary-dark: var(--primary-hover);
  --color-accent-primary-light: #f86a50;
  --color-accent-warm: #f07a1f;
  --color-accent-cool: #1fa8a0;
  --color-accent-violet: #7c5ce0;
  // rgba (not color-mix) so Dart Sass parses these without issue; coral @ alpha.
  --color-accent-tint-soft: rgba(244, 85, 59, 0.05);
  --color-accent-tint: rgba(244, 85, 59, 0.12);
  --color-accent-tint-strong: rgba(244, 85, 59, 0.18);
  --color-text-primary: var(--ink);
  --color-text-secondary: var(--ink-muted);
  --color-text-muted: #9c93a6;
  --color-status-active: #2fa860;
  --color-status-few: #c98a1d;
  --color-status-sold: #e0533f;
  --color-status-cancelled: #9c93a6;
  --color-border: var(--border);
  --color-border-strong: #d8cec1;
  --color-border-accent: var(--primary);
  --color-error: #e0533f;
  --color-surface-glass: rgba(251, 248, 243, 0.8); // = --bg @ 80% (light)

  --shadow-card: var(--shadow);
  --shadow-card-hover: 0 12px 30px rgba(34, 28, 38, 0.14);
  --shadow-elevated: 0 16px 40px rgba(34, 28, 38, 0.16);

  --sidebar-width: 280px;
  --header-height: 64px;
}

[data-theme='dark'] {
  --primary: #f86a50;
  --primary-hover: #f4553b;
  --primary-tint: #3a2521;
  --bg: #17131c;
  --surface: #221c29;
  --surface-2: #2b2434;
  --ink: #f5f1ea;
  --ink-muted: #9c93a6;
  --border: #332b3d;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.35);

  --color-text-muted: #857c90;
  --color-border-strong: #453b52;
  --color-surface-glass: rgba(23, 19, 28, 0.8); // = --bg @ 80% (dark)
  --shadow-card: var(--shadow);
  --shadow-card-hover: 0 12px 30px rgba(0, 0, 0, 0.45);
  --shadow-elevated: 0 16px 40px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2: Verify build still compiles**

Run: `pnpm build`
Expected: success. (All `.scss` color values are hex/rgba/`var()` — no `color-mix` in Sass, so nothing for Dart Sass to choke on. `color-mix` is used only in Emotion `sx` at runtime, Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.scss
git commit -m "feat(tokens): apply Idź na miasto palette + dark tokens with legacy aliases"
```

---

## Task 3: Category color tokens + resolver (`tokens.scss`, `utils.ts`)

**Files:**
- Modify: `src/styles/tokens.scss`
- Modify: `src/lib/utils.ts`
- Test: `src/lib/utils.spec.ts` (create)

Add 13 `--cat-<slug>` vars (flip lighter in dark) plus a non-flipping `--cat-<slug>-solid`, then a resolver keyed by `slugify(display_name)`.

- [ ] **Step 1: Write the failing resolver test**

Create `src/lib/utils.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify, categoryColorVar, categoryFallbackImage } from './utils';

describe('slugify', () => {
  it('strips Polish diacritics and lowercases', () => {
    expect(slugify('Wellness i Duchowość')).toBe('wellness-i-duchowosc');
    expect(slugify('Sport i Fitness')).toBe('sport-i-fitness');
    expect(slugify('Zwierzęta')).toBe('zwierzeta');
  });
});

describe('categoryColorVar', () => {
  it('maps a display name to its --cat var with a fallback', () => {
    expect(categoryColorVar('Muzyka', '#000')).toBe('var(--cat-muzyka, #000)');
  });
  it('uses a neutral fallback when none supplied', () => {
    expect(categoryColorVar('Taniec')).toBe('var(--cat-taniec, #8a8494)');
  });
});

describe('categoryFallbackImage', () => {
  it('returns a deterministic 1..10 variant path for a category + seed', () => {
    const a = categoryFallbackImage('Taniec', 'evt-001');
    const b = categoryFallbackImage('Taniec', 'evt-001');
    expect(a).toBe(b); // deterministic
    expect(a).toMatch(/^\/fallbacks\/taniec-([1-9]|10)\.png$/);
  });
  it('varies the variant by seed', () => {
    const paths = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => categoryFallbackImage('Muzyka', s))
    );
    expect(paths.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/utils.spec.ts`
Expected: FAIL — `slugify`, `categoryColorVar`, `categoryFallbackImage` are not exported.

- [ ] **Step 3: Implement resolvers in `utils.ts`**

In `src/lib/utils.ts`, change `function slugify` to `export function slugify`, then append:

```ts
// Resolves a category display name to its --cat-<slug> CSS variable (brief §2),
// with a fallback color for categories outside the curated 13.
export function categoryColorVar(displayName: string, fallback = '#8a8494'): string {
  return `var(--cat-${slugify(displayName || 'inne')}, ${fallback})`;
}

// The solid, non-flipping variant (selected chips, color-box last resort).
export function categoryColorSolidVar(displayName: string, fallback = '#8a8494'): string {
  return `var(--cat-${slugify(displayName || 'inne')}-solid, ${fallback})`;
}

// Deterministic pick of one of the 10 category-art placeholders (1..10) from a
// stable seed (event id/key) so the same event always shows the same art.
export function categoryFallbackImage(displayName: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const variant = (hash % 10) + 1;
  return `/fallbacks/${slugify(displayName || 'inne')}-${variant}.png`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/utils.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add the 13 category vars to `tokens.scss`**

Append to the `:root` block (before its closing `}`):

```scss
  // --- Category hues (brief §2). Base = chip text / icon on light. ---
  --cat-muzyka: #7c5ce0;
  --cat-film: #4f74e3;
  --cat-teatr-i-widowiska: #b44fd6;
  --cat-sztuka-i-wystawy: #e8557d;
  --cat-taniec: #ee4f86;
  --cat-sport-i-fitness: #2fa860;
  --cat-wellness-i-duchowosc: #1fa8a0;
  --cat-warsztaty: #c98a1d;
  --cat-edukacja: #2e8fd8;
  --cat-imprezy-i-rozrywka: #f07a1f;
  --cat-dla-dzieci: #35b7df;
  --cat-zwierzeta: #b07b3f;
  --cat-inne: #8a8494;

  // Solid, non-flipping variants (selected chip fill, color-box last resort).
  --cat-muzyka-solid: #7c5ce0;
  --cat-film-solid: #4f74e3;
  --cat-teatr-i-widowiska-solid: #b44fd6;
  --cat-sztuka-i-wystawy-solid: #e8557d;
  --cat-taniec-solid: #ee4f86;
  --cat-sport-i-fitness-solid: #2fa860;
  --cat-wellness-i-duchowosc-solid: #1fa8a0;
  --cat-warsztaty-solid: #c98a1d;
  --cat-edukacja-solid: #2e8fd8;
  --cat-imprezy-i-rozrywka-solid: #f07a1f;
  --cat-dla-dzieci-solid: #35b7df;
  --cat-zwierzeta-solid: #b07b3f;
  --cat-inne-solid: #8a8494;
```

- [ ] **Step 6: Add the dark-mode flips to the `[data-theme='dark']` block**

Append (before its closing `}`):

```scss
  // Category text/icon variants for dark (brief §2 "Dark-mode text").
  --cat-muzyka: #a78bfa;
  --cat-film: #8ca5f2;
  --cat-teatr-i-widowiska: #d48beb;
  --cat-sztuka-i-wystawy: #f48ba8;
  --cat-taniec: #f78bb4;
  --cat-sport-i-fitness: #5fcb8b;
  --cat-wellness-i-duchowosc: #54ccc5;
  --cat-warsztaty: #e3ac4e;
  --cat-edukacja: #6bb4ea;
  --cat-imprezy-i-rozrywka: #f79c55;
  --cat-dla-dzieci: #6fd0ee;
  --cat-zwierzeta: #ce9e68;
  --cat-inne: #a79fb2;
  // (-solid variants intentionally NOT flipped: solid fills keep the saturated base.)
```

- [ ] **Step 7: Run tests + build**

Run: `pnpm test src/lib/utils.spec.ts && pnpm build`
Expected: PASS + build success.

- [ ] **Step 8: Commit**

```bash
git add src/styles/tokens.scss src/lib/utils.ts src/lib/utils.spec.ts
git commit -m "feat(tokens): add --cat-* category hues + color/fallback resolvers"
```

---

## Task 4: Fonts (`layout.tsx`)

**Files:**
- Modify: `src/app/layout.tsx`

`--font-display`/`--font-body` families were already set in Task 2; this swaps the Google Fonts `<link>`.

- [ ] **Step 1: Replace the font stylesheet link**

In `src/app/layout.tsx`, replace the `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display...">` element with:

```tsx
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap&subset=latin-ext"
          rel="stylesheet"
        />
```

- [ ] **Step 2: Verify diacritics + fonts render**

Run: `pnpm dev`, open `http://localhost:3000/your-events/`, confirm headings render in Bricolage Grotesque and Polish characters (ż, ś, ó, ę) display correctly. Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(type): load Bricolage Grotesque + Figtree (latin-ext)"
```

---

## Task 5: MUI theme — cssVariables + colorSchemes (`theme.ts`)

**Files:**
- Modify: `src/styles/theme.ts`

Convert to CSS-variables mode with light/dark palettes and apply §6 component specs.

- [ ] **Step 1: Rewrite `theme.ts`**

Replace the entire contents of `src/styles/theme.ts` with:

```ts
'use client';

import { createTheme } from '@mui/material/styles';

// Palette values mirror tokens.scss (brief §1). MUI runs in cssVariables mode so
// these emit CSS custom properties that flip on [data-theme="dark"] — the same
// attribute tokens.scss keys on. Keep both files in sync.
const LIGHT = {
  primary: '#f4553b',
  primaryHover: '#d9432f',
  primaryTint: '#fde9e4',
  bg: '#fbf8f3',
  surface: '#ffffff',
  surface2: '#f4efe7',
  ink: '#221c26',
  inkMuted: '#6e6575',
  border: '#e9e2d9',
};
const DARK = {
  primary: '#f86a50',
  primaryHover: '#f4553b',
  primaryTint: '#3a2521',
  bg: '#17131c',
  surface: '#221c29',
  surface2: '#2b2434',
  ink: '#f5f1ea',
  inkMuted: '#9c93a6',
  border: '#332b3d',
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  defaultColorScheme: 'light',
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: LIGHT.primary, dark: LIGHT.primaryHover, contrastText: '#ffffff' },
        secondary: { main: '#1fa8a0' },
        error: { main: '#e0533f' },
        warning: { main: '#c98a1d' },
        success: { main: '#2fa860' },
        background: { default: LIGHT.bg, paper: LIGHT.surface },
        text: { primary: LIGHT.ink, secondary: LIGHT.inkMuted, disabled: '#9c93a6' },
        divider: LIGHT.border,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: DARK.primary, dark: DARK.primaryHover, contrastText: '#17131c' },
        secondary: { main: '#54ccc5' },
        error: { main: '#f48ba8' },
        warning: { main: '#e3ac4e' },
        success: { main: '#5fcb8b' },
        background: { default: DARK.bg, paper: DARK.surface },
        text: { primary: DARK.ink, secondary: DARK.inkMuted, disabled: '#857c90' },
        divider: DARK.border,
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-body), sans-serif',
    h1: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 },
    h2: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 },
    h3: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 },
    h5: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    h6: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { background: 'transparent' } } },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '0.8125rem',
          fontWeight: 600,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          minHeight: 44,
          padding: '12px 22px',
          boxShadow: 'none',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: 'var(--primary-hover)',
            boxShadow: 'none',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          borderColor: 'var(--border)',
          color: 'var(--ink)',
          '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'transparent' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'var(--surface-2)',
            '& fieldset': { borderColor: 'transparent' },
            '&.Mui-focused fieldset': { borderColor: 'var(--primary)', borderWidth: 2 },
          },
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: 'var(--ink-muted)',
            '&.Mui-selected': {
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 600,
              '&:hover': { backgroundColor: 'var(--primary-hover)' },
            },
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          '&:before': { display: 'none' },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: { padding: 0, minHeight: 'auto', '&.Mui-expanded': { minHeight: 'auto' } },
        content: { margin: '8px 0', '&.Mui-expanded': { margin: '8px 0' } },
      },
    },
    MuiAccordionDetails: { styleOverrides: { root: { padding: '0 0 8px 0' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
```

- [ ] **Step 2: Verify build (the primary technical risk)**

Run: `pnpm build`
Expected: success. Two fallbacks if it errors:
- **Selector not generated as expected** (dark styles never apply): change `cssVariables: { colorSchemeSelector: 'data-theme' }` to the explicit placeholder form `cssVariables: { colorSchemeSelector: '[data-theme="%s"]' }`, and keep `InitColorSchemeScript attribute="data-theme"` in sync.
- **Emotion/cssVariables hydration or style-ordering error:** add `AppRouterCacheProvider` from `@mui/material-nextjs/v15-appRouter` wrapping the tree in `providers.tsx` (`pnpm add @mui/material-nextjs`). Note the outcome in the commit if the provider was needed.

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.ts
git commit -m "feat(theme): MUI cssVariables + light/dark colorSchemes, §6 overrides"
```

---

## Task 6: Dark-mode plumbing — InitColorSchemeScript + Providers

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Add `suppressHydrationWarning` + the init script**

In `src/app/layout.tsx`:
1. Change `<html lang={DEFAULT_LOCALE}>` to `<html lang={DEFAULT_LOCALE} suppressHydrationWarning>` (the script mutates `<html>` before hydration).
2. Add the import at the top:

```tsx
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
```

3. Make `<InitColorSchemeScript>` the first child of `<body>`:

```tsx
      <body>
        <InitColorSchemeScript attribute="data-theme" defaultMode="system" />
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
```

- [ ] **Step 2: Set `defaultMode` on ThemeProvider**

In `src/app/providers.tsx`, change `<ThemeProvider theme={theme}>` to:

```tsx
          <ThemeProvider theme={theme} defaultMode="system">
```

- [ ] **Step 3: Verify no-FOUC + attribute wiring**

Run: `pnpm dev`, open the site. In DevTools, confirm `<html>` gets `data-theme="light"` (or `dark` if your OS is dark). Toggle OS appearance and confirm it follows. No console hydration warning. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/providers.tsx
git commit -m "feat(theme): no-FOUC dark mode via InitColorSchemeScript (data-theme)"
```

---

## Task 7: Spark symbol component

**Files:**
- Create: `src/components/common/Spark/Spark.tsx`

Shared 4-point spark (brief §4) reused by header, footer, favicon.

- [ ] **Step 1: Create the component**

```tsx
interface SparkProps {
  size?: number;
  className?: string;
}

// 4-point starburst — "city energy" (brief §4). Inherits color via currentColor.
export default function Spark({ size = 24, className }: SparkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 2c.9 5.4 4.6 9.1 10 10-5.4.9-9.1 4.6-10 10-.9-5.4-4.6-9.1-10-10 5.4-.9 9.1-4.6 10-10z" />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/Spark/Spark.tsx
git commit -m "feat(brand): add Spark symbol component"
```

---

## Task 8: Category icons — inline `CategoryIcon`

**Files:**
- Create: `src/components/ui/CategoryIcon/paths.tsx`
- Create: `src/components/ui/CategoryIcon/CategoryIcon.tsx`
- Test: `src/components/ui/CategoryIcon/CategoryIcon.spec.tsx`

Inline SVG glyphs (brief §5) tinted via `currentColor`.

- [ ] **Step 1: Create `paths.tsx` (single source of the 13 glyphs)**

```tsx
import type { ReactNode } from 'react';

// Inner markup for each category glyph (brief §5). Rendered inside a
// <svg viewBox="0 0 24 24" stroke="currentColor" ...> so color is inherited.
// Keys are slugify(display_name).
export const CATEGORY_ICON_PATHS: Record<string, ReactNode> = {
  muzyka: (
    <>
      <path d="M9 18V6l8-2.5V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="14.5" cy="16" r="2.5" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="8.5" width="18" height="11" rx="2" />
      <path d="M3.5 8.5 5.5 4.5h15l-2 4M10.5 4.5l-2 4M15.5 4.5l-2 4" />
    </>
  ),
  'teatr-i-widowiska': (
    <>
      <path d="M6 5.5c2 .9 4 1.3 6 1.3s4-.4 6-1.3V12a6 6 0 0 1-12 0z" />
      <path d="M9.5 13.5a2.8 2.8 0 0 0 5 0" />
      <path d="M9.3 10.2h.01M14.7 10.2h.01" strokeWidth="2.4" />
    </>
  ),
  'sztuka-i-wystawy': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 15.5l4.5-4.5 4 4 2.5-2.5 5 5" />
      <circle cx="9.5" cy="9" r="1.4" />
    </>
  ),
  taniec: (
    <>
      <circle cx="14.2" cy="4.3" r="1.8" />
      <path d="M13.3 7.7c-.7 1.7-1.6 3.2-3 4.6" />
      <path d="M13.6 8.6l4 .9 2.7-2M12.9 8.2 9.6 6.7 8.3 4.2" />
      <path d="M10.3 12.3c-1.7 1.4-2.9 3.7-3.3 6.7M10.3 12.3c2.4.7 3.8 2.7 4.1 6.2" />
    </>
  ),
  'sport-i-fitness': (
    <>
      <circle cx="14.8" cy="4.4" r="1.8" />
      <path d="M13.8 7.9 11.5 12.6" />
      <path d="M14 8.8l3.4 1.5 2.6-1.2M13.4 8.6 10 8 8.2 5.8" />
      <path d="M11.5 12.6l3 2.6-.9 4.6M11.5 12.6 7.6 15.4l-3 -.4" />
    </>
  ),
  'wellness-i-duchowosc': (
    <>
      <path d="M12 4.5c1.7 1.7 1.7 4.6 0 6.3-1.7-1.7-1.7-4.6 0-6.3z" />
      <path d="M7.2 6.8c.3 2.5 1.4 4.4 3.4 5.6-2 .9-4 .7-5.6-.5.4-2 1.1-3.7 2.2-5.1zM16.8 6.8c-.3 2.5-1.4 4.4-3.4 5.6 2 .9 4 .7 5.6-.5-.4-2-1.1-3.7-2.2-5.1z" />
      <path d="M4 13.5c1 3.7 4.1 5.9 8 5.9s7-2.2 8-5.9c-2.8.2-5.5 1.2-8 2.9-2.5-1.7-5.2-2.7-8-2.9z" />
    </>
  ),
  warsztaty: (
    <>
      <rect x="3.5" y="9.5" width="17" height="10" rx="2" />
      <path d="M9.5 9.5V8a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 8v1.5" />
      <path d="M3.5 13.5H10M14 13.5h6.5" />
      <path d="M10 12h4v3.5h-4z" />
    </>
  ),
  edukacja: (
    <path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2v14" />
  ),
  'imprezy-i-rozrywka': (
    <>
      <path d="M9 9.5 4 20l10.5-5z" />
      <path d="M13.5 6.5 15 3M17.5 10.5 21 9M15.5 8.5l3.5-3.5" />
      <path d="M20 13.5h.01M11 4.5h.01" strokeWidth="2.4" />
    </>
  ),
  'dla-dzieci': (
    <>
      <path d="M12 3 18 9.3 12 17 6 9.3z" />
      <path d="M6 9.3h12M12 3v14" />
      <path d="M12 17c-1.3 1.4.7 2.3-.6 3.8" />
    </>
  ),
  zwierzeta: (
    <>
      <circle cx="5.8" cy="10.5" r="1.7" />
      <circle cx="9.8" cy="6.8" r="1.7" />
      <circle cx="14.2" cy="6.8" r="1.7" />
      <circle cx="18.2" cy="10.5" r="1.7" />
      <path d="M12 12c-2.8 0-5 2.3-5 4.8 0 1.4 1 2.4 2.4 2.4.9 0 1.7-.5 2.6-.5s1.7.5 2.6.5c1.4 0 2.4-1 2.4-2.4 0-2.5-2.2-4.8-5-4.8z" />
    </>
  ),
  inne: (
    <>
      <circle cx="7.5" cy="7.5" r="3.2" />
      <rect x="13.3" y="4.3" width="6.4" height="6.4" rx="1.5" />
      <path d="M12 13.6 15.7 19.8h-7.4z" />
    </>
  ),
};
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/ui/CategoryIcon/CategoryIcon.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CategoryIcon from './CategoryIcon';

describe('CategoryIcon', () => {
  it('renders an svg for a known category', () => {
    const { container } = render(<CategoryIcon category="Muzyka" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to the Inne glyph for an unknown category', () => {
    const { container } = render(<CategoryIcon category="Nonexistent" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is aria-hidden (decorative)', () => {
    const { container } = render(<CategoryIcon category="Taniec" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/components/ui/CategoryIcon`
Expected: FAIL — `CategoryIcon` not found.

- [ ] **Step 4: Create `CategoryIcon.tsx`**

```tsx
import { CATEGORY_ICON_PATHS } from './paths';
import { slugify } from '@/lib/utils';

interface CategoryIconProps {
  category: string;
  size?: number;
  className?: string;
}

// Inline category glyph (brief §5). stroke=currentColor so callers tint it with
// `color: var(--cat-<slug>)`. Unknown categories fall back to the Inne glyph.
export default function CategoryIcon({ category, size = 16, className }: CategoryIconProps) {
  const slug = slugify(category || 'inne');
  const glyph = CATEGORY_ICON_PATHS[slug] ?? CATEGORY_ICON_PATHS.inne;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {glyph}
    </svg>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/components/ui/CategoryIcon`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/CategoryIcon
git commit -m "feat(icons): inline CategoryIcon glyph set (brief §5)"
```

---

## Task 9: CategoryChip — per-category tint + icon

**Files:**
- Modify: `src/components/ui/CategoryChip/CategoryChip.tsx`
- Modify: `src/components/ui/CategoryChip/CategoryChip.spec.tsx`

- [ ] **Step 1: Add a failing test for the icon + tinted state**

Append to `src/components/ui/CategoryChip/CategoryChip.spec.tsx` (inside the `describe`):

```tsx
  it('renders a category icon glyph', () => {
    const { container } = render(<CategoryChip category="Muzyka" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders selected and unselected without crashing', () => {
    // Note: color/background come from MUI sx → Emotion classes, which jsdom
    // does not resolve to computed styles, so we assert on structure/behavior,
    // not on the CSS var value (verified visually in Task 16 instead).
    const { rerender } = render(<CategoryChip category="Taniec" />);
    expect(screen.getByText('Taniec')).toBeInTheDocument();
    rerender(<CategoryChip category="Taniec" selected />);
    expect(screen.getByText('Taniec')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/ui/CategoryChip`
Expected: FAIL on "renders a category icon glyph" — the current chip has no `<svg>`.

- [ ] **Step 3: Rewrite `CategoryChip.tsx`**

Replace the entire file:

```tsx
'use client';

import Chip from '@mui/material/Chip';
import CategoryIcon from '@/components/ui/CategoryIcon/CategoryIcon';
import { categoryColorVar, categoryColorSolidVar } from '@/lib/utils';

interface CategoryChipProps {
  category: string;
  onClick?: () => void;
  selected?: boolean;
}

// Tinted category pill (brief §2/§6). Unselected: color-mix tint bg + category
// color text/icon. Selected: solid category fill + white.
export default function CategoryChip({ category, onClick, selected }: CategoryChipProps) {
  const color = categoryColorVar(category);
  const solid = categoryColorSolidVar(category);

  return (
    <Chip
      label={category}
      size="small"
      icon={<CategoryIcon category={category} size={16} />}
      onClick={onClick}
      sx={{
        height: 24,
        borderRadius: 999,
        fontFamily: 'var(--font-body)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        color: selected ? '#fff' : color,
        backgroundColor: selected
          ? solid
          : `color-mix(in oklab, ${color} 14%, var(--surface))`,
        '& .MuiChip-icon': { color: 'inherit', marginLeft: '6px', marginRight: '-4px' },
        '&:hover': onClick
          ? {
              backgroundColor: selected
                ? solid
                : `color-mix(in oklab, ${color} 22%, var(--surface))`,
            }
          : {},
      }}
    />
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/ui/CategoryChip`
Expected: PASS (all 6 tests including a11y).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CategoryChip
git commit -m "feat(chip): per-category tinted CategoryChip with inline icon"
```

---

## Task 10: EventCard — date badge + PNG art fallback

**Files:**
- Copy: `public/fallbacks/*.png` (130 files)
- Modify: `src/components/common/EventCard/EventCard.tsx`
- Modify: `src/components/common/EventCard/EventCard.module.scss`
- Modify: `src/components/common/EventCard/EventCard.spec.tsx`

- [ ] **Step 1: Copy the category-art placeholders into public/**

```bash
mkdir -p "public/fallbacks"
cp "$HOME/Downloads/Your Events Website Design (1)/fallbacks/"*.png "public/fallbacks/"
ls public/fallbacks | wc -l   # expect 130
```

- [ ] **Step 2: Add a failing test for the day/month date badge**

In `src/components/common/EventCard/EventCard.spec.tsx`, append inside the `describe`:

```tsx
  it('shows the day number and month in the date badge', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('14')).toBeInTheDocument();   // 2026-03-14
    // pl-PL short month, uppercased. Regex (not exact) because some ICU builds
    // append a period ("mar." → "MAR."); substring match is stable across both.
    expect(screen.getByText(/MAR/)).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/components/common/EventCard`
Expected: FAIL — badge currently renders `formatDateShort` ("14 mar"), not split day/month.

- [ ] **Step 4: Update `EventCard.tsx`**

1. Change the import line 14 to (keeps `formatDateShort` — still used by the card's `aria-label` on line 43 — and drops the now-unused `getCategoryIconPath`):

```tsx
import {
  formatDateShort,
  formatDay,
  formatMonth,
  formatEventTime,
  categoryFallbackImage,
  categoryColorSolidVar,
} from '@/lib/utils';
```

2. Replace the `dateOverlay` block (lines 48-51) with the stacked badge:

```tsx
          <div className={styles.dateBadge} aria-hidden>
            <span className={styles.dateDay}>{formatDay(event.date)}</span>
            <span className={styles.dateMonth}>{formatMonth(event.date)}</span>
          </div>
```

3. Replace the entire `ImageWrapper` function (lines 97-137) with the PNG-art fallback chain:

```tsx
function ImageWrapper({ event }: { event: Event }) {
  const artSrc = categoryFallbackImage(event.categoryMain, event.id || event.eventKey);
  // stage 0 = real imageUrl, 1 = category art PNG, 2 = solid color box
  const [stage, setStage] = useState<0 | 1 | 2>(event.imageUrl ? 0 : 1);

  if (stage < 2) {
    return (
      <Image
        src={stage === 0 ? event.imageUrl : artSrc}
        alt={event.categoryMain}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={styles.image}
        onError={() => setStage((s) => (s === 0 ? 1 : 2))}
        unoptimized
      />
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: categoryColorSolidVar(event.categoryMain),
      }}
    />
  );
}
```

4. Remove the now-unused `useCategories`/`getCategoryIconPath` imports from `ImageWrapper` only if no longer referenced elsewhere in the file. `useCategories` is still used at the top of `EventCard` (for `displayNameToSlug`), so keep that import; remove `getCategoryIconPath` from the line-14 import.

- [ ] **Step 5: Update `EventCard.module.scss` — swap `.dateOverlay` for `.dateBadge`**

Replace the `.dateOverlay`, `.dateText`, `.timeText` rules (lines 74-101) with:

```scss
.dateBadge {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 7px;
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  box-shadow: var(--shadow-card);
  line-height: 1;
  pointer-events: none;
}

.dateDay {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--ink);
}

.dateMonth {
  font-family: var(--font-body);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test src/components/common/EventCard`
Expected: PASS (day "14" + month "MAR" found; a11y still green).

- [ ] **Step 7: Type-check**

Run: `pnpm type-check`
Expected: no errors (confirms the removed `getCategoryIconPath` import isn't referenced).

- [ ] **Step 8: Commit**

```bash
git add public/fallbacks src/components/common/EventCard
git commit -m "feat(card): stacked date badge + category-art image fallback"
```

---

## Task 11: ThemeToggle + AppHeader (spark logo, glass, toggle)

**Files:**
- Create: `src/components/common/ThemeToggle/ThemeToggle.tsx`
- Modify: `src/components/common/AppHeader/AppHeader.tsx`

- [ ] **Step 1: Create `ThemeToggle.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import { useColorScheme } from '@mui/material/styles';

// Cycles light ⇄ dark, persisted by MUI (writes data-theme). Renders nothing
// until mounted to avoid an SSR/CSR mismatch on the icon.
export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <IconButton aria-hidden sx={{ width: 40, height: 40 }} />;

  const resolved = mode === 'system' ? systemMode : mode;
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <IconButton
      onClick={() => setMode(next)}
      aria-label={next === 'dark' ? 'Włącz tryb ciemny' : 'Włącz tryb jasny'}
      sx={{ color: 'var(--ink)' }}
    >
      {resolved === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
}
```

- [ ] **Step 2: Wire the spark logo, glass, and toggle into `AppHeader.tsx`**

1. Add imports:

```tsx
import Spark from '@/components/common/Spark/Spark';
import ThemeToggle from '@/components/common/ThemeToggle/ThemeToggle';
```

2. Update the AppBar `sx` background/border to brief §6 (`--bg` @ 80%):

```tsx
        backgroundColor: 'var(--color-surface-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'none',
```

3. Replace the logo `<Link>` block (lines 70-83) so a coral spark sits left of the wordmark. The `<span>` sets `color: var(--primary)`, which `Spark`'s `currentColor` inherits:

```tsx
        <Link
          href="/"
          className={styles.logo}
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
            <Spark size={26} />
          </span>
          <Typography
            variant="h6"
            component="span"
            sx={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {t.APP_NAME}
          </Typography>
        </Link>
```

4. Add `<ThemeToggle />` to both the desktop and mobile action clusters — after `<LanguageSwitcher />` in the `isMdUp` nav (line ~97) and after `<LanguageSwitcher />` in the mobile `<Box>` (line ~102):

```tsx
            <LanguageSwitcher />
            <ThemeToggle />
```

- [ ] **Step 3: Verify header renders + toggle works**

Run: `pnpm dev`. Confirm: coral spark + wordmark on the left; a sun/moon button toggles the whole app between light and dark; the choice persists across reload. Stop dev.

- [ ] **Step 4: Run header/nav tests**

Run: `pnpm test src/components/common/AppHeader`
Expected: PASS (if the suite asserts on markup that moved, update selectors minimally).

- [ ] **Step 5: Commit**

```bash
git add src/components/common/ThemeToggle src/components/common/AppHeader
git commit -m "feat(header): spark logo, glass bar, light/dark toggle"
```

---

## Task 12: AppFooter — surface-2 + spark

**Files:**
- Modify: `src/components/common/AppFooter/AppFooter.tsx`
- Modify: `src/components/common/AppFooter/AppFooter.module.scss`

- [ ] **Step 1: Add the spark to the footer wordmark**

In `src/components/common/AppFooter/AppFooter.tsx`:
1. Add import: `import Spark from '@/components/common/Spark/Spark';`
2. Wrap the `APP_NAME` Typography so a coral spark precedes it:

```tsx
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
              <Spark size={22} />
            </span>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--ink)' }}
            >
              {t.APP_NAME}
            </Typography>
          </Box>
```

(Remove the old standalone `APP_NAME` Typography with `mb: 0.5`.)

- [ ] **Step 2: Set the footer background to `--surface-2`**

In `src/components/common/AppFooter/AppFooter.module.scss`, ensure the `.footer` rule uses:

```scss
.footer {
  background-color: var(--surface-2);
  border-top: 1px solid var(--border);
}
```

(Add these two declarations to the existing `.footer` rule; keep its other properties. Read the file first to place them correctly.)

- [ ] **Step 3: Run footer tests + verify**

Run: `pnpm test src/components/common/AppFooter`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/AppFooter
git commit -m "feat(footer): surface-2 background + spark symbol"
```

---

## Task 13: SearchInput — pill + surface-2

**Files:**
- Modify: `src/components/ui/SearchInput/SearchInput.tsx`

The `--surface-2` bg + 2px focus ring come from the Task 5 `MuiTextField` override; this sets the pill radius (search-specific, brief §6).

- [ ] **Step 1: Set pill radius on the search field**

In `src/components/ui/SearchInput/SearchInput.tsx`, change the `sx` `borderRadius` from `var(--radius-md)` to `var(--radius-pill)`:

```tsx
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          minHeight: 44,
        },
      }}
```

(The focus-border rule is now handled globally by the theme; leaving the local `&.Mui-focused fieldset` is harmless but can be removed.)

- [ ] **Step 2: Run search tests**

Run: `pnpm test src/components/ui/SearchInput`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SearchInput
git commit -m "feat(search): pill-shaped search field (brief §6)"
```

---

## Task 14: Body canvas (`globals.scss`)

**Files:**
- Modify: `src/app/globals.scss`

Replace the loud 4-color wash with the brief's disciplined warm canvas; dark uses the flat dark bg.

- [ ] **Step 1: Replace the `body` background block**

In `src/app/globals.scss`, replace the `body { ... background: ...; }` rule with:

```scss
body {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 40% at 50% -5%, var(--primary-tint) 0%, transparent 60%),
    var(--bg);
  background-attachment: fixed;
  color: var(--ink);
  font-family: var(--font-body), sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[data-theme='dark'] body {
  background:
    radial-gradient(ellipse 70% 40% at 50% -5%, var(--primary-tint) 0%, transparent 60%),
    var(--bg);
}
```

- [ ] **Step 2: Update focus/selection to brief tokens**

Change the `:focus-visible` outline and `::selection` to use `--primary`:

```scss
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

::selection {
  background-color: rgba(244, 85, 59, 0.18); // coral @ 18% (rgba, not color-mix, for Sass)
  color: var(--ink);
}
```

- [ ] **Step 3: Verify light + dark canvas**

Run: `pnpm dev`. Confirm the background is a calm warm cream (light) / deep aubergine (dark) with a subtle coral glow at top, no rainbow wash. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.scss
git commit -m "feat(canvas): disciplined warm body background + dark variant"
```

---

## Task 15: Manifest + favicon

**Files:**
- Modify: `src/app/manifest.ts`
- Overwrite: `public/favicons/favicon.svg`

- [ ] **Step 1: Update manifest colors**

In `src/app/manifest.ts`, change:

```ts
    background_color: '#fbf8f3',
    theme_color: '#f4553b',
```

- [ ] **Step 2: Overwrite `favicon.svg` with the spark on a coral tile**

Write `public/favicons/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="22" fill="#f4553b"/>
  <path fill="#ffffff" transform="translate(26 26) scale(2.083)" d="M12 2c.9 5.4 4.6 9.1 10 10-5.4.9-9.1 4.6-10 10-.9-5.4-4.6-9.1-10-10 5.4-.9 9.1-4.6 10-10z"/>
</svg>
```

Note: the raster favicons (`favicon.ico`, `apple-touch-icon.png`, `web-app-manifest-*.png`) are left unchanged in this plan — regenerating them needs an image pipeline. Flag as a manual follow-up if brand-consistent PNGs are required.

- [ ] **Step 3: Verify favicon**

Run: `pnpm dev`, confirm the browser tab shows the coral spark tile (SVG favicon). Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app/manifest.ts public/favicons/favicon.svg
git commit -m "feat(brand): coral theme_color + spark favicon.svg"
```

---

## Task 16: Full verification

**Files:** none (checkpoint).

- [ ] **Step 1: Unit suite**

Run: `pnpm test`
Expected: PASS, count ≥ the Task 1 baseline.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm type-check && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Static build**

Run: `pnpm build`
Expected: export succeeds.

- [ ] **Step 4: e2e smoke (accessibility + core journeys)**

Run: `pnpm test:e2e e2e/a11y.spec.ts e2e/home.spec.ts e2e/events-list.spec.ts`
Expected: PASS. `a11y.spec.ts` confirms contrast/focus survive the palette change. If a selector broke because header/footer markup moved, fix the test to match the new markup (not the component).

- [ ] **Step 5: Manual light/dark pass**

Run: `pnpm dev`. Walk home → list → detail in both themes via the toggle. Confirm: coral CTAs, tinted category chips with icons, day/month date badges, category-art fallbacks on imageless events, calm canvas, correct Polish diacritics. Stop dev.

- [ ] **Step 6: Final commit (if any test fixes were needed)**

```bash
git add -A
git commit -m "test: update specs/e2e for Idź na miasto restyle"
```

---

## Self-review notes

- **Spec coverage:** §1 tokens → T2; §2 category colors → T3; §3 type → T4; §4 logo/favicon → T7/T11/T12/T15; §5 icons → T8; §6 components (card T10, chip T9, button/input T5+T13, header T11, footer T12, date badge T10, placeholders T10) → covered; dark-mode plumbing → T6; body canvas → T14. Reels explicitly excluded (no task references `uploads/`, `reels-prompt.md`, or §07).
- **Deviations from spec** are listed in "Refinements" up top: MUI built-in dark-mode mechanism (no custom `inm-theme` key), `[data-theme="dark"]`-only dark block, and public category-icon SVGs left untouched. All preserve the spec's intent.
- **Type consistency:** `slugify`, `categoryColorVar`, `categoryColorSolidVar`, `categoryFallbackImage` defined in T3, consumed in T8/T9/T10. `Spark` (T7) consumed in T11/T12. `CategoryIcon` (T8) consumed in T9.
