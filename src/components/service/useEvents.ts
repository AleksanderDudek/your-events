'use client';

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { fetchEvents, fetchMapEvents, fetchMixedEvents, ResolvedCategoryFilter } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { parseFiltersFromParams } from '@/lib/filterUtils';
import { useCategories } from './useCategories';
import { useCity } from '@/config/CityProvider';
import { getMixSeed } from '@/lib/categoryMix';
import type { PageSize } from '@/types/filter.types';

/**
 * The filters in the URL, with category slugs resolved to the display names the
 * events table stores. Shared by the list and map queries so the two can never
 * disagree about what the user asked for.
 */
function useResolvedFilters() {
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const { bySlug, topLevel, isLoading: categoriesLoading, isError: categoriesError } = useCategories();
  const { city } = useCity();

  const categoryFilter = useMemo<ResolvedCategoryFilter>(() => {
    const topLevelMains: string[] = [];
    const subPairs: Array<{ main: string; sub: string }> = [];
    for (const slug of filters.categories) {
      const cat = bySlug.get(slug);
      if (!cat) continue;
      if (cat.parent_slug === null) {
        topLevelMains.push(cat.display_name);
      } else {
        const parent = bySlug.get(cat.parent_slug);
        if (parent) subPairs.push({ main: parent.display_name, sub: cat.display_name });
      }
    }
    return { topLevelMains, subPairs };
  }, [filters.categories, bySlug]);

  // A search is already a precise question; sampling three per category would
  // hide most of the answers, so it opts out of the mix even under sort=mix.
  const wantsMix = filters.sort === 'mix' && !filters.search;

  // The categories the sample is drawn from: every top-level category, unless
  // the user has filtered — top-level picks and the parents of any sub-category
  // picks — in which case the mix narrows to just those, so "mix" stays
  // meaningful under a filter instead of sampling categories the user excluded.
  const categoryMains = useMemo(() => {
    const chosen = new Set(categoryFilter.topLevelMains);
    for (const { main } of categoryFilter.subPairs) chosen.add(main);
    if (chosen.size > 0) return Array.from(chosen);
    return topLevel.map((c) => c.display_name);
  }, [categoryFilter, topLevel]);

  // The categories query must settle — success or failure — before the mix can
  // run: it supplies categoryMains, and starting early would sample zero
  // categories and look like an empty result rather than a loading one.
  const categoriesSettled = !categoriesLoading;
  // Nothing to sample by if the categories never loaded, so the mix falls back
  // to the ordinary (date-ordered) fetch rather than rendering an empty list.
  const canMix = wantsMix && categoriesSettled && !categoriesError && categoryMains.length > 0;

  // A category filter cannot be resolved before the category table has loaded,
  // and querying without it would briefly show unfiltered results. The mix
  // extends the same gate: it must wait on the same load before deciding
  // whether it can run at all.
  const ready = (filters.categories.length === 0 || bySlug.size > 0) && (!wantsMix || categoriesSettled);

  return { filters, categoryFilter, categoryMains, canMix, city, ready };
}

export function useEvents() {
  const { filters, categoryFilter, categoryMains, canMix, city, ready } = useResolvedFilters();
  // One seed per browser session (see categoryMix.ts) — memoized so re-renders
  // don't re-read sessionStorage on every call.
  const seed = useMemo(() => getMixSeed(), []);

  // The explicit generic matters: left to inference, `useQuery`'s overloads
  // collapse the ternary's two distinct result shapes and the `'poolTotal' in
  // data` narrowing below silently degrades to `unknown` instead of `number`.
  type EventsResult =
    | Awaited<ReturnType<typeof fetchEvents>>
    | Awaited<ReturnType<typeof fetchMixedEvents>>;

  const { data, isLoading, isError, isFetching, error, refetch } = useQuery<EventsResult>({
    queryKey: canMix ? eventsKeys.mix(city.id, filters, seed) : eventsKeys.list(city.id, filters),
    queryFn: () =>
      canMix
        ? fetchMixedEvents(city.id, filters, categoryFilter, categoryMains, seed)
        : fetchEvents(city.id, filters, categoryFilter),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: ready,
  });

  const total = data?.total ?? 0;

  return {
    events: data?.events ?? [],
    total,
    // Only the mixed path samples a pool larger than what it returns; every
    // other mode's pool is exactly what it returned, so poolTotal and total
    // agree there — the view can always report poolTotal without branching.
    poolTotal: data && 'poolTotal' in data ? data.poolTotal : total,
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
    filters,
  };
}

/**
 * Every mappable event matching the current filters, not just the page the list
 * happens to be showing.
 *
 * Only runs while the map is the active view: the response is far larger than a
 * page of results, and there is no reason to pay for it in grid or list view.
 *
 * Under `sort=mix` this must sample too, or the map would show all 748 pins
 * for a 36-event list while the list beside it shows only the sample — the two
 * views would flatly disagree about how many events there are. It reuses
 * `fetchMixedEvents` rather than a map-specific fetch: the map has no paging to
 * respect, so it asks for page 1 at the largest page size (60), comfortably
 * above MIX_PER_CATEGORY × any realistic category count, which returns the
 * whole sample intact instead of one page of it.
 */
export function useMapEvents(enabled: boolean) {
  const { filters, categoryFilter, categoryMains, canMix, city, ready } = useResolvedFilters();
  const seed = useMemo(() => getMixSeed(), []);
  const mixFilters = useMemo(() => ({ ...filters, page: 1, pageSize: 60 as PageSize }), [filters]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: canMix ? eventsKeys.mix(city.id, mixFilters, seed) : eventsKeys.map(city.id, filters),
    queryFn: () =>
      canMix
        ? fetchMixedEvents(city.id, mixFilters, categoryFilter, categoryMains, seed)
        : fetchMapEvents(city.id, filters, categoryFilter),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: enabled && ready,
  });

  return {
    events: data?.events ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    isFetching,
  };
}
