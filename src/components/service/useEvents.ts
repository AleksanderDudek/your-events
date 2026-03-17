'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { fetchEvents } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { parseFiltersFromParams } from '@/lib/filterUtils';

export function useEvents() {
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);

  const { data, isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: eventsKeys.list(filters),
    queryFn: () => fetchEvents(filters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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
