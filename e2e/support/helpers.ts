import { expect, type Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// These e2e tests run the real app against the real (multi-city) Supabase
// projects. Event data changes every day via the scrape pipeline, so NOTHING
// here asserts a specific event name, id, or count. Assertions are STRUCTURAL
// (a card exists, the URL reflects a filter, a heading is non-empty) and ids
// are discovered at runtime from the DOM. That keeps the suite a reliable
// regression signal instead of a daily false alarm.
//
// City: the app now serves multiple cities under /{city}/... routes. Wrocław
// is the launch city with real seeded data (~88 events), so it is the one
// exercised here — Szczecin remains the DEFAULT_CITY_ID but is only used where
// a test specifically needs "the other available city" (e.g. the switcher).
// ─────────────────────────────────────────────────────────────────────────────

export const CITY = 'wroclaw';

// The "other" available city. Only Wrocław (dedicated Supabase project) and
// Szczecin (DEFAULT_CITY_ID, shared project) are `available: true`, so the
// header city switcher lists exactly these two — Szczecin is the one we switch
// *to* when exercising an end-to-end city change.
export const CITY_OTHER = 'szczecin';

// Default-locale (Polish) UI strings, mirrored from src/i18n/messages.ts. The
// app renders Polish on first paint (DEFAULT_LOCALE = 'pl'); the stored
// preference is only applied after hydration.
export const TEXT = {
  searchPlaceholder: 'Szukaj wydarzenia lub miejsca...',
  resultsCount: /Znaleziono \d+ wydarzeń/,
  emptyTitle: 'Nie znaleziono wydarzeń',
  back: 'Wróć',
  externalLink: 'Przejdź do strony',
  browseAll: 'Przeglądaj wszystkie wydarzenia',
  heroPrompt: 'Chcesz zrobić coś fajnego?',
  cityLabel: 'Wybierz miasto',
  cityPickerTitle: 'Wybierz swoje miasto',
  langEn: 'Angielski',
  langLabel: 'Język',
  // View toggle aria-labels
  viewGrid: 'Widok siatki',
  viewList: 'Widok listy',
  viewMap: 'Widok mapy',
  // English strings we cross-check after switching locale
  resultsCountEn: /Found \d+ events/,
  // "Clear filters" — rendered in the FilterPanel header (desktop) and again in
  // the mobile drawer footer, so locate with .first().
  filterClear: /Wyczyść filtry/,
  // The freeOnly active-filter chip. freeOnly is a URL-only filter (no toggle
  // exists in the panel UI), so it is exercised via deep links.
  freeOnlyChip: 'Tylko bezpłatne',
  // The CTA anchor inside a map marker's Leaflet popup (raw HTML, outside React).
  mapPopupCta: 'Zobacz wydarzenie',
  // Home quick-filter tile titles (accessible names of the tile links).
  homeNowTitle: 'Co się dzieje teraz na mieście?',
  homeWeekendTitle: 'Co się dzieje w ten weekend?',
  // The other switchable city, as it appears in the switcher's option list.
  cityOther: /Szczecin/,
  // SEO: the events-list document <title> (a title template appends the brand).
  metaEventsTitle: /Wydarzenia w Wroc/,
  // "Rozwijaj z nami" — the city-agnostic community page.
  growNav: 'Rozwijaj z nami',
  growPunch: 'Otwierasz i wiesz.',
  growDiscordCta: 'Wejdź na serwer',
  growFormCta: 'Wypełnij ankietę',
  growHeadlineEn: 'Grow with us',
  // "Moje filtry" — user-owned filter presets kept in localStorage.
  presetsSaveCurrent: 'Zapisz filtry',
  presetsNew: /Nowy filtr/,
  presetsName: 'Nazwa',
  presetsSave: 'Zapisz',
  presetsWhen: 'Kiedy',
  presetsWeekend: 'Najbliższy weekend',
  presetsEmpty: 'Nie masz jeszcze własnych filtrów',
} as const;

// The mobile filter Fab is labelled "Filtry (N)"; the leading word is stable.
const FILTER_FAB = /^Filtry/;

/** A card is an <article> (role="article") wrapping a Link to the event permalink. */
export function firstCard(page: Page) {
  return page.locator('article').first();
}

/**
 * Navigate to the (Wrocław) events list and wait until real data has
 * rendered. Throws (fails the test) if no cards appear — that itself is a
 * useful signal that the list or its Supabase query is broken.
 */
export async function gotoEvents(page: Page): Promise<void> {
  await page.goto(`/${CITY}/wydarzenia`);
  await expect(firstCard(page)).toBeVisible({ timeout: 20000 });
}

/**
 * The events list always renders a result count ("Znaleziono N wydarzeń"),
 * even for zero results. Awaiting it is a data-independent signal that the
 * client tree has hydrated — use it after a cold `page.goto` before touching
 * filter controls, so interactions don't race the SSR→hydration flip.
 */
export async function waitForList(page: Page): Promise<void> {
  await expect(page.getByText(TEXT.resultsCount).first()).toBeVisible({ timeout: 20000 });
}

/**
 * On mobile the FilterPanel lives behind a bottom-drawer Fab; on desktop it is
 * an always-visible sidebar. Open the drawer on mobile so the search box and
 * category checkboxes are reachable. No-op on desktop.
 *
 * Decide by viewport width (md = 900px, matching the panel's own
 * `breakpoints.up('md')`) rather than the Fab's visibility: during SSR
 * `useMediaQuery` returns false, so a transient mobile Fab briefly renders on
 * desktop and then detaches at hydration — clicking it there races the detach.
 */
export async function openFilters(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 900) return; // desktop: sidebar is always visible, nothing to open
  // Idempotent: if the drawer is already open (its search box is showing), the
  // Fab is obscured behind the backdrop — clicking it would hang. Selecting a
  // category leaves the drawer open, so callers can legitimately re-open.
  const searchBox = page.getByPlaceholder(TEXT.searchPlaceholder);
  if (await searchBox.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: FILTER_FAB }).click();
  await expect(searchBox).toBeVisible();
}

