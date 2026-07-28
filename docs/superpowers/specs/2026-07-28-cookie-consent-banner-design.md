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
there is nothing to ask. It owns a single effect:

```
choice === 'accepted'  →  window.clarity?.('consent')
```

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
- **Accept** — store `'accepted'`, effect calls `clarity('consent')`, `_clck` and
  `_clsk` are set, sessions stitch from then on.
- **Reject** — store `'rejected'`, no call, Clarity stays cookieless and keeps
  recording. Banner hidden.
- **Return visit, previously accepted** — no banner, effect re-signals on load.
- **Footer link** — `reopen()` shows the banner again.
- **Second tab** — the `storage` listener syncs both tabs.

### Withdrawal

Switching from accepted to rejected has to undo the storage, not just stop
future writes — otherwise "withdraw consent" leaves a year-long `_clck` on the
device. On a reject that follows an accept:

1. Delete `_clck` and `_clsk` by setting each to an expired date on the current
   host, matching how Clarity scoped them. Measured on the live site, Clarity
   writes `_clck` twice — first `domain=.github.io`, which the browser rejects
   because `github.io` is a public suffix, then `domain=.aleksanderdudek.github.io`,
   which succeeds. Deletion must therefore target the host-scoped variant, and a
   host-only fallback should be attempted too.
2. Reload the page, so the already-initialised Clarity instance in the current
   document starts over without consent.

Implementation note: check Clarity's current consent API first. If a documented
revoke call exists it is preferable to manual cookie deletion. Do not assume one
exists — none was found while investigating, and inventing a call that silently
no-ops would leave the cookies in place while looking correct.

## Hydration

`getServerSnapshot` returns `null` and the banner renders only after mount.
The static export prerenders no banner markup; otherwise all 1087 prerendered
pages would ship it and flash it at visitors who have already answered.

## Testing

- `src/lib/consent.spec.ts` — parse valid values, unknown values, corrupt JSON,
  absent storage.
- `CookieBanner.spec.tsx` — renders with no stored choice; hides after accept and
  after reject; accept calls `window.clarity` with `'consent'`; reject does not
  call it; `reopen` re-shows; a `storage` event syncs the choice.
- e2e (main suite) — banner on first load, choice survives a reload, reject
  persists.
- `e2e-export/analytics.spec.ts` already guards the build-time tag gate and is
  unchanged by this work.

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
