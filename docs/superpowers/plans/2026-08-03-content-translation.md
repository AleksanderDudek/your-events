# Content Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user switches to EN, translate the Supabase-sourced Polish content (event names, descriptions, category labels, price labels) in the browser, leaving venue names, keys and URLs alone.

**Architecture:** A framework-free engine wraps the on-device Translator API with a cache and a microtask batching queue. A `useTranslated` hook reads it through `useSyncExternalStore`, so text renders in Polish immediately and is replaced when a translation lands. Where the Translator API is missing, an opt-in Google Translate widget is offered instead.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Vitest, the Chrome Translator API.

**Spec:** `docs/superpowers/specs/2026-08-03-content-translation-design.md`

---

## File Structure

**Created:**

- `src/i18n/translation/engine.ts` — capability detection, translator lifecycle, cache, batching queue, status. No React.
- `src/i18n/translation/engine.spec.ts`
- `src/i18n/translation/useTranslated.tsx` — `useTranslated()`, `<Translated />`, `useTranslationStatus()`.
- `src/i18n/translation/useTranslated.spec.tsx`
- `src/i18n/translation/index.ts` — the public surface.
- `src/components/common/TranslationNotice/TranslationNotice.tsx` — download progress and the Google fallback offer.
- `src/components/common/TranslationNotice/TranslationNotice.spec.tsx`

**Modified:**

- `src/components/common/AppHeader/LanguageSwitcher.tsx` — prime the translator inside the click, which is the user activation a model download needs.
- `src/components/common/EventCard/EventCard.tsx`
- `src/components/common/EventRow/EventRow.tsx`
- `src/components/views/EventDetailView/EventDetailView.tsx`
- `src/components/common/FilterPanel/FilterPanel.tsx`
- `src/components/ui/PriceLabel/PriceLabel.tsx`
- `src/components/common/AppLayout/AppLayout.tsx` — mount the notice.

The engine is deliberately separable: nothing outside `src/i18n/translation/` knows the Translator API exists, and deleting the directory plus the render-site wrappers leaves a working Polish app.

---

## Task 1: The engine

**Files:**
- Create: `src/i18n/translation/engine.ts`
- Test: `src/i18n/translation/engine.spec.ts`

### Public surface

```ts
export type TranslationStatus = 'unsupported' | 'idle' | 'downloading' | 'ready' | 'error';
export const SOURCE_LANGUAGE = 'pl';

export function isTranslationSupported(): boolean;
export function getStatus(): TranslationStatus;
export function subscribe(listener: () => void): () => void;
/** Cached translation, or the original text when there is none yet. Never throws, never async. */
export function read(text: string, target: string): string;
/** Queue a miss. Requests in one microtask flush as a single batch. */
export function request(text: string, target: string): void;
/** Create the translator. Call from a user gesture — a model download needs activation. */
export function primeTranslator(target: string): Promise<void>;
/** Test seam: drops the cache, the queue, the translator and the status. */
export function resetTranslationEngine(): void;
```

### Behaviour

- Cache key is `${SOURCE_LANGUAGE}|${target}|${text}`, backed by a module `Map`
  and mirrored into `sessionStorage` under `go-to-city.mt`. Every
  `sessionStorage` access is wrapped in try/catch — it throws in private mode.
- `read` returns the cached value, else the input. It has no side effects.
- `request` ignores: an empty string, `target === SOURCE_LANGUAGE`, anything
  already cached or already queued. Otherwise it adds to a pending `Set` and
  schedules one `queueMicrotask` flush.
- The flush creates the translator if needed, translates every queued string
  with `Promise.all`, writes each result to the cache, and notifies subscribers
  once. A rejected string is skipped and leaves the original — one failure does
  not abandon the batch.
- Status: `unsupported` when `Translator` is absent from `globalThis`; `idle`
  before anything is created; `downloading` while `Translator.create` runs with
  a download in progress; `ready` once a translator exists; `error` if creation
  fails. Every status change notifies subscribers.
- `primeTranslator` is idempotent and safe to call repeatedly.

### Steps

- [ ] **Step 1: Write the failing test**

