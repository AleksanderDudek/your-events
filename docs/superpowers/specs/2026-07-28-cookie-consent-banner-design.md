# Cookie consent banner — design

Date: 2026-07-28
Status: approved, not yet implemented

## Why

Microsoft Clarity is installed and recording, but it stores nothing on the
device: measured on the live site, `document.cookie` is empty and Clarity makes
zero cookie write attempts. Calling `clarity('consent')` in the console makes
`_clck` and `_clsk` appear immediately.

Clarity is therefore running in cookie-consent mode and never receives a consent
signal. Without `_clck` (user id) and `_clsk` (session id) nothing links one page
load to the next, so every load and every browser context becomes an unlinkable
new session. Recording itself works — `POST r.clarity.ms/collect` returns 204.

The tag is not at fault. It executes exactly once per document; this was verified
across four SPA navigations plus back/forward on both a local build and the live
site, with `#ms-clarity` staying at 1 and the snippet running once.

The site is Polish and EU-facing, and has no consent UI, so the fix is a consent
banner rather than disabling consent mode in the Clarity dashboard.

Disabling it in the dashboard was never actually an option. Per Microsoft's
docs, Consent Mode is **enabled by default for visitors from the EEA, UK and
Switzerland**, and since 31 October 2025 Clarity enforces a consent signal for
those page visits regardless of the project setting. For a Polish site the
banner is the only route to session stitching.

## Decisions

Settled with the user before design:

1. **Clarity keeps loading before a choice is made.** It records cookielessly and
   only starts storing on accept. Heatmaps and pageview data survive for visitors
   who never answer; only session stitching waits for consent. Storing nothing on
   the device is what the EU cookie rule targets, and this is the flow Clarity's
   consent API is built for.
2. **Accept and reject, equally prominent, changeable later.** Reject must be as
   easy as accept. A footer link reopens the choice, covering withdrawal.
3. **Reject means cookieless, not "stop recording."** Clarity carries on without
   device storage.
4. **A `/prywatnosc/` page is scaffolded** with factual content, linked from the
   banner. Legal framing is the owner's to review — see Open questions.
5. **State lives in a `lib` + hook pair, not a context provider.** This mirrors
   the existing `src/lib/presets.ts` + `src/components/service/usePresets.ts`
   split rather than adding a fifth provider to `src/app/providers.tsx`.

## Architecture

| File | Role |
|---|---|
| `src/lib/consent.ts` | Pure. `ConsentChoice = 'accepted' \| 'rejected'`, `parseConsent(raw)`, `CONSENT_STORAGE_KEY = 'go-to-city.consent'`. No DOM access. |
| `src/components/service/useConsent.ts` | `useSyncExternalStore` over `localStorage` plus the `storage` event. Returns `{ choice, isOpen, accept, reject, reopen }`. |
| `src/components/common/CookieBanner/CookieBanner.tsx` | The banner. Mounted once in `AppLayout`. |
| `src/components/common/CookieBanner/CookieBanner.module.scss` | Styles. |
| `src/app/prywatnosc/page.tsx` | Privacy page, PL/EN through `useTranslation`. |
| `src/i18n/messages.ts` | `COOKIE_*` keys in both locales. |
| `src/components/common/AppFooter/AppFooter.tsx` | "Cookies" link calling `reopen()`. |
| `src/app/sitemap.ts` | Add `/prywatnosc/`. |

`isOpen` is `choice === null || reopened`, where `reopened` is transient
module-level state in the same external store — deliberately not persisted, so a
reload after reopening does not keep reopening the banner.

### The Clarity bridge

`CookieBanner` mounts unconditionally in `AppLayout` and returns `null` when
there is nothing to ask. It owns a single effect that signals the stored choice
through Clarity's **Consent API v2**:

```js
// accepted
window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
// rejected
window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
```

`consentv2` is the current API; the older `clarity('consent', true)` is
documented as deprecated and must not be used. Both parameters are required.

`ad_Storage` is always `denied`: the site runs no advertising, so granting it
would be an inaccurate signal. Session stitching comes from the first-party
`_clck`/`_clsk` cookies, which are what `analytics_Storage` governs.

The effect must run on every page load, not only on the click, because a
returning visitor who already accepted renders no banner but still needs the
signal — `_clsk` expires after a day. The call is idempotent.

Two properties make this safe:

- The Clarity snippet's stub queues calls on `c[a].q`, so signalling before
  `clarity.js` has loaded is replayed rather than lost.
- Where the tag is gated off (dev and both Playwright suites, per the
  `NEXT_PUBLIC_CLARITY_PROJECT_ID` gate), `window.clarity` is undefined and the
  optional call is a no-op.

Putting the effect in an always-mounted component is the reason it is not inside
`useConsent` itself: a hook called from several consumers would fire the effect
once per consumer.

## Flow

- **First visit** — no stored choice, banner renders. Clarity is already
  recording cookielessly.
- **Accept** — store `'accepted'`, effect signals `analytics_Storage: 'granted'`,
  `_clck` and `_clsk` are set, sessions stitch from then on.
- **Reject** — store `'rejected'`, effect signals `analytics_Storage: 'denied'`,
  Clarity stays cookieless and keeps recording. Banner hidden.
- **Return visit, previously accepted** — no banner, effect re-signals on load.
- **Footer link** — `reopen()` shows the banner again.
- **Second tab** — the `storage` listener syncs both tabs.