/**
 * Close the mobile filter drawer (if any) so the results area is visible again.
 * Harmless on desktop where there is no drawer.
 */
export async function closeFilters(page: Page): Promise<void> {
  const backdrop = page.locator('.MuiDrawer-root .MuiBackdrop-root').first();
  if (await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(backdrop).toBeHidden();
  }
}

/**
 * Type a search term into the (viewport-aware) search box and wait for the
 * debounced (1500ms) navigation to write it into the URL.
 */
export async function search(page: Page, term: string): Promise<void> {
  await openFilters(page);
  await page.getByPlaceholder(TEXT.searchPlaceholder).fill(term);
  await page.waitForURL(/[?&]search=/, { timeout: 10000 });
}

/**
 * Tick the first (top-level) category checkbox and wait for its slug to land in
 * the URL. Returns the discovered slug so a follow-up assertion can deep-link to
 * it — we never hardcode a category, the taxonomy is owned by the data pipeline.
 * Uses .click() (not .check()): selecting a category triggers a navigation +
 * refetch that races .check()'s post-click "is it checked?" assertion.
 */
export async function applyFirstCategory(page: Page): Promise<string> {
  await openFilters(page);
  const firstCategory = page.getByRole('checkbox').first();
  await expect(firstCategory).toBeVisible({ timeout: 15000 });
  await firstCategory.click();
  await page.waitForURL(/categories=/, { timeout: 10000 });
  return new URL(page.url()).searchParams.get('categories') ?? '';
}

/**
 * Click the "clear filters" control. On mobile it renders twice (drawer header
 * + footer); .last() targets the FOOTER button, which both clears and closes
 * the drawer in one handler — avoiding a fragile Escape-to-dismiss afterwards.
 * On desktop there is a single (sidebar) clear button, so .last() === .first().
 * Only present when at least one filter is active.
 */
export async function clearAllFilters(page: Page): Promise<void> {
  await openFilters(page);
  await page.getByRole('button', { name: TEXT.filterClear }).last().click();
}

/** Locate an active-filter chip (in the results header) by its visible label. */
export function activeChip(page: Page, label: string | RegExp) {
  return page.locator('.MuiChip-root').filter({ hasText: label });
}