Create `src/i18n/translation/engine.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SOURCE_LANGUAGE,
  getStatus,
  isTranslationSupported,
  primeTranslator,
  read,
  request,
  resetTranslationEngine,
  subscribe,
} from './engine';

// A stand-in for the on-device model. Chrome exposes `Translator` on the global;
// under vitest there is none, which is also the "unsupported browser" case the
// engine has to survive.
function installTranslator(options: {
  translate?: (text: string) => Promise<string>;
  availability?: string;
  createRejects?: boolean;
} = {}) {
  const translate = options.translate ?? ((text: string) => Promise.resolve(`EN(${text})`));
  const create = vi.fn(async () => {
    if (options.createRejects) throw new Error('no model');
    return { translate: vi.fn(translate), destroy: vi.fn() };
  });
  const availability = vi.fn(async () => options.availability ?? 'available');
  Object.defineProperty(globalThis, 'Translator', {
    value: { create, availability },
    configurable: true,
    writable: true,
  });
  return { create, availability };
}

function uninstallTranslator() {
  Reflect.deleteProperty(globalThis as object, 'Translator');
}

// The queue flushes on a microtask; awaiting an already-resolved promise twice
// is enough to let it run to completion.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  resetTranslationEngine();
  uninstallTranslator();
});

afterEach(() => {
  uninstallTranslator();
  resetTranslationEngine();
});

describe('without the Translator API', () => {
  it('reports itself unsupported', () => {
    expect(isTranslationSupported()).toBe(false);
    expect(getStatus()).toBe('unsupported');
  });

  it('returns the original text and never throws', async () => {
    request('Koncert', 'en');
    await flush();
    expect(read('Koncert', 'en')).toBe('Koncert');
  });
});

describe('with the Translator API', () => {
  it('translates a requested string and notifies subscribers', async () => {
    installTranslator();
    const listener = vi.fn();
    subscribe(listener);

    expect(read('Koncert', 'en')).toBe('Koncert');
    request('Koncert', 'en');
    await flush();

    expect(read('Koncert', 'en')).toBe('EN(Koncert)');
    expect(listener).toHaveBeenCalled();
  });

  // Fifteen cards must not become fifteen round trips.
  it('flushes everything requested in one tick as a single batch', async () => {
    const { create } = installTranslator();
    request('a', 'en');
    request('b', 'en');
    request('c', 'en');
    await flush();

    expect(create).toHaveBeenCalledTimes(1);
    expect(read('a', 'en')).toBe('EN(a)');
    expect(read('b', 'en')).toBe('EN(b)');
    expect(read('c', 'en')).toBe('EN(c)');
  });

  it('does not re-translate what it already has', async () => {
    installTranslator();
    request('Koncert', 'en');
    await flush();
    const before = read('Koncert', 'en');

    request('Koncert', 'en');
    await flush();

    expect(read('Koncert', 'en')).toBe(before);
  });

  it('leaves the source language alone', async () => {
    installTranslator();
    request('Koncert', SOURCE_LANGUAGE);
    await flush();
    expect(read('Koncert', SOURCE_LANGUAGE)).toBe('Koncert');
  });

  it('keeps the original when one string fails, and the rest of the batch survives', async () => {
    installTranslator({
      translate: (text: string) =>
        text === 'bad' ? Promise.reject(new Error('nope')) : Promise.resolve(`EN(${text})`),
    });
    request('bad', 'en');
    request('good', 'en');
    await flush();

    expect(read('bad', 'en')).toBe('bad');
    expect(read('good', 'en')).toBe('EN(good)');
  });

  it('reports an error status when the model cannot be created', async () => {
    installTranslator({ createRejects: true });
    await primeTranslator('en');
    expect(getStatus()).toBe('error');
  });

  it('reaches ready once a translator exists', async () => {
    installTranslator();
    expect(getStatus()).toBe('idle');
    await primeTranslator('en');
    expect(getStatus()).toBe('ready');
  });

  it('ignores empty strings', async () => {
    const { create } = installTranslator();
    request('', 'en');
    request('   ', 'en');
    await flush();
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/i18n/translation/engine.spec.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `engine.ts`**

Implement the public surface above against that behaviour. Requirements the
tests do not fully pin, which still must hold:

- `Translator` is read off `globalThis` at call time, never captured at module
  load — the test installs it after import.
- `read` performs no I/O and schedules nothing.
- The `sessionStorage` mirror is written after each successful translation and
  read once, lazily, on first use. Both wrapped in try/catch.
- `resetTranslationEngine()` clears the cache, the pending set, the translator,
  the status and the subscriber list, so tests do not leak into each other.
- Add a `declare global` block typing the API surface used
  (`Translator.create`, `Translator.availability`, the instance's `translate`
  and `destroy`) rather than reaching for `any`. `eslint` forbids `any`.

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/i18n/translation/engine.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/`
Expected: everything green; eslint reports only the pre-existing
`no-page-custom-font` warning.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translation/engine.ts src/i18n/translation/engine.spec.ts
git commit -m "feat(i18n): on-device translation engine with a batching cache

