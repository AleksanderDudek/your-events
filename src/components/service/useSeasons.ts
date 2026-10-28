'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOfferedSeasons } from './eventsApi';
import { eventsKeys } from './queryKeys';
import { useCity } from '@/config/CityProvider';
import { toLocalDateString } from '@/lib/dateWindows';
import { seasonNameFromSlug } from '@/lib/seasons';
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

/**
 * A season's name for a slug: the table's own ("Święta") while it is on
 * offer, otherwise one made from the slug — a saved filter outlives its season.
 */
export function useSeasonName(): (slug: string) => string {
  const { seasons } = useSeasons();
  return useCallback(
    (slug: string) => seasons.find((season) => season.slug === slug)?.name ?? seasonNameFromSlug(slug),
    [seasons]
  );
}
