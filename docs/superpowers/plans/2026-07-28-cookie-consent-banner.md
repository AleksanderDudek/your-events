# Cookie Consent Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give visitors an accept/reject cookie choice and pass it to Microsoft Clarity, so accepted sessions get the `_clck`/`_clsk` cookies that link page loads into one session.

**Architecture:** Pure consent parsing in `src/lib/consent.ts`, a `useSyncExternalStore` binding over `localStorage` in `src/components/service/useConsent.ts`, and a `CookieBanner` mounted once in `AppLayout` that both renders the UI and signals Clarity's Consent API v2. This mirrors the existing `src/lib/presets.ts` + `src/components/service/usePresets.ts` split rather than adding a provider.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), React 19, MUI 7, SCSS modules, Vitest + Testing Library, Playwright, Zod-validated env.

**Spec:** `docs/superpowers/specs/2026-07-28-cookie-consent-banner-design.md`

---

## Background the engineer needs

**Why this exists.** Clarity is installed and recording, but Consent Mode is on by default for EEA/UK/CH visitors (Microsoft enforces this since 31 Oct 2025). Without a consent signal Clarity sets no cookies, so it assigns a unique id *per page view* and one visit shows up as many unlinkable recordings.

**The Clarity API.** Use `consentv2`. The older `clarity('consent', true)` is deprecated — do not use it.

```js
window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }); // accept
window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });  // reject
```

Both parameters are required. `ad_Storage` is always `'denied'` — the site runs no advertising.

**Two things that make the call safe anywhere:**

1. The Clarity snippet defines a stub that queues calls on `window.clarity.q`, so calling before `clarity.js` loads is replayed, not lost.
2. Clarity is gated off outside the deploy build (`NEXT_PUBLIC_CLARITY_PROJECT_ID`), so `window.clarity` is `undefined` in dev and in both Playwright suites. Always call with `?.`.

**Repo conventions you must follow:**

- localStorage keys are namespaced `go-to-city.*` (see `src/components/service/usePresets.ts`).
- Client components start with `'use client'`.
- Polish is the source of truth in `src/i18n/messages.ts`; English is checked against it with `satisfies Messages`, so a missing English key is a type error.
- Components live in `src/components/common/<Name>/<Name>.tsx` with a sibling `.module.scss` and `.spec.tsx`.
- `trailingSlash: true`, so routes are `/prywatnosc/`.
- Package manager is **pnpm**. Never run `npm install`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/consent.ts` | Pure: the `ConsentChoice` type, storage key, `parseConsent`. No DOM. |
| `src/lib/consent.spec.ts` | Unit tests for the above. |
| `src/components/service/useConsent.ts` | localStorage binding via `useSyncExternalStore`, cross-tab `storage` sync, transient reopen flag. |
| `src/components/common/CookieBanner/CookieBanner.tsx` | Banner UI + the one effect that signals Clarity. |
| `src/components/common/CookieBanner/CookieBanner.module.scss` | Banner styles. |
| `src/components/common/CookieBanner/CookieBanner.spec.tsx` | Component tests. |
| `src/components/common/AppLayout/AppLayout.tsx` | Mounts `CookieBanner` once. |
| `src/components/common/AppFooter/AppFooter.tsx` | "Cookies" link calling `reopen()`. |
| `src/config/community.ts` | Adds `PRIVACY_PATH`, next to the existing `GROW_WITH_US_PATH`. |
| `src/app/prywatnosc/page.tsx` | Server component: metadata only, renders the view. |
| `src/components/views/PrivacyView/PrivacyView.tsx` | The client component with the copy. |
| `src/i18n/messages.ts` | `COOKIE_*` and `PRIVACY_*` keys, pl + en. |
| `src/app/sitemap.ts` | Adds `PRIVACY_PATH`. |
| `e2e/cookie-consent.spec.ts` | Browser-level behaviour incl. real cookie assertions. |

---

## Task 1: Pure consent module

**Files:**
- Create: `src/lib/consent.ts`
- Test: `src/lib/consent.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/consent.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CONSENT_STORAGE_KEY, parseConsent } from './consent';

