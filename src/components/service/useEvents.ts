'use client';

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { fetchEvents, fetchMapEvents, ResolvedCategoryFilter } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { parseFiltersFromParams } from '@/lib/filterUtils';
import { useCategories } from './useCategories';
import { useCity } from '@/config/CityProvider';

/**
 * The filters in the URL, with category slugs resolved to the display names the
 * events table stores. Shared by the list and map queries so the two can never
 * disagree about what the user asked for.
 */
function useResolvedFilters() {
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const { bySlug } = useCategories();
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

  // A category filter cannot be resolved before the category table has loaded,
  // and querying without it would briefly show unfiltered results.
  const ready = filters.categories.length === 0 || bySlug.size > 0;

  return { filters, categoryFilter, city, ready };
}

export function useEvents() {
  const { filters, categoryFilter, city, ready } = useResolvedFilters();

  const { data, isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: eventsKeys.list(city.id, filters),
    queryFn: () => fetchEvents(city.id, filters, categoryFilter),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: ready,
  });

  return {
    events: data?.events ?? [],
    total: data?.total ?? 0,
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
 */
export function useMapEvents(enabled: boolean) {
  const { filters, categoryFilter, city, ready } = useResolvedFilters();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: eventsKeys.map(city.id, filters),
    queryFn: () => fetchMapEvents(city.id, filters, categoryFilter),
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