Wraps Chrome's Translator API behind a synchronous read: callers get the
original Polish immediately and the translation when it lands. Requests made in
one tick flush as a single batch, so fifteen cards are one pass rather than
fifteen round trips, and every failure path — no API, no model, a rejected
string — degrades to the untranslated text.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The React surface

**Files:**
- Create: `src/i18n/translation/useTranslated.tsx`
- Create: `src/i18n/translation/index.ts`
- Test: `src/i18n/translation/useTranslated.spec.tsx`

### Public surface

```tsx
/** The translation of `text` for the active locale, or `text` itself. */
export function useTranslated(text: string | null | undefined): string;
/** Same, rendered. Use in JSX; use the hook for aria-labels and alt text. */
export function Translated({ text }: { text: string | null | undefined }): React.ReactNode;
export function useTranslationStatus(): TranslationStatus;
```

`useTranslated` reads the engine through `useSyncExternalStore`, whose server
snapshot is always the original text, and requests the miss from an effect —
never from `getSnapshot`, which must stay pure.

### Steps

- [ ] **Step 1: Write the failing test**

Create `src/i18n/translation/useTranslated.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/i18n';
import { resetTranslationEngine } from './engine';
import { Translated, useTranslated } from './useTranslated';

function installTranslator() {
  Object.defineProperty(globalThis, 'Translator', {
    value: {
      create: vi.fn(async () => ({
        translate: vi.fn(async (text: string) => `EN(${text})`),
        destroy: vi.fn(),
      })),
      availability: vi.fn(async () => 'available'),
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  resetTranslationEngine();
  Reflect.deleteProperty(globalThis as object, 'Translator');
  window.localStorage.setItem('go-to-city.locale', 'en');
});

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'Translator');
  resetTranslationEngine();
  window.localStorage.clear();
});

function Subject({ text }: { text: string }) {
  return <p data-testid="out"><Translated text={text} /></p>;
}

describe('Translated', () => {
  it('renders the original text first, then the translation', async () => {
    installTranslator();
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );

    // The first paint is always the source text — that is what keeps the static
    // HTML and hydration in agreement.
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('EN(Koncert)'));
  });

  it('leaves the text alone when the browser cannot translate', async () => {
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
  });

  it('leaves the text alone in the source locale', async () => {
    installTranslator();
    window.localStorage.setItem('go-to-city.locale', 'pl');
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
  });

  it('handles null and undefined without rendering "null"', () => {
    function Empty() {
      const value = useTranslated(null);
      return <span data-testid="empty">[{value}]</span>;
    }
    render(
      <LocaleProvider>
        <Empty />
      </LocaleProvider>
    );
    expect(screen.getByTestId('empty')).toHaveTextContent('[]');
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — module missing.

Run: `npx vitest run src/i18n/translation/useTranslated.spec.tsx`

- [ ] **Step 3: Implement `useTranslated.tsx` and `index.ts`**

`index.ts` re-exports `useTranslated`, `Translated`, `useTranslationStatus`,
`primeTranslator`, `isTranslationSupported` and the `TranslationStatus` type —
and nothing else. That list is the contract the rest of the app codes against.

- [ ] **Step 4: Run it, verify it passes** — 4 tests.

- [ ] **Step 5: Full suite, typecheck, lint** — all green.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translation/
git commit -m "feat(i18n): useTranslated, reading the engine through useSyncExternalStore

The server snapshot is the original text, so static HTML and the first client
paint agree and hydration cannot mismatch. Misses are requested from an effect
rather than from getSnapshot, which has to stay pure.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire it into the render sites

Every change is the same shape: a rendered Supabase string becomes
`<Translated text={…} />`, or `useTranslated(…)` where a plain string is needed
(`alt`, `aria-label`, Leaflet popup HTML). **Lookup keys are never touched** —
`byDisplayName.get(event.categoryMain)` keeps its Polish key, or every card
loses its colour.

**Files:**
- Modify: `src/components/common/EventCard/EventCard.tsx` — `event.name` (heading, `alt`, `aria-label`), the category chips.
- Modify: `src/components/common/EventRow/EventRow.tsx` — the same fields.
- Modify: `src/components/views/EventDetailView/EventDetailView.tsx` — `event.name`, `event.description`, the chips.
- Modify: `src/components/common/FilterPanel/FilterPanel.tsx` — `cat.display_name` and `sub.display_name` labels only; `categoryColorVar(cat.display_name)` and `<CategoryIcon category={cat.display_name} />` keep the Polish value.
- Modify: `src/components/ui/PriceLabel/PriceLabel.tsx` — the descriptive label branch only.
- Modify: `src/components/common/EventsMap/EventsMapInner.tsx` — the popup title.

Venue names get `translate="no"` rather than a translation, so the fallback
widget cannot rewrite them either.

- [ ] **Step 1: Confirm the existing tests still pass untouched**

Run: `npx vitest run`
Expected: green. Under vitest there is no `Translator`, so every component test
keeps asserting Polish — that is the proof this layer is additive.

- [ ] **Step 2: Apply the wrapper at each site listed above**

- [ ] **Step 3: Mark venue names**

In `EventCard`, `EventRow` and `EventDetailView`, the element rendering
`event.location.name` gains `translate="no"`.

- [ ] **Step 4: Full suite, typecheck, lint** — all green, no test edited.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(i18n): translate the rendered Supabase text, not the values behind it

Names, descriptions, category labels and descriptive price labels go through
the translation layer; the values they were read from stay Polish, because
colours, icons and filters are keyed on them. Venue names are marked
translate=no — they are proper nouns, and the page-level fallback would rewrite
them otherwise.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Priming, status and the Google fallback

**Files:**
- Modify: `src/components/common/AppHeader/LanguageSwitcher.tsx`
- Create: `src/components/common/TranslationNotice/TranslationNotice.tsx`
- Create: `src/components/common/TranslationNotice/TranslationNotice.spec.tsx`
- Modify: `src/components/common/AppLayout/AppLayout.tsx`

- [ ] **Step 1: Prime from the click**

In `LanguageSwitcher`'s `handleChange`, after `setLocale(next)`, call
`primeTranslator(next)`. A model download needs user activation, and this click
is it — priming from a mount effect would be refused.

- [ ] **Step 2: The notice**

`TranslationNotice` renders nothing in the source locale. Otherwise it reflects
`useTranslationStatus()`:

- `downloading` — a quiet inline "translating content…" line with a progress
  spinner, using the existing `loadingPill` styling vocabulary.
- `error` — one dismissible line saying content stays in Polish. Not per string.
- `unsupported` — the Google Translate offer: a button, plus one sentence saying
  the page will be sent to Google. Only on click does the widget script get
  injected; nothing third-party loads before that.
- `ready` / `idle` — nothing.

New message keys go in both `pl` and `en` tables in `src/i18n/messages.ts`;
English is checked against Polish's shape by `satisfies Messages`, so a missing
key fails type-check.

- [ ] **Step 3: The widget, on click only**

Inject `https://translate.google.com/translate_a/element.js?cb=…`, initialise
`new google.translate.TranslateElement({ pageLanguage: 'pl', autoDisplay: false })`
into a hidden container, then drive its `select.goog-te-combo` to the target
language and dispatch a `change` event. Do not use the cookie-and-reload
approach: a reload would drop the filter state held in the URL and interact
badly with the consent banner.

