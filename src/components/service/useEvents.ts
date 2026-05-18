'use client';

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { fetchEvents, ResolvedCategoryFilter } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { parseFiltersFromParams } from '@/lib/filterUtils';
import { useCategories } from './useCategories';
import { useCity } from '@/config/CityProvider';

export function useEvents() {
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

  const categoriesReady = bySlug.size > 0;
  const queryEnabled = filters.categories.length === 0 || categoriesReady;

  const { data, isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: eventsKeys.list(city.id, filters),
    queryFn: () => fetchEvents(city.id, filters, categoryFilter),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: queryEnabled,
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