### Withdrawal

Switching from accepted to rejected has to undo the storage, not just stop
future writes — otherwise "withdraw consent" leaves a year-long `_clck` on the
device.

**Clarity handles this itself.** Per the v2 API docs: when a user rejects the
cookie, Clarity deletes any existing cookie for the site, ends the current
session, and restarts in no-consent mode, which persists on future visits until
consent is given again.

So withdrawal is just the denied call — no manual cookie deletion, no forced
reload. Deleting the cookies by hand would duplicate work Clarity already does
and would have to guess at its cookie scoping.

That scoping is worth recording anyway, since it looked like a bug during
investigation and is not one: Clarity writes `_clck` twice, first with
`domain=.github.io`, which the browser rejects because `github.io` is a public
suffix, then with `domain=.aleksanderdudek.github.io`, which succeeds. Clarity
recovers on its own.

### Measured, not assumed

Verified 2026-07-28 against a real build (`NEXT_PUBLIC_CLARITY_PROJECT_ID` set,
`out/` served locally, driven in Chrome). Every claim above that came from
Microsoft's documentation was checked rather than trusted:

| State | Cookies | Clarity's consent read-back |
|---|---|---|
| Before any choice | none | — |
| After accept | `_clck`, `_clsk` | `analytics_Storage: GRANTED`, `ad_Storage: DENIED` |
| After reopening and rejecting | **none — both deleted** | `analytics_Storage: DENIED`, `ad_Storage: DENIED` |
| After reload, rejection stored | none | `analytics_Storage: DENIED` |

Three things this settles:

- **Withdrawal genuinely deletes.** Clarity removed `_clck` and `_clsk` itself
  on rejection, exactly as documented. No manual cookie clearing is needed, and
  the earlier draft of this spec that called for it was wrong.
- **`ad_Storage: 'denied'` is honoured.** The read-back reflects what the banner
  sends, so the signal is reaching Clarity intact.
- **The privacy page's list of two cookies is accurate** for first-party
  cookies. Microsoft documents further Clarity cookies (`CLID`, `ANONCHK`, `MR`,
  `MUID`, `SM`), and none of them appeared. Caveat on scope: those are set on
  Clarity's own domains, so they are invisible to `document.cookie` and this
  check cannot rule them out as third-party cookies — it establishes only that
  the site sets no first-party cookie beyond the two named.

## Hydration

The static export must prerender no banner markup. Otherwise all 1087
prerendered pages ship it, and every visitor who already answered sees it flash
before hydration reads their choice from localStorage.

Two separate mechanisms are needed, and conflating them was a bug caught in
review:

- `getServerSnapshot` returning a constant buys **hydration safety** — the
  server render and the hydration render agree, so React does not warn. It does
  *not* hide the banner. Consent is unknowable at build time, so the constant
  parses to "no choice", and "no choice" is exactly the state that opens the
  banner.
- An explicit **hydration gate** is what keeps it out of the HTML:

  ```ts
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);
  // isOpen: isHydrated && (choice === null || reopened)
  ```

  React uses `getServerSnapshot` for both the prerender and the hydration
  render, then switches to `getSnapshot`. So `isHydrated` reads false until
  hydration finishes — the "have we mounted yet" signal, expressed through the
  same store rather than a separate `useEffect`.

## Testing

- `src/lib/consent.spec.ts` — parse valid values, unknown values, corrupt JSON,
  absent storage.
- `CookieBanner.spec.tsx` — renders with no stored choice; hides after accept and
  after reject; accept calls `window.clarity` with `'consentv2'` and
  `analytics_Storage: 'granted'`; reject calls it with `'denied'`; `reopen`
  re-shows; a `storage` event syncs the choice; a missing `window.clarity` does
  not throw.
- e2e (main suite) — banner on first load, choice survives a reload, reject
  persists, and the cookie assertions only a real browser can make: accept sets
  `_clck`/`_clsk`, and a later reject removes them. That second one is taken
  from Microsoft's docs rather than observed, so it is the claim most in need of
  a test.
- `e2e-export/analytics.spec.ts` already guards the build-time tag gate and is
  unchanged by this work.

Clarity exposes a consent read-back that is useful when verifying by hand:

```js
clarity('metadata', (d, upgrade, consent) => console.log(consent), false, true, true);
// → { analytics_storage: "GRANTED" | "DENIED", ad_storage: "GRANTED" | "DENIED" }
```

## Accessibility

`role="region"` with an `aria-label`. Not a focus trap — it is not a modal.
Both buttons keyboard-reachable and visually equal in weight. Must pass the
`jest-axe` and `@axe-core/playwright` checks the repo already runs.

## Privacy page content

Factual, not legal advice: what Clarity records (session replays, clicks,
scrolls, page URLs, device and browser), the two cookies and their lifetimes
(`_clck` one year, `_clsk` one day), Microsoft as the processor, and how to
withdraw consent via the footer link.

## Out of scope

- Granular per-category consent toggles. There is one vendor; the categories
  would all be a single checkbox.
- Blocking Clarity entirely before consent. Decided against — see Decisions 1.
- Server-side consent storage. The site is a static export with no server.

## Open questions

- The `/prywatnosc/` wording needs the owner's review before it can be treated
  as a real privacy policy. The implementation ships it as factual description
  with that caveat noted, not as signed-off legal text.