describe('parseConsent', () => {
  it('accepts the two known values', () => {
    expect(parseConsent('accepted')).toBe('accepted');
    expect(parseConsent('rejected')).toBe('rejected');
  });

  it('treats anything else as no choice made', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('yes')).toBeNull();
    expect(parseConsent('ACCEPTED')).toBeNull();
    expect(parseConsent('{"choice":"accepted"}')).toBeNull();
  });

  it('namespaces the storage key like the rest of the app', () => {
    expect(CONSENT_STORAGE_KEY).toBe('go-to-city.consent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/consent.spec.ts`
Expected: FAIL — `Failed to resolve import "./consent"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/consent.ts`:

```ts
// Pure consent helpers. The browser-storage side lives in
// components/service/useConsent, mirroring the lib/presets split so the rules
// with teeth can be tested without a DOM.

export type ConsentChoice = 'accepted' | 'rejected';

export const CONSENT_STORAGE_KEY = 'go-to-city.consent';

const CHOICES: readonly ConsentChoice[] = ['accepted', 'rejected'];

// A stored value is only honoured if it is exactly one of the known choices.
// Anything else — absent, empty, an old format, hand-edited junk — reads as
// "no choice yet", which shows the banner again rather than silently assuming
// consent.
export function parseConsent(raw: string | null): ConsentChoice | null {
  if (raw === null) return null;
  return (CHOICES as readonly string[]).includes(raw) ? (raw as ConsentChoice) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/consent.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consent.ts src/lib/consent.spec.ts
git commit -m "feat(consent): add the pure consent choice module"
```

---

## Task 2: The useConsent hook

**Files:**
- Create: `src/components/service/useConsent.ts`
- Test: covered by Task 3's component tests (the hook is a thin storage binding; testing it through the banner keeps one behavioural surface instead of two)

Read `src/components/service/usePresets.ts` before writing this — it solves the same problem and this file should look like its smaller sibling.

- [ ] **Step 1: Write the implementation**

Create `src/components/service/useConsent.ts`:

```ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { CONSENT_STORAGE_KEY, ConsentChoice, parseConsent } from '@/lib/consent';

// localStorage is an external store, so it is read through useSyncExternalStore
// rather than copied into state inside an effect: the server snapshot is
// explicit (no hydration mismatch on the static export), and the `storage`
// event keeps a second tab in step.

type Listener = () => void;
const listeners = new Set<Listener>();

// Whether the visitor asked to see the banner again via the footer link. Kept
// in memory on purpose — persisting it would reopen the banner on every reload.
let reopened = false;

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

// The snapshot is the raw string plus the reopen flag, joined into one scalar:
// useSyncExternalStore compares snapshots by identity, so returning a fresh
// object each read would loop forever.
function getSnapshot(): string {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    // localStorage throws in private mode / sandboxed iframes — treat as unset.
  }
  return `${reopened ? 'open' : 'closed'}:${raw ?? ''}`;
}

// Nothing is known during the prerender, so the server snapshot is a constant.
// This buys hydration safety — the server render and the hydration render agree
// — but it does NOT hide the banner: the constant parses to "no choice", and
// "no choice" is the state that opens it. Keeping the banner out of the
// prerendered HTML is the isHydrated gate's job, below.
function getServerSnapshot(): string {
  return 'closed:';
}

function write(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore: a visitor who cannot persist the choice simply sees the banner
    // again next time, which is the safe direction to fail in.
  }
  reopened = false;
  emit();
}

export interface UseConsentResult {
  choice: ConsentChoice | null;
  isOpen: boolean;
  accept: () => void;
  reject: () => void;
  reopen: () => void;
}

export function useConsent(): UseConsentResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // React uses getServerSnapshot for the prerender AND the hydration render,
  // then switches to getSnapshot — so this reads false until hydration
  // finishes. It is the "have we mounted yet" signal, expressed through the
  // same store instead of a separate useEffect, and it is what keeps the
  // banner out of the static HTML of all 1000+ prerendered pages.
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  // Split at the FIRST colon only. String#split would cut a raw value that
  // itself contains a colon into pieces and silently drop the rest, which read
  // hand-edited junk as valid consent. The prefixes are colon-free, so the
  // first colon is always the real separator.
  const separatorIndex = snapshot.indexOf(':');
  const openFlag = snapshot.slice(0, separatorIndex);
  const raw = snapshot.slice(separatorIndex + 1);
  const choice = parseConsent(raw);

  const accept = useCallback(() => write('accepted'), []);
  const reject = useCallback(() => write('rejected'), []);
  const reopen = useCallback(() => {
    reopened = true;
    emit();
  }, []);

  return {
    choice,
    isOpen: isHydrated && (choice === null || openFlag === 'open'),
    accept,
    reject,
    reopen,
  };
}

// Test seam: module state outlives a single test file otherwise.
export function resetConsentStoreForTests(): void {
  reopened = false;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/service/useConsent.ts
git commit -m "feat(consent): read the stored choice through useSyncExternalStore"
```

---

## Task 3: CookieBanner component

**Files:**
- Create: `src/components/common/CookieBanner/CookieBanner.tsx`
- Create: `src/components/common/CookieBanner/CookieBanner.module.scss`
- Test: `src/components/common/CookieBanner/CookieBanner.spec.tsx`
- Modify: `src/i18n/messages.ts` (add the keys used below to both `pl` and `en`)
- Modify: `src/config/community.ts` (add `PRIVACY_PATH`)

Add the route constant to `src/config/community.ts`, next to the existing
`GROW_WITH_US_PATH = '/rozwijaj-z-nami'`. The banner links to it and Task 5
builds the page behind it:

```ts
export const PRIVACY_PATH = '/prywatnosc';
```

Add these keys to `src/i18n/messages.ts` — the component will not type-check without them. Polish object:

```ts
  COOKIE_TITLE: 'Cookies i analityka',
  COOKIE_BODY:
    'Używamy Microsoft Clarity, żeby zobaczyć, jak korzystasz z serwisu. Zgoda pozwala połączyć Twoje odsłony w jedną sesję.',
  COOKIE_ACCEPT: 'Akceptuję',
  COOKIE_REJECT: 'Odrzucam',
  COOKIE_MORE: 'Polityka prywatności',
  COOKIE_REGION_LABEL: 'Zgoda na cookies',
  COOKIE_FOOTER_LINK: 'Cookies',
```

English object (same keys, `satisfies Messages` enforces it):

```ts
  COOKIE_TITLE: 'Cookies and analytics',
  COOKIE_BODY:
    'We use Microsoft Clarity to see how the site is used. Consent lets us join your page views into a single session.',
  COOKIE_ACCEPT: 'Accept',
  COOKIE_REJECT: 'Reject',
  COOKIE_MORE: 'Privacy policy',
  COOKIE_REGION_LABEL: 'Cookie consent',
  COOKIE_FOOTER_LINK: 'Cookies',
```

- [ ] **Step 1: Write the failing test**

Create `src/components/common/CookieBanner/CookieBanner.spec.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieBanner from './CookieBanner';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { resetConsentStoreForTests } from '@/components/service/useConsent';
import { LocaleProvider } from '@/i18n';

function renderBanner() {
  return render(
    <LocaleProvider>
      <CookieBanner />
    </LocaleProvider>
  );
}

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
    (window as unknown as { clarity?: unknown }).clarity = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it('asks when no choice is stored', () => {
    renderBanner();
    expect(screen.getByRole('region', { name: 'Zgoda na cookies' })).toBeInTheDocument();
  });

  it('grants analytics storage on accept and remembers it', async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Akceptuję' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted');
    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('denies analytics storage on reject and remembers it', async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Odrzucam' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('rejected');
    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('re-signals a stored choice on mount so a returning visitor keeps cookies', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    renderBanner();

    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('does not throw when Clarity is gated off', async () => {
    delete (window as unknown as { clarity?: unknown }).clarity;
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Akceptuję' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/common/CookieBanner/CookieBanner.spec.tsx`
Expected: FAIL — `Failed to resolve import "./CookieBanner"`.

- [ ] **Step 3: Write the styles**

Create `src/components/common/CookieBanner/CookieBanner.module.scss`:

```scss
.banner {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 1300;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background-color: var(--color-surface-glass);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}

.text {
  flex: 1 1 20rem;
  min-width: 0;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
```

- [ ] **Step 4: Write minimal implementation**

Create `src/components/common/CookieBanner/CookieBanner.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { Route } from 'next';
import { useConsent } from '@/components/service/useConsent';
import { useTranslation } from '@/i18n';
import { PRIVACY_PATH } from '@/config/community';
import styles from './CookieBanner.module.scss';

// Clarity's Consent API v2. `ad_Storage` is always denied: the site carries no
// advertising, so granting it would be an inaccurate signal. Session stitching
// comes from the first-party _clck/_clsk cookies, which analytics_Storage
// governs.
function signalClarity(granted: boolean): void {
  window.clarity?.('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  });
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const { choice, isOpen, accept, reject } = useConsent();

  // Runs on every load, not only on the click: a returning visitor who already
  // accepted renders no banner but still needs the signal, because _clsk
  // expires after a day. The call is idempotent, and the Clarity snippet queues
  // it if clarity.js has not finished loading.
  useEffect(() => {
    if (choice === null) return;
    signalClarity(choice === 'accepted');
  }, [choice]);

  if (!isOpen) return null;

  return (
    <Box className={styles.banner} role="region" aria-label={t.COOKIE_REGION_LABEL}>
      <Box className={styles.text}>
        <Typography variant="subtitle2">{t.COOKIE_TITLE}</Typography>
        <Typography variant="body2">
          {t.COOKIE_BODY}{' '}
          <Link href={PRIVACY_PATH as Route}>{t.COOKIE_MORE}</Link>
        </Typography>
      </Box>
      <Box className={styles.actions}>
        <Button variant="outlined" onClick={reject}>
          {t.COOKIE_REJECT}
        </Button>
        <Button variant="contained" onClick={accept}>
          {t.COOKIE_ACCEPT}
        </Button>
      </Box>
    </Box>
  );
}
```

Add the global type for `window.clarity`. Create `src/types/clarity.d.ts`:

```ts
// Microsoft Clarity's tag defines this. It is absent wherever the tag is gated
// off (dev, both Playwright suites), so every call site must use `?.`.
interface ClarityConsentV2 {
  ad_Storage: 'granted' | 'denied';
  analytics_Storage: 'granted' | 'denied';
}

declare global {
  interface Window {
    clarity?: (command: 'consentv2', consent: ClarityConsentV2) => void;
  }
}

export {};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/common/CookieBanner/CookieBanner.spec.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/CookieBanner src/types/clarity.d.ts src/i18n/messages.ts
git commit -m "feat(consent): add the cookie banner and signal Clarity consent v2"
```

---

## Task 4: Mount the banner and add the footer link

**Files:**
- Modify: `src/components/common/AppLayout/AppLayout.tsx`
- Modify: `src/components/common/AppFooter/AppFooter.tsx`

- [ ] **Step 1: Mount the banner**

In `src/components/common/AppLayout/AppLayout.tsx`, add the import:

```tsx
import CookieBanner from '@/components/common/CookieBanner/CookieBanner';
```

and render it as the last child of the layout `Box`, after `<AppFooter />`:

```tsx
      <AppFooter />
      <CookieBanner />
```

- [ ] **Step 2: Add the footer link**

In `src/components/common/AppFooter/AppFooter.tsx`, import the hook:

```tsx
import { useConsent } from '@/components/service/useConsent';
```

read it inside the component:

```tsx
  const { reopen } = useConsent();
```

and add a button alongside the existing footer links. It is a `<button>`, not a link, because it changes app state rather than navigating:

```tsx
        <button type="button" className={styles.link} onClick={reopen}>
          {t.COOKIE_FOOTER_LINK}
        </button>
```

- [ ] **Step 3: Run the whole unit suite**

Run: `pnpm test`
Expected: PASS. The pre-existing 346 tests plus the new ones.

- [ ] **Step 4: Lint and type-check**

Run: `pnpm lint && pnpm type-check`
Expected: no errors. One pre-existing `no-page-custom-font` warning in `layout.tsx` is expected and unrelated.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/AppLayout/AppLayout.tsx src/components/common/AppFooter/AppFooter.tsx
git commit -m "feat(consent): mount the banner and let the footer reopen the choice"
```

---

## Task 5: Privacy page

**Files:**
- Create: `src/app/prywatnosc/page.tsx`
- Create: `src/components/views/PrivacyView/PrivacyView.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/app/sitemap.ts`

Read `src/app/rozwijaj-z-nami/page.tsx` first and copy its shape exactly. The split matters and is easy to get wrong: the **page is a server component** that does nothing but export `metadata` and render a view, and the **view is the `'use client'` component** that calls `useTranslation`. A page cannot be both — `export const metadata` and `'use client'` are mutually exclusive in the App Router, so putting the copy directly in the page will fail to build.

- [ ] **Step 1: Add the copy keys**

Add to the Polish object in `src/i18n/messages.ts`:

```ts
  PRIVACY_TITLE: 'Polityka prywatności',
  PRIVACY_INTRO:
    'Ta strona używa Microsoft Clarity do analizy tego, jak korzystasz z serwisu. Poniżej opisujemy, co dokładnie jest zbierane.',
  PRIVACY_WHAT_HEADING: 'Co zbieramy',
  PRIVACY_WHAT_BODY:
    'Nagrania sesji (ruch kursora, kliknięcia, przewijanie), adresy odwiedzanych podstron oraz informacje o urządzeniu i przeglądarce.',
  PRIVACY_COOKIES_HEADING: 'Cookies',
  PRIVACY_COOKIES_BODY:
    '_clck — identyfikator użytkownika, ważny rok. _clsk — identyfikator sesji, ważny dobę. Oba ustawiane są dopiero po Twojej zgodzie.',
  PRIVACY_PROCESSOR_HEADING: 'Kto przetwarza dane',
  PRIVACY_PROCESSOR_BODY: 'Microsoft, jako dostawca usługi Clarity.',
  PRIVACY_WITHDRAW_HEADING: 'Wycofanie zgody',
  PRIVACY_WITHDRAW_BODY:
    'Zgodę możesz zmienić w każdej chwili linkiem „Cookies” w stopce. Po odrzuceniu Clarity usuwa swoje cookies i przestaje je zapisywać.',
```

English object:

```ts
  PRIVACY_TITLE: 'Privacy policy',
  PRIVACY_INTRO:
    'This site uses Microsoft Clarity to analyse how the site is used. What follows is exactly what gets collected.',
  PRIVACY_WHAT_HEADING: 'What we collect',
  PRIVACY_WHAT_BODY:
    'Session recordings (cursor movement, clicks, scrolling), the addresses of the pages you visit, and information about your device and browser.',
  PRIVACY_COOKIES_HEADING: 'Cookies',
  PRIVACY_COOKIES_BODY:
    '_clck — user identifier, valid one year. _clsk — session identifier, valid one day. Both are set only after you consent.',
  PRIVACY_PROCESSOR_HEADING: 'Who processes the data',
  PRIVACY_PROCESSOR_BODY: 'Microsoft, as the provider of Clarity.',
  PRIVACY_WITHDRAW_HEADING: 'Withdrawing consent',
  PRIVACY_WITHDRAW_BODY:
    'You can change your choice at any time with the "Cookies" link in the footer. After a rejection Clarity deletes its cookies and stops writing them.',
```

Also add the two metadata keys, since the page exports `metadata` the way
`rozwijaj-z-nami` does. Polish:

```ts
  PRIVACY_META_TITLE: 'Polityka prywatności',
  PRIVACY_META_DESCRIPTION:
    'Jakie dane zbiera Microsoft Clarity na tej stronie, jakie cookies są ustawiane i jak wycofać zgodę.',
```

English:

```ts
  PRIVACY_META_TITLE: 'Privacy policy',
  PRIVACY_META_DESCRIPTION:
    'What Microsoft Clarity collects on this site, which cookies are set, and how to withdraw consent.',
```

- [ ] **Step 2: Create the page (server component)**

Create `src/app/prywatnosc/page.tsx`:

```tsx
import type { Metadata } from 'next';
import PrivacyView from '@/components/views/PrivacyView/PrivacyView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { SITE_URL } from '@/config/site';
import { PRIVACY_PATH } from '@/config/community';

// Static metadata (no params to await): like the rest of the export, the SEO
// tags ship in DEFAULT_LOCALE.
const m = messages[DEFAULT_LOCALE];

export const metadata: Metadata = {
  title: m.PRIVACY_META_TITLE,
  description: m.PRIVACY_META_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${PRIVACY_PATH}` },
  openGraph: {
    title: m.PRIVACY_META_TITLE,
    description: m.PRIVACY_META_DESCRIPTION,
    type: 'website',
  },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
```

- [ ] **Step 3: Create the view (client component)**

Create `src/components/views/PrivacyView/PrivacyView.tsx`:

```tsx
'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';

export default function PrivacyView() {
  const { t } = useTranslation();

  const sections = [
    { heading: t.PRIVACY_WHAT_HEADING, body: t.PRIVACY_WHAT_BODY },
    { heading: t.PRIVACY_COOKIES_HEADING, body: t.PRIVACY_COOKIES_BODY },
    { heading: t.PRIVACY_PROCESSOR_HEADING, body: t.PRIVACY_PROCESSOR_BODY },
    { heading: t.PRIVACY_WITHDRAW_HEADING, body: t.PRIVACY_WITHDRAW_BODY },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h1" gutterBottom>
        {t.PRIVACY_TITLE}
      </Typography>
      <Typography variant="body1" paragraph>
        {t.PRIVACY_INTRO}
      </Typography>
      {sections.map((s) => (
        <Box key={s.heading} sx={{ mt: 4 }}>
          <Typography variant="h2" gutterBottom>
            {s.heading}
          </Typography>
          <Typography variant="body1">{s.body}</Typography>
        </Box>
      ))}
    </Container>
  );
}
```

- [ ] **Step 4: Add the route to the sitemap**

`src/app/sitemap.ts` already imports `GROW_WITH_US_PATH` from `@/config/community` and pushes an entry built from it. Add `PRIVACY_PATH` to that same import and copy the entry, lowering the priority — a privacy page is not a landing page:

```ts
    {
      url: `${SITE_URL}${PRIVACY_PATH}`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
```

- [ ] **Step 5: Verify the build produces the page**

Run: `pnpm build && ls out/prywatnosc/index.html`
Expected: the file exists.

- [ ] **Step 6: Commit**

```bash
git add src/app/prywatnosc src/components/views/PrivacyView src/i18n/messages.ts src/app/sitemap.ts src/config/community.ts
git commit -m "feat(consent): add the privacy page describing what Clarity collects"
```

---

## Task 6: End-to-end behaviour

**Files:**
- Create: `e2e/cookie-consent.spec.ts`

This suite runs against `next dev` at `http://localhost:3000`, where **Clarity is gated off**. So it tests the banner's own behaviour and persistence. The cookie assertions cannot run here — see Task 7 for those.

- [ ] **Step 1: Write the failing test**

Create `e2e/cookie-consent.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const REGION = { name: 'Zgoda na cookies' };

test.describe('Cookie consent', () => {
  test('asks once, then remembers the answer across a reload', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('region', REGION);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: 'Akceptuję' }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('a rejection also sticks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Odrzucam' }).click();
    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('the footer link brings the choice back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Akceptuję' }).click();
    await expect(page.getByRole('region', REGION)).toBeHidden();

    await page.getByRole('button', { name: 'Cookies' }).click();
    await expect(page.getByRole('region', REGION)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test e2e/cookie-consent.spec.ts --project=chromium`
Expected: FAIL before Tasks 3–4 are merged; PASS after. If you are running tasks in order it should pass here — in that case confirm it fails by temporarily renaming the `aria-label`, then put it back.

- [ ] **Step 3: Prove the banner is absent from the prerendered HTML**

This is the assertion that catches the hydration-gate regression. Without the
`isHydrated` gate the banner renders during the prerender and ships in every
static page — which is invisible in the dev-server tests above, because the dev
server hydrates immediately.

Append to `e2e-export/analytics.spec.ts` (this suite serves the real `out/`
directory, the same shape GitHub Pages does):

```ts
test.describe('Static export: consent banner', () => {
  test.use({ javaScriptEnabled: false });

  test('the banner is not in the prerendered HTML', async ({ page }) => {
    // With JavaScript off nothing hydrates, so what is asserted here is
    // literally the bytes on disk. A banner visible in this state would have
    // shipped in all 1000+ prerendered pages and flashed at every visitor who
    // already answered.
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Zgoda na cookies' })).toHaveCount(0);
  });
});
```

Run: `pnpm test:e2e:export`
Expected: PASS, including the pre-existing analytics gating tests.

- [ ] **Step 4: Commit**

```bash
git add e2e/cookie-consent.spec.ts e2e-export/analytics.spec.ts
git commit -m "test(e2e): pin the consent banner's ask-once behaviour"
```

---

## Task 7: Verify the real cookie behaviour by hand

Automated tests cannot cover this: Clarity is gated off in both Playwright suites, and pointing a test at the live site would write junk into the dashboard.

Two claims need confirming against a real build. The second is taken from Microsoft's documentation rather than observed, so it is the one that matters.

- [ ] **Step 1: Build with the tag switched on and serve it**

```bash
NEXT_PUBLIC_CLARITY_PROJECT_ID=xtfje919ui NEXT_PUBLIC_BASE_PATH='' pnpm build
npx --yes serve -l 4173 out
```

- [ ] **Step 2: Confirm accept sets the cookies**

Open `http://localhost:4173/`, accept the banner, wait a few seconds, then in the console:

```js
document.cookie.split('; ').map((c) => c.split('=')[0]).filter((n) => n.startsWith('_cl'));
```

Expected: `["_clck", "_clsk"]`.

Cross-check the signal Clarity thinks it received:

```js
clarity('metadata', (d, upgrade, consent) => console.log(consent), false, true, true);
```

Expected: `{ analytics_storage: "GRANTED", ad_storage: "DENIED" }`.

- [ ] **Step 3: Confirm withdrawal removes them**

Click "Cookies" in the footer, choose "Odrzucam", wait a few seconds, then re-run the cookie read from Step 2.

Expected: `[]` — Clarity deletes its cookies, ends the session and restarts in no-consent mode.

**If the cookies are still there,** the documented behaviour did not happen and the spec's Withdrawal section is wrong. Do not paper over it by deleting the cookies manually — stop, report what you observed, and revisit the design.

- [ ] **Step 4: Record the result**

Append what you observed to the spec's Withdrawal section, replacing "must still verify" with the measurement.

```bash
git add docs/superpowers/specs/2026-07-28-cookie-consent-banner-design.md
git commit -m "docs(specs): record the measured consent withdrawal behaviour"
```

---

## Task 8: Ship it

- [ ] **Step 1: Full check**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: all pass, only the pre-existing font warning.

- [ ] **Step 2: Export suite still green**

Run: `pnpm test:e2e:export`
Expected: PASS, including the existing `analytics.spec.ts` that guards the build-time tag gate.

- [ ] **Step 3: Merge and push**

The repo's branch protection asks for pull requests. Confirm with the owner whether to open a PR or push to `main` directly — the two previous pushes reported `Bypassed rule violations`.

---

## Self-review notes

Spec coverage checked section by section: architecture (Tasks 1–4), Clarity bridge with consentv2 (Task 3), flow including reopen (Tasks 2–4), hydration via `getServerSnapshot` (Task 2), withdrawal (Task 7), testing (Tasks 1, 3, 6, 7), accessibility (`role="region"` in Task 3, asserted in Tasks 3 and 6), privacy page (Task 5).

Naming is consistent across tasks: `CONSENT_STORAGE_KEY`, `parseConsent`, `ConsentChoice`, `useConsent`, `resetConsentStoreForTests`, `signalClarity`.

One known gap, deliberate: the a11y sweep. The repo runs `jest-axe` and `@axe-core/playwright`, and the banner is fixed-position over the page, which is exactly the shape that trips contrast and landmark rules. If the existing axe run flags it, fix the banner rather than excluding it from the sweep.
