import type { Event } from '@/types/event.types';

export const CATEGORY_FALLBACK_SLUG = 'inne';
const MAX_NAME_SLUG_LEN = 60;

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};

/** URL-safe slug from an event name: fold Polish diacritics, hyphenate, cap length. */
export function nameSlug(name: string): string {
  const folded = (name ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_SLUG_LEN)
    .replace(/-+$/g, '');
  return slug || 'wydarzenie';
}

/** Stable 8-hex-char id derived from the immutable event_key (FNV-1a 32-bit). */
export function shortId(eventKey: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < eventKey.length; i++) {
    hash ^= eventKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface CategoryLike {
  slug: string;
  parent_slug: string | null;
  display_name: string;
}

/** Map top-level category display_name -> slug (events store display_name text). */
export function buildCategorySlugMap(categories: readonly CategoryLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    if (c.parent_slug === null) map.set(c.display_name, c.slug);
  }
  return map;
}

/** Category slug for an event's category_main; unknown/blank -> fallback ("inne"). */
export function resolveCategorySlug(categoryMain: string, slugMap: Map<string, string>): string {
  return slugMap.get(categoryMain) ?? CATEGORY_FALLBACK_SLUG;
}

/** Canonical event permalink: /{city}/{category}/{name}-{shortid}. */
export function eventPath(citySlug: string, event: Event, slugMap: Map<string, string>): string {
  const category = resolveCategorySlug(event.categoryMain, slugMap);
  return eventPathIn(citySlug, category, event);
}

/**
 * The same permalink, for callers that already know the category segment.
 *
 * The category hub is exactly that case: it selects events whose category
 * resolves to the route's own segment, so every card on it shares one. Building
 * the path from that, rather than from a slug map, is what lets a server-
 * rendered page emit correct hrefs — `eventPath` needs a map that only exists
 * on the client once useCategories has resolved, and falls back to "inne"
 * before then.
 */
export function eventPathIn(citySlug: string, categorySlug: string, event: Event): string {
  return `/${citySlug}/${categorySlug}/${nameSlug(event.name)}-${shortId(event.eventKey)}`;
}
