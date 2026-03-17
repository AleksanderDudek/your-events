'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from './eventsApi';
import { eventsKeys } from './queryKeys';

export function useCategories() {
  const { data, isLoading, isError } = useQuery({
    queryKey: eventsKeys.categories,
    queryFn: fetchCategories,
    staleTime: Infinity,
  });

  return {
    categories: data ?? [],
    isLoading,
    isError,
  };
}
