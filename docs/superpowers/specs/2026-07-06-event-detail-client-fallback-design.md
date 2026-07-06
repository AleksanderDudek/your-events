# Klientowy fallback dla niezbudowanych wydarzeń

- **Data:** 2026-07-06
- **Branch:** `feat/event-detail-client-fallback` (odgałęziony od `main`)
- **Status:** zaakceptowany design, przed planem implementacji

## Problem

Aplikacja to statyczny eksport Next.js (`output: 'export'`) hostowany na GitHub
Pages. Trasa `/events/[id]` ma `dynamicParams = false` i `generateStaticParams()`,
więc build generuje dokładnie jedną stronę na każde `id` istniejące w bazie **w
momencie buildu**. Każdy event dodany do Supabase po ostatnim buildzie (scrape
kilka razy dziennie) nie ma pliku w `out/` — wejście na jego URL zwraca natywne
404 z GitHub Pages, zanim jakikolwiek kod Next się uruchomi.

Lista wydarzeń (`/events`) jest renderowana klientowo i odpytuje Supabase na
żywo, więc świeże eventy **są widoczne na liście**, ale klik/link do ich detalu
kończy się 404. To jest zgłoszony objaw.

## Cel

Użytkownik **nigdy nie widzi twardego 404** dla realnie istniejącego wydarzenia.
Gdy strona statyczna nie istnieje, klient dociąga event z Supabase i renderuje
ten sam widok detalu. Zostajemy na darmowym GitHub Pages — bez migracji hostingu.

## Kluczowe ograniczenie techniczne

W `output: 'export'` (Next 16) **nie można** ustawić `dynamicParams = true` dla
prerenderowanej trasy dynamicznej — build się wywala, bo nie ma serwera do
generowania stron na żądanie. Dlatego fallback **nie może** żyć na `/events/[id]`.
Punktem przechwycenia jest globalny `src/app/not-found.tsx`, który w eksporcie
kompiluje się do `out/404.html` — a GitHub Pages serwuje ten plik dla **każdej**
nieistniejącej ścieżki w obrębie site'u.

## Decyzje (ustalone w brainstormie)

1. **Rescue w miejscu, czysty URL.** 404.html wykrywa wzorzec `/events/{id}`,
   dociąga event klientowo i renderuje `EventDetailView` **bez zmiany adresu**
   (`history` nietknięty). Po najbliższym buildzie ta sama ścieżka staje się w
   pełni statyczna — link „awansuje" bezszwowo. (Odrzucony wariant: redirect na
   `/events/view?id=...` — zmieniałby URL i uwięziłby udostępnione linki na
   trasie fallback.)
2. **Miasto = aktualne z `CityProvider`** (przez istniejący `useEvent`). Dziś
   tylko Szczecin jest `available`, więc dla świeżego gościa to zawsze Szczecin —
   100% dzisiejszego ruchu działa poprawnie, zero dodatkowych zapytań. Cross-city
   search po ID świadomie odłożony (YAGNI, dopóki multi-city nie ruszy).
3. **Rozróżnienie błędów.** `NotFoundError` (usunięty event / złe ID) →
   „Nie znaleziono wydarzenia" + link do listy. `ServerError`/sieć → „Nie udało
   się pobrać" + „Spróbuj ponownie" (`refetch`). Rozróżnienie jest darmowe:
   `fetchEvent` już rzuca `NotFoundError` (PGRST116) vs `ServerError`.

## Architektura

### Mechanizm

`out/404.html` (z globalnego `not-found.tsx`) to jedyny kod uruchamiany przez GH
Pages dla niezbudowanej ścieżki. Query string **nie jest** częścią statycznej
ścieżki, `pathname` **jest** — więc odczytujemy `window.location.pathname`,
dopasowujemy `/events/{id}` i renderujemy widok w miejscu.

Globalny `not-found.tsx` renderuje się wewnątrz root `layout.tsx`, który
opakowuje `children` w `<Providers>` (`QueryClientProvider` + `CityProvider` +
`ThemeProvider` + `LocaleProvider`). Czyli 404.html ma pełen komplet providerów —
`useEvent`, `useCity` i motyw MUI działają w fallbacku.

### Pliki

**Nowe:**

- `src/lib/eventPath.ts` — czysta funkcja `matchEventDetailPath(pathname: string): string | null`.
  Zdejmuje `basePath` (z `NEXT_PUBLIC_BASE_PATH` przez `@/config/env`, spójnie z
  `site.ts` — **nie** z zahardkodowanego `BASE_PATH` w `constants.ts`) i dopasowuje
  `^/events/(\d+)/?$`. Tylko liczbowe ID, pojedynczy segment → brak zbędnych
  zapytań do Supabase dla śmieciowych ścieżek. Zwraca `id` lub `null`.
- `src/components/views/EventDetailFallback/EventDetailFallback.tsx` — sedno.
  Props: `{ id: string }`. Woła `useEvent(id)`, renderuje trzy stany (niżej).
