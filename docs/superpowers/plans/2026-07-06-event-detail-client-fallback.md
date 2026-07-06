# Klientowy fallback dla niezbudowanych wydarzeń — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gdy statyczna strona `/events/{id}` nie istnieje (event dodany po ostatnim buildzie), klient dociąga event z Supabase i renderuje ten sam widok detalu — użytkownik nigdy nie widzi twardego 404.

**Architecture:** W `output: 'export'` globalny `not-found.tsx` kompiluje się do `out/404.html`, które GitHub Pages serwuje dla każdej niezbudowanej ścieżki. Współdzielony klientowy `NotFoundRescue` (używany przez globalny **i** route-level not-found) czyta `window.location.pathname`; jeśli to `/events/{liczba}`, montuje `EventDetailFallback`, który przez istniejący hook `useEvent` pobiera event i renderuje `EventDetailView` — bez zmiany URL-a. Adres pozostaje kanoniczny i „awansuje" do statycznego po najbliższym buildzie.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, MUI 7, TanStack Query 5, Supabase JS, Vitest + Testing Library + jest-axe.

**Spec:** `docs/superpowers/specs/2026-07-06-event-detail-client-fallback-design.md`

**Uwaga o komendach testowych:** `pnpm test <ścieżka>` forwarduje argument do `vitest run <ścieżka>`, więc uruchamia tylko wskazany plik. `pnpm test` bez argumentu uruchamia cały pakiet.

---

## Struktura plików

**Nowe:**

| Plik | Odpowiedzialność |
|------|------------------|
| `src/lib/eventPath.ts` | Czysta funkcja `matchEventDetailPath(pathname)` — zdejmuje basePath, dopasowuje `/events/{liczba}`, zwraca `id` lub `null`. |
| `src/lib/eventPath.spec.ts` | Testy jednostkowe powyższej. |
| `src/components/common/EventDetailSkeleton/EventDetailSkeleton.tsx` | Wyekstrahowany skeleton detalu (dziś w `[id]/loading.tsx`), współdzielony przez route loading, fallback i rescue. |
| `src/components/common/EventNotFoundContent/EventNotFoundContent.tsx` | Panel „Nie znaleziono wydarzenia" (i18n + link do listy). |
| `src/components/common/EventNotFoundContent/EventNotFoundContent.spec.tsx` | Render test. |
| `src/components/common/GenericNotFoundContent/GenericNotFoundContent.tsx` | Panel generycznego 404 strony (wyjęty z `not-found.tsx`, z naprawionym basePath linku). |
| `src/components/common/GenericNotFoundContent/GenericNotFoundContent.spec.tsx` | Render test. |
| `src/components/views/EventDetailFallback/EventDetailFallback.tsx` | Sedno: `useEvent(id)` → loading / success / not-found / error. |
| `src/components/views/EventDetailFallback/EventDetailFallback.spec.tsx` | Test maszyny stanów (mock `useEvent`). |
| `src/components/views/NotFoundRescue/NotFoundRescue.tsx` | Klientowy router awaryjny: pathname → `EventDetailFallback` albo `fallback` prop. |
| `src/components/views/NotFoundRescue/NotFoundRescue.spec.tsx` | Test obu gałęzi (mock `eventPath` + `EventDetailFallback`). |

**Modyfikowane:**

| Plik | Zmiana |
|------|--------|
| `src/i18n/messages.ts` | +5 kluczy w tabeli `pl` i `en` (loading / not-found / error / back). |
| `src/app/events/[id]/loading.tsx` | Re-export `EventDetailSkeleton`. |
| `src/app/not-found.tsx` | `NotFoundRescue` z fallbackiem `GenericNotFoundContent`. |
| `src/app/events/[id]/not-found.tsx` | `NotFoundRescue` z fallbackiem `EventNotFoundContent`. |