Guard the whole thing so a script that fails to load leaves the page untouched.

- [ ] **Step 4: Mount it**

Render `<TranslationNotice />` in `AppLayout`, above the main content.

- [ ] **Step 5: Test**

`TranslationNotice.spec.tsx` covers: renders nothing for `pl`; shows the offer
when unsupported; does not inject any script until the button is clicked; shows
the downloading state. Assert on the absence of a `<script src*="translate.google">`
before the click and its presence after.

- [ ] **Step 6: Full suite, typecheck, lint, and an a11y pass**

The repo uses `jest-axe`; follow the existing pattern in
`FilterPanel.spec.tsx` and assert no violations for the notice.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(i18n): prime on the language click, and offer the page widget where there is no model

Creating a translator may download a model, which needs user activation — the
language toggle is that gesture, so priming happens there rather than in an
effect that would be refused.

Where the Translator API does not exist at all (Firefox, Safari, every mobile
browser) the fallback is Google's page widget, behind an explicit button: it
rewrites the DOM React owns and sends the page to a third party, so it is the
user's choice to make, not ours.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- Tasks are strictly ordered: 2 needs 1, 3 needs 2, 4 needs 2.
- No existing test may be edited. If one breaks, the wiring is wrong — the
  layer is additive and vitest has no `Translator`.
- The Translator API is desktop-Chrome-only. Everything must be correct when it
  is absent, because that is the majority case and the CI case.
