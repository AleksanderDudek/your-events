import { DbCategory } from '@/types/event.types';

/**
 * Toggle one category slug in the filter selection, keeping the selection free
 * of parent/child overlap.
 *
 * A parent and one of its own children cannot usefully coexist: the query ORs
 * the top-level mains with the (main, sub) pairs, and a pair is always a subset
 * of its main — so "Sport i Fitness" + "Sporty drużynowe / Widowiska" resolved
 * to all of Sport, and ticking the subcategory looked like it did nothing at
 * all. Picking one side therefore releases the other: a child unticks its
 * parent, a parent unticks every child it owns.
 *
 * Siblings are left alone — two subcategories of one parent union into a wider
 * (but still narrowed) selection, which is what ticking both asks for.
 */
export function toggleCategorySelection(
  current: readonly string[],
  slug: string,
  bySlug: ReadonlyMap<string, DbCategory>
): string[] {
  if (current.includes(slug)) return current.filter((c) => c !== slug);

  // An unresolvable slug (taxonomy still loading, or a hand-edited URL) has no
  // known relatives, so it toggles on its own rather than being dropped.
  const released = new Set<string>();
  const cat = bySlug.get(slug);
  if (cat?.parent_slug) {
    released.add(cat.parent_slug);
  } else if (cat) {
    for (const other of bySlug.values()) {
      if (other.parent_slug === slug) released.add(other.slug);
    }
  }

  return [...current.filter((c) => !released.has(c)), slug];
}