**Kolejność:** util → i18n → skeleton → panele treści → fallback → rescue → podpięcie boundary → weryfikacja end-to-end. Każdy komponent istnieje, zanim zostanie zaimportowany.

---

## Task 1: `matchEventDetailPath` util

**Files:**
- Create: `src/lib/eventPath.ts`
- Test: `src/lib/eventPath.spec.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/eventPath.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchEventDetailPath } from './eventPath';

// In the test env NEXT_PUBLIC_BASE_PATH is unset, so env.ts applies its zod
// default of '/your-events' — the same base path as the GitHub Pages deploy.
describe('matchEventDetailPath', () => {
  it('extracts the numeric id from an event detail path', () => {
    expect(matchEventDetailPath('/your-events/events/77806')).toBe('77806');
  });

  it('tolerates a trailing slash', () => {
    expect(matchEventDetailPath('/your-events/events/77806/')).toBe('77806');
  });

  it('rejects non-numeric ids', () => {
    expect(matchEventDetailPath('/your-events/events/abc')).toBeNull();
  });

  it('rejects nested paths below the id', () => {
    expect(matchEventDetailPath('/your-events/events/77806/tickets')).toBeNull();
  });

  it('rejects the events list route (no id)', () => {
    expect(matchEventDetailPath('/your-events/events')).toBeNull();
  });

  it('rejects unrelated paths', () => {
    expect(matchEventDetailPath('/your-events/about')).toBeNull();
    expect(matchEventDetailPath('/your-events')).toBeNull();
  });

  it('does not treat a base-path lookalike as the base path', () => {
    // '/your-eventsX/...' must not have '/your-events' stripped as a prefix.
    expect(matchEventDetailPath('/your-eventsX/events/1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/eventPath.spec.ts`
Expected: FAIL — `Failed to resolve import "./eventPath"` / `matchEventDetailPath is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/eventPath.ts`:

```ts
import { env } from '@/config/env';

// The deploy base path (e.g. "/your-events" on GitHub Pages, "" on a custom
// domain). Read from the same env source as @/config/site so path matching
// stays correct after a domain migration — intentionally NOT the hardcoded
// BASE_PATH in @/lib/constants.
const basePath = env.NEXT_PUBLIC_BASE_PATH.replace(/\/+$/, '');

const EVENT_DETAIL_RE = /^\/events\/(\d+)\/?$/;

function stripBasePath(pathname: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}

// Given a full location pathname (which includes the deploy base path), return
// the numeric event id if it points at an event detail route, else null. Used
// by the 404.html client fallback to decide whether to rescue an unbuilt
// /events/{id} page. Numeric-only + single segment so junk paths never trigger
// a Supabase round-trip.
export function matchEventDetailPath(pathname: string): string | null {
  const match = EVENT_DETAIL_RE.exec(stripBasePath(pathname));
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/eventPath.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventPath.ts src/lib/eventPath.spec.ts
git commit -m "$(cat <<'EOF'
feat: matchEventDetailPath util for the 404 fallback

Pure path matcher used by the client-side rescue: strips the deploy base
path (env-driven, so it survives a custom-domain move) and matches
/events/{numeric-id}. Numeric-only + single segment keeps junk paths from
triggering Supabase queries.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: i18n keys for the fallback

**Files:**
- Modify: `src/i18n/messages.ts` (tabela `pl` — po linii `DETAIL_DESCRIPTION: 'Opis',`; tabela `en` — po linii `DETAIL_DESCRIPTION: 'Description',`)

`pl` jest źródłem prawdy (jej kształt = typ `Messages`), a `en` ma `satisfies Messages`, więc dodanie kluczy tylko do jednej tabeli wywali `type-check`. To wbudowana asercja kompletności.

- [ ] **Step 1: Add the five keys to the `pl` table**

W `src/i18n/messages.ts`, bezpośrednio po linii `  DETAIL_DESCRIPTION: 'Opis',` wstaw:

```ts
  // Client-side fallback for event pages not yet statically built.
  EVENT_LOADING: 'Pobieram dane wydarzenia…',
  EVENT_NOT_FOUND_TITLE: 'Nie znaleziono wydarzenia',
  EVENT_NOT_FOUND_SUBTITLE: 'Wydarzenie mogło zostać usunięte lub link jest nieprawidłowy.',
  EVENT_LOAD_ERROR_SUBTITLE: 'Nie udało się pobrać wydarzenia',
  BACK_TO_EVENTS: 'Wróć do wydarzeń',
