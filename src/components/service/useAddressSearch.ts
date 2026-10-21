'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCity } from '@/config/CityProvider';
import { useTranslation } from '@/i18n';
import { searchAddresses } from './geocoding';

/** Fewer characters than this match half a city — nothing is sent. */
export const ADDRESS_MIN_CHARS = 3;
// Long enough that a mid-word pause sends nothing, short enough to feel live.
const DEBOUNCE_MS = 400;

/**
 * Address suggestions for what is being typed, near the current city.
 *
 * Photon is a free service on fair use, so this is deliberately frugal:
 * nothing under three characters, nothing until typing pauses, a cached answer
 * for a repeated query, and a cancelled request for one already typed past
 * (React Query passes its AbortSignal through).
 */
export function useAddressSearch(input: string) {
  const { city } = useCity();
  const { locale } = useTranslation();
  const typed = input.trim();
  const [query, setQuery] = useState(typed);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const enabled = query.length >= ADDRESS_MIN_CHARS;
  const { data, isFetching, isError } = useQuery({
    queryKey: ['geocode', city.id, locale, query],
    queryFn: ({ signal }) => searchAddresses(query, city.coordinates, locale, signal),
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const tooShort = typed.length < ADDRESS_MIN_CHARS;
  return {
    suggestions: !tooShort && enabled ? (data ?? []) : [],
    // Also true while the debounce has not caught up with the typing, so the
    // dropdown says "searching" instead of flashing "no results".
    isSearching: !tooShort && (query !== typed || isFetching),
    isError: enabled && isError,
    tooShort,
  };
}