- `src/components/common/EventNotFoundContent/EventNotFoundContent.tsx` —
  wyekstrahowany UI „Nie znaleziono wydarzenia" (dziś zaszyty w
  `events/[id]/not-found.tsx`). Współdzielony przez fallback i route-level
  not-found → jeden widok, zero duplikacji.

**Modyfikowane:**

- `src/app/not-found.tsx` — staje się `'use client'`. Po zamontowaniu (flaga
  `mounted` ustawiana w `useEffect`, żeby uniknąć niezgodności hydratacji)
  czyta `pathname`; jeśli `matchEventDetailPath` zwróci `id` →
  `<EventDetailFallback id={id} />`, w przeciwnym razie → dotychczasowa
  generyczna treść „404 / Nie znaleziono strony". Do czasu rozwiązania `pathname`
  → neutralny stan ładowania (spójny render server↔client, bez migotania „404"
  dla ścieżek eventowych).
- `src/app/events/[id]/not-found.tsx` — renderuje współdzielony
  `<EventNotFoundContent />` zamiast własnej kopii JSX.

### Trzy stany `EventDetailFallback`

`useEvent(id)` już istnieje (city-aware, `retry: 2` z wykładniczym backoffem):

- **Ładowanie** → skeleton z `events/[id]/loading.tsx` + podpis „Pobieram dane
  wydarzenia…". Na sukcesie ustawiamy `document.title` na nazwę eventu (ładny
  tytuł karty dla udostępnionego linku — 404.html nie ma per-event `<title>`).
- **Sukces** → **ten sam** `<EventDetailView event={event} />`. Widok się **nie
  rozgałęzia** — dostaje gotowy `Event` niezależnie od źródła (prerender vs
  klient). JSON-LD pomijamy w fallbacku (bezcelowy przy statusie 404).
- **Błąd** → `error instanceof NotFoundError` → `<EventNotFoundContent />`;
  w przeciwnym razie → „Nie udało się pobrać wydarzenia" + przycisk „Spróbuj
  ponownie" (`refetch()`).

Nowe napisy trafiają do katalogu i18n (`pl` + `en`) zgodnie z istniejącym
`useTranslation` — nie hardkodujemy stringów w komponentach.

## Zakres i granice

- Rescue **tylko** dla `/events/{liczba}`. Każda inna nieistniejąca ścieżka →
  dotychczasowe generyczne 404.
- **Dwie drogi wejścia na świeży event:**
  - (a) bezpośredni link / odświeżenie / współdzielony link → GH Pages 404.html →
    rescue. **To jest zgłoszony objaw i główny cel** — w pełni pokryte.
  - (b) miękka nawigacja klientowa z listy (`<Link>`) → zachowanie routera Next w
    trybie export do zweryfikowania realnym `next build && serve`. Jeśli Next
    renderuje wtedy route-level not-found zamiast twardej nawigacji, ten sam
    `EventDetailFallback` wpinamy też w `events/[id]/not-found.tsx` (dlatego jest
    osobnym komponentem — dołożenie jest darmowe). Kontyngencja, nie domysł z góry.

## Czego NIE zmieniamy (świadome ograniczenia)

- **Status HTTP zostaje 404** dla niezbudowanych eventów — GH Pages serwuje
  404.html z kodem 404. Użytkownik widzi pełną treść; crawler widzi 404 do
  najbliższego buildu, który awansuje URL do statycznego. Zaakceptowany kompromis
  SEO (fallback rozwiązuje UX, nie indeksację świeżych eventów).
- Fallback to **siatka bezpieczeństwa, nie zamiennik buildów** — cron i
  `repository_dispatch` zostają bez zmian.
- Pojedyncze miasto (aktualne z `CityProvider`); cross-city search odłożony.
- Nie ruszamy rozbieżności `constants.ts` (`BASE_PATH` zahardkodowany na
  `/your-events`) vs env-driven config — poza zakresem. Nowy `eventPath.ts`
  celowo używa env-driven źródła, żeby był poprawny po migracji na własną domenę.

## Testy

- **Unit** (`src/lib/eventPath.spec.ts`, vitest skonfigurowany): zdejmowanie
  basePath, tylko-liczby, odrzucenie zagnieżdżonych ścieżek, trailing slash,
  ścieżki nie-eventowe → `null`.
- **Komponent** (`EventDetailFallback.spec.tsx`): trzy stany przy zamockowanym
  `useEvent` (loading / success → `EventDetailView` / `NotFoundError` →
  `EventNotFoundContent` / `ServerError` → retry).
- **Manualna weryfikacja** (krok z pkt. „drogi wejścia (b)"): `next build` →
  serwowanie `out/` lokalnie → wejście na nieistniejące `/events/{id}` →
  obserwacja: loading → sukces; oraz na złe/usunięte ID → komunikat błędu.

## Plan integracji

Osobny feature branch `feat/event-detail-client-fallback` od `main`. Bez
mergowania — do review użytkownika.
