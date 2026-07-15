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

// Default-locale (Polish) UI strings, mirrored from src/i18n/messages.ts. The
// app renders Polish on first paint (DEFAULT_LOCALE = 'pl'); the stored
// preference is only applied after hydration.
export const TEXT = {
  searchPlaceholder: 'Szukaj wydarzeń...',
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
 * On mobile the FilterPanel lives behind a bottom-drawer Fab; on desktop it is
 * an always-visible sidebar. Open the drawer when present so the search box and
 * category checkboxes are reachable. No-op on desktop.
 */
export async function openFilters(page: Page): Promise<void> {
  const fab = page.getByRole('button', { name: FILTER_FAB });
  if (await fab.isVisible().catch(() => false)) {
    await fab.click();
    await expect(page.getByPlaceholder(TEXT.searchPlaceholder)).toBeVisible();
  }
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
