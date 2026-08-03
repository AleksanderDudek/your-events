class AppError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Nie znaleziono') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ServerError extends AppError {
  constructor(message = 'Błąd serwera') {
    super(message, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

// Dates follow the UI language, not the language of the data. The events are
// Polish, but the reader may not be, and "poniedziałek, 3 sierpnia 2026" under
// an English interface is the same broken promise as an untranslated title.
//
// en-GB rather than en-US: it keeps day before month, so the line stays the
// shape the Polish one has and nothing in the layout shifts under it.
const DATE_LOCALES: Record<string, string> = {
  pl: 'pl-PL',
  en: 'en-GB',
};

// An unknown locale must not reach Intl, which throws a RangeError on a malformed
// tag — a filter panel is not the place to discover that.
function intlLocale(locale: string): string {
  return DATE_LOCALES[locale] ?? DATE_LOCALES.pl;
}

// Every formatter defaults to Polish rather than to the active locale: they are
// called from server components and from plain functions with no context, and
// defaulting to the source language keeps an un-migrated call site correct
// instead of silently English.

export function formatDate(dateStr: string, locale: string = 'pl'): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(intlLocale(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string, locale: string = 'pl'): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * A timestamp reduced to a plain calendar date. Deliberately not "3 hours ago":
 * relative time needs a ticking clock and a library, and the only thing this
 * answers is "how stale is this record".
 */
export function formatDateMedium(iso: string | null, locale: string = 'pl'): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate().toString();
}

export function formatMonth(dateStr: string, locale: string = 'pl'): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(intlLocale(locale), { month: 'short' }).toUpperCase();
}

// Renders an event's time. Prefers explicit end_time, falls back to a
// synthesized end derived from duration_min, otherwise just shows the start.
export function formatEventTime(
  startTime: string,
  endTime: string,
  durationMin: number | null
): string {
  if (!startTime) return '';
  if (endTime) return `${startTime}–${endTime}`;
  if (durationMin && durationMin > 0) {
    const synthesized = addMinutes(startTime, durationMin);
    if (synthesized) return `${startTime}–${synthesized}`;
  }
  return startTime;
}

function addMinutes(hhmm: string, minutes: number): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const total = Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10) + minutes;
  if (Number.isNaN(total)) return null;
  // Wrap past midnight just in case (some studios list 23:30 + 60 min classes).
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Resolves a category display name to its --cat-<slug> CSS variable (brief §2),
// with a fallback color for categories outside the curated 13.
export function categoryColorVar(displayName: string, fallback = '#8a8494'): string {
  return `var(--cat-${slugify(displayName || 'inne')}, ${fallback})`;
}

// The solid, non-flipping variant (selected chips, color-box last resort).
export function categoryColorSolidVar(displayName: string, fallback = '#8a8494'): string {
  return `var(--cat-${slugify(displayName || 'inne')}-solid, ${fallback})`;
}

// Darker text-only variant for chip LABELS so they meet WCAG AA on the light
// tint (brief §7); icons and other uses keep the base --cat-* hue.
export function categoryColorInkVar(displayName: string, fallback = '#5f5968'): string {
  return `var(--cat-${slugify(displayName || 'inne')}-ink, ${fallback})`;
}

// Deterministic pick of one of the 10 category-art placeholders (1..10) from a
// stable seed (event id/key) so the same event always shows the same art.
//
// The art is 800×450 WebP — cut to the image band's 16:9 so it fills the slot
// instead of being cropped to a strip. It used to be 1080×1080 PNG, 83 MB for
// the set; the same 130 frames are now 904 KB, and every byte of that shipped
// on every deploy for the handful of events whose source gives us no image.
export function categoryFallbackImage(displayName: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const variant = (hash % 10) + 1;
  return `/fallbacks/${slugify(displayName || 'inne')}-${variant}.webp`;
}