```

- [ ] **Step 2: Add the same five keys to the `en` table**

W `src/i18n/messages.ts`, bezpośrednio po linii `  DETAIL_DESCRIPTION: 'Description',` wstaw:

```ts
  // Client-side fallback for event pages not yet statically built.
  EVENT_LOADING: 'Loading event details…',
  EVENT_NOT_FOUND_TITLE: 'Event not found',
  EVENT_NOT_FOUND_SUBTITLE: 'The event may have been removed or the link is invalid.',
  EVENT_LOAD_ERROR_SUBTITLE: 'Could not load the event',
  BACK_TO_EVENTS: 'Back to events',
```

- [ ] **Step 3: Verify type-check passes (keys present in both locales)**

Run: `pnpm type-check`
Expected: PASS, no errors. (Jeśli `en` pominięte — błąd `Property 'EVENT_LOADING' is missing ... satisfies Messages`.)

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "$(cat <<'EOF'
feat(i18n): strings for the event detail fallback

Loading caption, event-not-found title/subtitle, load-error subtitle and a
back-to-events label, in pl + en.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract `EventDetailSkeleton`

Skeleton jest teraz współdzielony (route loading + fallback loading + rescue placeholder). Wyciągamy go do `common/`, a `loading.tsx` re-eksportuje — zero zmiany zachowania route'a, zero importów z katalogu `[id]/`.

**Files:**
- Create: `src/components/common/EventDetailSkeleton/EventDetailSkeleton.tsx`
- Modify: `src/app/events/[id]/loading.tsx`

- [ ] **Step 1: Create the shared skeleton (moved verbatim from loading.tsx)**

`src/components/common/EventDetailSkeleton/EventDetailSkeleton.tsx`:

```tsx
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

