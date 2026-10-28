'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOfferedSeasons } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { useCity } from '@/config/CityProvider';
import { toLocalDateString } from '@/lib/dateWindows';
import { OfferedSeason } from '@/types/season.types';

const NO_SEASONS: OfferedSeason[] = [];

/**
 * The seasonal sections on offer in the current city today (see
 * fetchOfferedSeasons). Usually empty: outside a season nothing renders.
 *
 * A failed read yields the empty list rather than an error. A seasonal section
 * is a bonus on top of the page, and a missing table or a flaky request must
 * never be what breaks the home page or the list.
 */
export function useSeasons(): { seasons: OfferedSeason[]; isLoading: boolean } {
  const { city } = useCity();
  // The day is part of the key, so a tab left open past midnight asks again —
  // a season can end, or its last events pass, overnight.
  const today = toLocalDateString(new Date());
  const { data, isLoading } = useQuery({
    queryKey: eventsKeys.seasons(city.id, today),
    queryFn: () => fetchOfferedSeasons(city.id, new Date()),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  return { seasons: data ?? NO_SEASONS, isLoading };
}
