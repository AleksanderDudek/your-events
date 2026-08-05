// Pure onboarding helpers. The browser-storage side lives in
// components/service/useOnboarding, mirroring the lib/consent split so the
// rules with teeth can be tested without a DOM.

export const ONBOARDING_STORAGE_KEY = 'go-to-city.onboarding';

// Bump this after a redesign to re-offer the welcome sheet to everyone. That is
// the whole reason the stored value is a version rather than a boolean.
//
// v2: the five-step feature tour became a story the app performs — it builds a
// real filter set, saves it, opens it and edits it. Anyone who saw v1 was shown
// something materially different, so they get the offer again.
export const ONBOARDING_VERSION = 2;

/**
 * The tour version this browser has already been shown, or null for "never".
 *
 * Anything that isn't a plain non-negative integer — absent, empty, junk, a
 * float, a version from the future — reads as null, which re-offers the sheet.
 * The cost of being wrong that way is one dismissible sheet; the cost of the
 * other direction is a feature silently switched off forever.
 */
export function parseSeenVersion(raw: string | null): number | null {
  if (raw === null) return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed > ONBOARDING_VERSION ? null : parsed;
}

export function hasSeenCurrent(raw: string | null): boolean {
  const seen = parseSeenVersion(raw);
  return seen !== null && seen >= ONBOARDING_VERSION;
}

// The events-list segment, as it appears in src/app/[city]/wydarzenia.
const EVENTS_SEGMENT = 'wydarzenia';

// usePathname hands back the route with the base path already stripped, but
// with the export's trailing slash still attached.
function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/**
 * Whether the welcome sheet may open here.
 *
 * City-scoped landing pages only: `/{city}/` and `/{city}/wydarzenia/`. The
 * city picker at `/` has nothing to explain, and an overlay on a category hub,
 * an event detail page or a utility page interrupts someone who arrived from a
 * search engine for one specific thing.
 *
 * The city check is a parameter rather than an import so this file stays free
 * of config — and so `/moje-filtry/`, which is also one segment long, does not
 * get mistaken for a city home.
 */
export function isOnboardingRoute(
  pathname: string,
  isCity: (segment: string) => boolean
): boolean {
  const parts = segments(pathname);
  if (parts.length === 0 || !isCity(parts[0])) return false;
  return parts.length === 1 || (parts.length === 2 && parts[1] === EVENTS_SEGMENT);
}

/**
 * Whether the spotlight tour can run here. Only the events list carries the
 * controls the tour points at; from the city home the sheet navigates there
 * first.
 */
export function isTourRoute(pathname: string, isCity: (segment: string) => boolean): boolean {
  const parts = segments(pathname);
  return parts.length === 2 && isCity(parts[0]) && parts[1] === EVENTS_SEGMENT;
}

/** The events list for a city, in the form the router expects. */
export function tourPath(cityId: string): string {
  return `/${cityId}/${EVENTS_SEGMENT}`;
}
