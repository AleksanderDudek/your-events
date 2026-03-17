'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from './eventsApi';
import { eventsKeys } from './queryKeys';

export function useEvent(id: string) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: eventsKeys.detail(id),
    queryFn: () => fetchEvent(id),
    staleTime: 60_000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    event: data ?? null,
    isLoading,
    isError,
    error,
    refetch,
  };
}