// Loading skeleton for the event detail layout. Shared by the route-level
// loading.tsx and the client fallback (EventDetailFallback / NotFoundRescue).
export default function EventDetailSkeleton() {
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      <Skeleton
        variant="rounded"
        width={80}
        height={36}
        sx={{ mb: 2, backgroundColor: 'var(--color-bg-elevated)' }}
      />
      <Skeleton
        variant="rounded"
        height={280}
        sx={{ mb: 3, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-elevated)' }}
      />
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={40} sx={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          <Skeleton variant="text" width="50%" height={24} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 1 }} />
          <Skeleton variant="text" width="60%" height={24} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 1 }} />
          <Skeleton variant="rectangular" height={120} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 3, borderRadius: 1 }} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 320 } }}>
          <Skeleton
            variant="rounded"
            height={300}
            sx={{ backgroundColor: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}
          />
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Replace loading.tsx with a re-export**

Zamień CAŁĄ zawartość `src/app/events/[id]/loading.tsx` na:

```tsx
// Route-level loading UI delegates to the shared skeleton (also used by the
// client fallback), so the loading look stays identical everywhere.
export { default } from '@/components/common/EventDetailSkeleton/EventDetailSkeleton';
```

- [ ] **Step 3: Verify type-check + lint pass**

Run: `pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/EventDetailSkeleton/EventDetailSkeleton.tsx "src/app/events/[id]/loading.tsx"
git commit -m "$(cat <<'EOF'
refactor: extract EventDetailSkeleton for reuse

Move the detail loading skeleton into common/ and re-export it from the
route loading.tsx. Lets the client fallback reuse the exact skeleton
without importing from the [id]/ route folder.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `EventNotFoundContent`

Panel „Nie znaleziono wydarzenia" wyjęty z `[id]/not-found.tsx`, na i18n, z linkiem przez `next/link` (auto-basePath — naprawia obecny `href="/events"`, który gubi `/your-events`).

**Files:**
- Create: `src/components/common/EventNotFoundContent/EventNotFoundContent.tsx`
- Test: `src/components/common/EventNotFoundContent/EventNotFoundContent.spec.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/common/EventNotFoundContent/EventNotFoundContent.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventNotFoundContent from './EventNotFoundContent';

describe('EventNotFoundContent', () => {
  it('shows the not-found message and a link back to events', () => {
    render(<EventNotFoundContent />);
    expect(screen.getByText('Nie znaleziono wydarzenia')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Wróć do wydarzeń' });
    // next/link applies the deploy base path automatically.
    expect(link).toHaveAttribute('href', '/your-events/events');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/common/EventNotFoundContent/EventNotFoundContent.spec.tsx`
Expected: FAIL — `Failed to resolve import "./EventNotFoundContent"`.

- [ ] **Step 3: Write the component**

`src/components/common/EventNotFoundContent/EventNotFoundContent.tsx`:

```tsx
'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import EventIcon from '@mui/icons-material/Event';
import { useTranslation } from '@/i18n';

// Shared "event not found" panel. Used by the route-level not-found boundary
// and by EventDetailFallback when a fetched id genuinely doesn't exist. Uses
// next/link so basePath is applied automatically (a raw <a href="/events">
// would drop the /your-events prefix).
export default function EventNotFoundContent() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <EventIcon sx={{ fontSize: 64, color: 'var(--color-text-muted)', mb: 2 }} />
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        {t.EVENT_NOT_FOUND_TITLE}
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 4 }}>
        {t.EVENT_NOT_FOUND_SUBTITLE}
      </Typography>
      <Button component={Link} href="/events" variant="contained" color="primary" sx={{ minHeight: 44 }}>
        {t.BACK_TO_EVENTS}
      </Button>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/common/EventNotFoundContent/EventNotFoundContent.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/EventNotFoundContent/
git commit -m "$(cat <<'EOF'
feat: shared EventNotFoundContent panel

i18n-driven "event not found" panel with a next/link back button (fixes the
dropped basePath from the old raw anchor). Reused by the route not-found and
the client fallback.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `GenericNotFoundContent`

Generyczny 404 strony wyjęty z `not-found.tsx`. Zachowujemy dotychczasowe (hardkodowane) napisy 404 — nie i18n-izujemy całej appki — ale naprawiamy link przez `next/link` i używamy nowego `BACK_TO_EVENTS`.

**Files:**
- Create: `src/components/common/GenericNotFoundContent/GenericNotFoundContent.tsx`
- Test: `src/components/common/GenericNotFoundContent/GenericNotFoundContent.spec.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/common/GenericNotFoundContent/GenericNotFoundContent.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GenericNotFoundContent from './GenericNotFoundContent';

describe('GenericNotFoundContent', () => {
  it('shows the 404 heading and a link back to events', () => {
    render(<GenericNotFoundContent />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Nie znaleziono strony')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Wróć do wydarzeń' });
    expect(link).toHaveAttribute('href', '/your-events/events');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/common/GenericNotFoundContent/GenericNotFoundContent.spec.tsx`
Expected: FAIL — unresolved import.

- [ ] **Step 3: Write the component**

`src/components/common/GenericNotFoundContent/GenericNotFoundContent.tsx`:

```tsx
'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useTranslation } from '@/i18n';

// Generic site 404. Shown by the global not-found boundary for any unbuilt
// path that is NOT an event detail route. Uses next/link so basePath is
// applied automatically.
export default function GenericNotFoundContent() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: { xs: '4rem', md: '6rem' },
          color: 'var(--color-accent-primary)',
          mb: 2,
        }}
      >
        404
      </Typography>
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        Nie znaleziono strony
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 4 }}>
        Strona, której szukasz, nie istnieje lub została przeniesiona.
      </Typography>
      <Button component={Link} href="/events" variant="contained" color="primary" sx={{ minHeight: 44 }}>
        {t.BACK_TO_EVENTS}
      </Button>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/common/GenericNotFoundContent/GenericNotFoundContent.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/GenericNotFoundContent/
git commit -m "$(cat <<'EOF'
feat: extract GenericNotFoundContent panel

Site 404 pulled out of not-found.tsx into a client component, with the back
button switched to next/link (fixes dropped basePath).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `EventDetailFallback` (core state machine)

**Files:**
- Create: `src/components/views/EventDetailFallback/EventDetailFallback.tsx`
- Test: `src/components/views/EventDetailFallback/EventDetailFallback.spec.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/views/EventDetailFallback/EventDetailFallback.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ServerError } from '@/lib/utils';

const { useEventMock } = vi.hoisted(() => ({ useEventMock: vi.fn() }));
vi.mock('@/components/service/useEvent', () => ({
  useEvent: (id: string) => useEventMock(id),
}));

// Stub the heavy detail view (pulls in Leaflet + next/navigation); we test the
// fallback's state machine, not the view itself.
vi.mock('@/components/views/EventDetailView/EventDetailView', () => ({
  default: ({ event }: { event: { name: string } }) => <div>view:{event.name}</div>,
}));

import EventDetailFallback from './EventDetailFallback';

const base = { event: null, isLoading: false, isError: false, error: null, refetch: vi.fn() };

describe('EventDetailFallback', () => {
  beforeEach(() => useEventMock.mockReset());

  it('shows the loading caption while fetching', () => {
    useEventMock.mockReturnValue({ ...base, isLoading: true });
    render(<EventDetailFallback id="123" />);
    expect(screen.getByText('Pobieram dane wydarzenia…')).toBeInTheDocument();
  });

  it('renders the event view on success', () => {
    useEventMock.mockReturnValue({ ...base, event: { name: 'Koncert', date: '2026-07-10' } });
    render(<EventDetailFallback id="123" />);
    expect(screen.getByText('view:Koncert')).toBeInTheDocument();
  });

  it('shows the not-found panel on NotFoundError', () => {
    useEventMock.mockReturnValue({ ...base, isError: true, error: new NotFoundError() });
    render(<EventDetailFallback id="123" />);
    expect(screen.getByText('Nie znaleziono wydarzenia')).toBeInTheDocument();
  });

  it('shows a retryable error on ServerError and calls refetch', async () => {
    const refetch = vi.fn();
    useEventMock.mockReturnValue({ ...base, isError: true, error: new ServerError(), refetch });
    render(<EventDetailFallback id="123" />);
    expect(screen.getByText('Nie udało się pobrać wydarzenia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/views/EventDetailFallback/EventDetailFallback.spec.tsx`
Expected: FAIL — `Failed to resolve import "./EventDetailFallback"`.

- [ ] **Step 3: Write the component**

`src/components/views/EventDetailFallback/EventDetailFallback.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useEvent } from '@/components/service/useEvent';
import { NotFoundError } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import EventDetailSkeleton from '@/components/common/EventDetailSkeleton/EventDetailSkeleton';
import EventNotFoundContent from '@/components/common/EventNotFoundContent/EventNotFoundContent';
import ErrorState from '@/components/ui/ErrorState/ErrorState';

interface EventDetailFallbackProps {
  id: string;
}

// Client-side rescue for event detail pages that were not statically built
// (added to Supabase after the last export). Rendered from 404.html (and the
// route-level not-found) when the path matches /events/{id}. Fetches the event
// live via useEvent — city-aware through CityProvider — and renders the same
// EventDetailView, keeping the original URL.
export default function EventDetailFallback({ id }: EventDetailFallbackProps) {
  const { t } = useTranslation();
  const { event, isLoading, isError, error, refetch } = useEvent(id);

  // 404.html ships no per-event <title>; set it once the event resolves so a
  // shared link shows a meaningful browser-tab title.
  useEffect(() => {
    if (event) document.title = `${event.name} — ${event.date}`;
  }, [event]);

  if (isLoading) {
    return (
      <Box>
        <EventDetailSkeleton />
        <Typography
          variant="body2"
          role="status"
          sx={{ textAlign: 'center', color: 'var(--color-text-secondary)', mt: 2 }}
        >
          {t.EVENT_LOADING}
        </Typography>
      </Box>
    );
  }

  if (isError || !event) {
    if (error instanceof NotFoundError) {
      return <EventNotFoundContent />;
    }
    return <ErrorState onRetry={() => refetch()} subtitle={t.EVENT_LOAD_ERROR_SUBTITLE} />;
  }

  return <EventDetailView event={event} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/views/EventDetailFallback/EventDetailFallback.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/views/EventDetailFallback/
git commit -m "$(cat <<'EOF'
feat: EventDetailFallback client rescue view

Fetches an event live via useEvent and renders the same EventDetailView.
States: loading (skeleton + caption), success, NotFoundError -> not-found
panel, other error -> retryable ErrorState. Sets document.title on success.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `NotFoundRescue` (shared boundary router)

**Files:**
- Create: `src/components/views/NotFoundRescue/NotFoundRescue.tsx`
- Test: `src/components/views/NotFoundRescue/NotFoundRescue.spec.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/views/NotFoundRescue/NotFoundRescue.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { matchMock } = vi.hoisted(() => ({ matchMock: vi.fn() }));
vi.mock('@/lib/eventPath', () => ({
  matchEventDetailPath: (p: string) => matchMock(p),
}));
vi.mock('@/components/views/EventDetailFallback/EventDetailFallback', () => ({
  default: ({ id }: { id: string }) => <div>fallback:{id}</div>,
}));

import NotFoundRescue from './NotFoundRescue';

describe('NotFoundRescue', () => {
  beforeEach(() => matchMock.mockReset());

  it('mounts the event fallback when the path is an event route', async () => {
    matchMock.mockReturnValue('555');
    render(<NotFoundRescue fallback={<div>generic</div>} />);
    expect(await screen.findByText('fallback:555')).toBeInTheDocument();
  });

  it('renders the provided fallback for non-event paths', async () => {
    matchMock.mockReturnValue(null);
    render(<NotFoundRescue fallback={<div>generic</div>} />);
    expect(await screen.findByText('generic')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/views/NotFoundRescue/NotFoundRescue.spec.tsx`
Expected: FAIL — `Failed to resolve import "./NotFoundRescue"`.

- [ ] **Step 3: Write the component**

`src/components/views/NotFoundRescue/NotFoundRescue.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { matchEventDetailPath } from '@/lib/eventPath';
import EventDetailFallback from '@/components/views/EventDetailFallback/EventDetailFallback';
import EventDetailSkeleton from '@/components/common/EventDetailSkeleton/EventDetailSkeleton';

interface NotFoundRescueProps {
  // Rendered when the current path is not an unbuilt event detail route.
  fallback: React.ReactNode;
}

// Client-side rescue shared by both not-found boundaries. In static export the
// global not-found compiles to 404.html (served by GitHub Pages for any unbuilt
// path — covers direct links / refresh); the route-level events/[id]/not-found
// covers soft client navigation from the live-fetched list. Both read the live
// pathname and, if it points at an unbuilt /events/{id}, fetch the event and
// render it in place — otherwise they show their own fallback (generic 404 vs.
// "event not found"). A neutral skeleton renders until the pathname is read on
// the client, so we never flash the fallback before rescuing an event route.
export default function NotFoundRescue({ fallback }: NotFoundRescueProps) {
  const [state, setState] = useState<{ resolved: boolean; eventId: string | null }>({
    resolved: false,
    eventId: null,
  });

  useEffect(() => {
    // Reading window.location on mount is intentional: the static 404.html has
    // no build-time knowledge of the requested URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ resolved: true, eventId: matchEventDetailPath(window.location.pathname) });
  }, []);

  if (!state.resolved) return <EventDetailSkeleton />;
  if (state.eventId) return <EventDetailFallback id={state.eventId} />;
  return <>{fallback}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/views/NotFoundRescue/NotFoundRescue.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/views/NotFoundRescue/
git commit -m "$(cat <<'EOF'
feat: NotFoundRescue shared boundary router

Reads window.location on mount; routes /events/{id} to EventDetailFallback,
everything else to the supplied fallback. Shared by the global 404.html and
the route-level event not-found so both hard links and soft nav are covered.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire both not-found boundaries

**Files:**
- Modify: `src/app/not-found.tsx`
- Modify: `src/app/events/[id]/not-found.tsx`

- [ ] **Step 1: Replace the global not-found**

Zamień CAŁĄ zawartość `src/app/not-found.tsx` na:

```tsx
import NotFoundRescue from '@/components/views/NotFoundRescue/NotFoundRescue';
import GenericNotFoundContent from '@/components/common/GenericNotFoundContent/GenericNotFoundContent';

// Compiles to out/404.html in static export. GitHub Pages serves it for any
// unbuilt path, so it doubles as the client-side rescue for event detail pages
// added after the last build. Non-event paths fall through to the site 404.
export default function NotFound() {
  return <NotFoundRescue fallback={<GenericNotFoundContent />} />;
}
```

- [ ] **Step 2: Replace the route-level event not-found**

Zamień CAŁĄ zawartość `src/app/events/[id]/not-found.tsx` na:

```tsx
import NotFoundRescue from '@/components/views/NotFoundRescue/NotFoundRescue';
import EventNotFoundContent from '@/components/common/EventNotFoundContent/EventNotFoundContent';

// Reached on soft client navigation to an unbuilt /events/{id} (the list is
// live-fetched, so fresh events are clickable before the next build). Rescues
// the event client-side; a genuinely missing id falls through to the shared
// "event not found" panel.
export default function EventNotFound() {
  return <NotFoundRescue fallback={<EventNotFoundContent />} />;
}
```

- [ ] **Step 3: Verify type-check, lint, and full unit suite pass**

Run: `pnpm type-check && pnpm lint && pnpm test`
Expected: PASS across the board (new specs included, existing suite green).

- [ ] **Step 4: Commit**

```bash
git add "src/app/not-found.tsx" "src/app/events/[id]/not-found.tsx"
git commit -m "$(cat <<'EOF'
feat: wire NotFoundRescue into both not-found boundaries

Global 404.html rescues direct links to unbuilt events; the route-level
event not-found rescues soft navigation from the list. Non-event and
missing-event cases keep their generic panels.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: End-to-end verification on a real static build

Unit testy nie odtworzą zachowania GitHub Pages (serwowanie `404.html` dla brakującej ścieżki). Ten krok weryfikuje realny build + obie drogi wejścia. **Wymaga** istniejącego eventu w Supabase, którego ID **nie** ma w buildzie — najprościej: zbuduj, potem w URL użyj pewnie-istniejącego-w-DB ID, którego nie było podczas builda (np. świeżo zescrape'owanego).

- [ ] **Step 1: Build the static export**

Run: `pnpm build`
Expected: build kończy się sukcesem; powstaje `out/404.html` oraz `out/events/{id}.html` dla zbudowanych eventów.

- [ ] **Step 2: Confirm 404.html exists (the file that mounts the rescue)**

Run: `test -f out/404.html && echo OK`
Expected: `OK`.

- [ ] **Step 3: Serve the export like a static host**

Run: `pnpm dlx serve out -l 3000`
Expected: serwer na `http://localhost:3000/your-events`. (`serve` zwraca `out/404.html` dla brakujących ścieżek — jak GitHub Pages.)

- [ ] **Step 4: Verify direct-link rescue (entry path a)**

W przeglądarce otwórz `http://localhost:3000/your-events/events/{niezbudowane-ID}` (bezpośrednie wejście / odświeżenie).
Expected: krótki skeleton + „Pobieram dane wydarzenia…", potem pełny `EventDetailView`. **URL pozostaje** `/your-events/events/{ID}`. Dla ID nieistniejącego w DB → panel „Nie znaleziono wydarzenia".

- [ ] **Step 5: Verify soft-navigation rescue (entry path b)**

Otwórz `http://localhost:3000/your-events/events`, poczekaj aż lista się załaduje (klientowo z Supabase), kliknij event, którego nie było w buildzie.
Expected: ta sama sekwencja rescue (skeleton → widok). Potwierdza, że route-level not-found też ratuje. (Jeśli tu wyskoczy twarde 404 zamiast rescue — patrz notatka niżej.)

- [ ] **Step 6: Verify a normal built event still prerenders**

Otwórz event, który **był** w buildzie.
Expected: natychmiastowy render statyczny (bez fazy „Pobieram dane…"), `EventDetailView`.

- [ ] **Step 7: Record the result**

Zaznacz wynik kroków 4–6 (PASS/FAIL) w komentarzu PR lub w tym pliku. Jeśli wszystko PASS → funkcja gotowa do review.

> **Notatka (kontyngencja dla kroku 5):** Jeśli miękka nawigacja daje twarde 404 zamiast rescue, to znaczy, że router Next w trybie export robi twardą nawigację do 404.html — co i tak jest pokryte przez globalny boundary (krok 4). W praktyce rescue zadziała; różnica dotyczy tylko tego, który boundary go obsłużył. Żadna dodatkowa praca nie jest wtedy potrzebna.

---

## Self-Review (wykonane przy pisaniu planu)

**Pokrycie specu:**
- Rescue w miejscu, czysty URL → Task 6–8 (`NotFoundRescue` nie dotyka `history`). ✅
- Punkt przechwycenia 404.html → Task 8 (globalny `not-found.tsx`) + Task 9 weryfikacja. ✅
- Aktualne miasto przez `useEvent` → Task 6 (bez zmian w `useEvent`). ✅
- Rozróżnienie błędów NotFound vs Server → Task 6 (`error instanceof NotFoundError`). ✅
- Reużycie `EventDetailView`/`loading`/i18n → Task 3, 6. ✅
- Zakres tylko `/events/{liczba}` → Task 1 (regex). ✅
- Obie drogi wejścia (a/b) → Task 8 (oba boundary) + Task 9 (weryfikacja obu). ✅
- Status HTTP 404 zostaje / build machinery bez zmian → nic w planie nie rusza `deploy.yml`, cron ani `dynamicParams`. ✅
- Testy: unit (eventPath), komponent (EventDetailFallback), manual build+serve → Task 1, 6, 9. ✅

**Placeholdery:** brak — każdy krok ma pełny kod/komendę i oczekiwany wynik.

**Spójność typów/nazw:** `matchEventDetailPath` (Task 1) użyte identycznie w Task 7 i teście. `useEvent` zwraca `{ event, isLoading, isError, error, refetch }` — zgodne z `useEvent.ts` i użyciem w Task 6. Klucze i18n z Task 2 użyte dokładnie w Task 4, 5, 6. `EventDetailSkeleton` (Task 3) importowane w Task 6 i 7. Brak rozjazdów.
