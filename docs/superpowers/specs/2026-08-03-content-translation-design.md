# Translating the content, not just the chrome — design

Date: 2026-08-03
Status: designed while the owner was away; implemented under the assumptions
recorded here, to be reviewed on return.

## Problem

Switching the language to EN today translates the shell and nothing inside it.
`src/i18n/messages.ts` holds hand-written `pl`/`en` tables for every string the
app owns — navigation, filter labels, buttons — and those switch correctly. But
everything that comes from Supabase stays Polish:

- `event.name`, `event.description`
- `event.categoryMain` / `event.categorySub` (the chips)
- the `categories` table's `display_name` (the filter panel's whole tree)
- descriptive price labels (`Karnet od 189 zł`, `wolny/zapisy`)

An English speaker gets English buttons around Polish events, which is arguably
worse than not offering EN at all: the interface promises something it does not
deliver.

There is no translation pipeline to add to. The content is scraped hourly from
Polish sources, so a human-translated column is not on the table, and a
server-side translation service is not either — the site is a static export with
no backend.

## Approach

Machine translation in the browser, in two layers, chosen by what the browser
can do.

### Layer 1 — the Translator API (primary)

Chrome 138+ on desktop ships an on-device translation model (`Translator`).
The app hands it individual strings and gets translations back:

```js
const availability = await Translator.availability({
  sourceLanguage: 'pl', targetLanguage: 'en',
});
const translator = await Translator.create({ sourceLanguage: 'pl', targetLanguage: 'en' });
const english = await translator.translate('Koncert symfoniczny');
```

Why this is the right primary:

- **We choose what gets translated.** Venue names are proper nouns — "Zdrofit
  Szczecin Galaxy" must not become anything else — and a whole-page translator
  cannot know that. String-level control is the whole point.
- **No DOM mutation**, so React's reconciliation is untouched. Page-level
  translators rewrite text nodes underneath React, which is a well-known source
  of `removeChild` crashes.
- **No network request per string**, no third-party script, nothing to consent
  to. The model is local; after the one-time download it works offline.

Constraints that shape the design: desktop Chrome only (no mobile, no Firefox,
no Safari), and creating a translator may need to download a model, which
requires user activation. The language switch is itself a click, which is the
activation we need — as long as translation is kicked off from that gesture and
not from a background effect on load.

### Layer 2 — the Google Translate element (fallback)

Where `Translator` does not exist, the offer becomes the classic page widget:
inject `translate.google.com/translate_a/element.js` and let it rewrite the
document.

It is deliberately **opt-in behind a button**, not automatic, for two reasons.
It mutates the DOM React owns, so it can destabilise the app — the user should
be choosing that trade. And it sends the page to Google, which is a third-party
disclosure the site otherwise avoids; the cookie banner already sets the
expectation that such things are asked for, not assumed.

Elements that must survive intact are marked `translate="no"`: the brand
wordmark and venue names.

## Architecture

```text
LocaleProvider (existing)          — which language the UI is in
        │
        ▼
translation/engine.ts              — capability detection, the Translator
        │                            instance, the cache, the batching queue.
        │                            Framework-free, no React.
        ▼
translation/TranslationProvider    — status for the UI: unsupported | idle |
        │                            downloading | ready | error
        ▼
useTranslated(text) ─────────────▶ every component that renders Supabase text
<Translated text={…} />
```

### Why translate at the render site rather than in the data layer

The obvious alternative — translate the `Event` objects as they come out of
`useEvents` — breaks lookups. `EventRow` and `EventCard` resolve a category's
colour and icon with `byDisplayName.get(event.categoryMain)`, keyed on the
Polish display name. Overwrite that field and every card loses its colour.

Translating only what is *rendered* keeps every key, every lookup and every
filter URL in Polish, which is also what makes the translation layer removable:
delete it and the app still works, in Polish.

### The batching queue

Fifteen cards asking for fifteen translations must not be fifteen awaited round
trips. `useTranslated` reads a synchronous cache through `useSyncExternalStore`
and requests misses in an effect; requests accumulate within a microtask and
flush as one `Promise.all` against a single translator instance. Subscribers are
notified once when the batch lands.

The server snapshot is always the original text, so static HTML and the first
client paint agree — hydration cannot mismatch, and the Polish text is what
search engines index.

### The cache

Two levels, both keyed `${source}|${target}|${text}`:

- a module-level `Map` for the session's renders;
- `sessionStorage`, so paging through a list and coming back does not
  re-translate. Not `localStorage`: machine translations are not worth
  persisting across sessions, and the model may improve between browser
  versions.

Cache writes are wrapped — `sessionStorage` throws in private mode and when the
quota is hit, and a translation failing to persist is not worth an error.

## What is translated

| Content | Translated | Why |
| --- | --- | --- |
| `event.name` | Yes | The primary content. |
| `event.description` | Yes | Prose, the longest win. |
| `event.categoryMain` / `categorySub` (chips) | Yes | Rendered labels only; the underlying values stay Polish. |
| `categories.display_name` (filter tree) | Yes | Closed set of ~90 strings, so it caches almost immediately. |
| Descriptive price labels | Yes | Polish prose (`Karnet od 189 zł`). |
| Venue names | **No** | Proper nouns. Marked `translate="no"` so the fallback widget leaves them alone too. |
| Dates, times, prices | No | Already formatted per locale by existing code. |
| URLs, slugs, filter query strings | No | They key the data. |

## Failure behaviour

Every failure degrades to the original Polish, silently:

- `Translator` missing → the fallback is offered, and content stays Polish.
- Availability `unavailable` for `pl→en` → same.
- Download fails or is refused → status `error`, content stays Polish, one
  dismissible notice rather than a per-string error.
- A single string failing → that string stays Polish; the batch is not abandoned.

Translation is never on the critical path: text renders immediately in Polish
and is replaced when and if a translation arrives.

## Testing

- `engine.spec.ts` — cache hit/miss, batching (N requests in one tick produce
  one `translate` pass), the unsupported path returning input unchanged, a
  rejected translation leaving the original in place. `globalThis.Translator` is
  stubbed; no test touches a real model.
- `useTranslated.spec.tsx` — renders Polish first, then the translation; returns
  the original when the locale is `pl`; never suspends.
- Component tests keep asserting on Polish strings, which is the proof that the
  layer is additive: with no `Translator` present — the state under vitest —
  every existing test must pass untouched.
- E2E is unchanged and asserts Polish, since headless Chrome in CI has no model.

## Out of scope

Translating into languages other than English. `LOCALES` stays `['pl', 'en']`;
the engine takes the target from the active locale, so adding a language is
adding it to that list plus a message table, not touching this layer.

Server-side or build-time translation, and any persisted translation column in
Supabase. If machine translation proves good enough to keep, caching the
category table's ~90 strings at build time would be the next step — it is the
only closed set here.

## Assumptions made without the owner

These were decided to keep moving and are the first things to revisit:

1. **Venue names are not translated.** Reversible in one line if the preference
   is the opposite.
2. **The Google widget is opt-in, not automatic.** Making it automatic on
   unsupported browsers is a one-line change, at the cost of the DOM-mutation
   risk landing on users who did not ask for it.
3. **English is translated from Polish, always.** The source language is
   hardcoded `pl` because that is what the scrapers produce. A stray English
   event title would be "translated" from Polish to English, which the model
   generally leaves alone.
