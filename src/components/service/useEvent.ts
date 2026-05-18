'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { useCity } from '@/config/CityProvider';

export function useEvent(id: string) {
  const { city } = useCity();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: eventsKeys.detail(city.id, id),
    queryFn: () => fetchEvent(city.id, id),
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
