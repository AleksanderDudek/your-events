import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { EventFilters } from '@/types/filter.types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  getDefaultFilters,
} from '@/lib/filterUtils';
import { useCity } from '@/config/CityProvider';

// Filter state lives in the query string, and `navigate()` commits it
// ASYNCHRONOUSLY: anything that reads `window.location` right after a push still
// sees the pre-push URL. Two updates in the same tick therefore both build on
// the stale query string and the last one silently undoes the others — that is
// how ticking two categories quickly used to keep only one, and how clearing the
// date mode (four setters in one handler) became a no-op.
//
// `pending` is the synchronous source of truth for the window between a push and
// the URL catching up. It is module-level on purpose: FilterPanel and
// EventsListView both write filters and must share one intent, and the URL they
// race on is per-tab anyway.
const pending: {
  /** Query string of the newest push, or null when the URL is authoritative. */
  query: string | null;
  /** Queries we have pushed (plus the one we pushed from) but not yet observed. */
  inFlight: Set<string>;
  filters: EventFilters | null;
} = { query: null, inFlight: new Set(), filters: null };

function forgetPending(): void {
  pending.query = null;
  pending.filters = null;
  pending.inFlight.clear();
}

/**
 * Decide whether the buffered intent still applies, given the query string the
 * browser is actually showing.
 */
function reconcile(currentQuery: string): void {
  if (pending.query === null) return;
  if (currentQuery === pending.query) {
    forgetPending(); // the URL caught up — it is authoritative again
    return;
  }
  if (pending.inFlight.delete(currentQuery)) return; // an earlier push landing; newer intent still pending
  forgetPending(); // someone else moved us (back/forward, a Link, a city switch)
}

function liveQuery(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).toString();
}

/**
 * Single entry point for reading and writing the events-list filters. Every
 * mutation composes onto the newest intent (not the possibly-stale URL), so
 * consecutive updates within one tick accumulate instead of overwriting.
 */
export function useFilterNavigation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { city } = useCity();
  const query = searchParams.toString();

  const filters = useMemo(() => parseFiltersFromParams(new URLSearchParams(query)), [query]);

  useEffect(() => {
    reconcile(query);
  }, [query]);

  const readCurrentFilters = useCallback((): EventFilters => {
    // Reconcile eagerly as well as in the effect above: the effect only runs
    // after a render, and two clicks can land inside a single tick.
    const live = liveQuery(query);
    reconcile(live);
    return pending.filters ?? parseFiltersFromParams(new URLSearchParams(live));
  }, [query]);

  const applyFilters = useCallback(
    (next: EventFilters) => {
      const nextQuery = filtersToSearchParams(next).toString();
      pending.inFlight.add(liveQuery(query));
      pending.inFlight.add(nextQuery);
      pending.query = nextQuery;
      pending.filters = next;

      // A soft navigation to the list with the new query. (Under Next's static
      // export this had to be a hand-written pushState + popstate: its router
      // pinned the URL to the cold-loaded query string and replaced a same-route
      // push back over it. React Router navigates normally;
      // e2e-export/paging-and-view.spec.ts keeps that shape from coming back.)
      void navigate(`/${city.id}/wydarzenia/${nextQuery ? `?${nextQuery}` : ''}`);
    },
    [city.id, navigate, query]
  );

  /** Change a filter. Always returns to page 1 — the old page may not exist. */
  const updateFilters = useCallback(
    (updates: Partial<EventFilters>) => {
      applyFilters({ ...readCurrentFilters(), ...updates, page: 1 });
    },
    [applyFilters, readCurrentFilters]
  );

  /** Change paging/view only, leaving the current page alone. */
  const updatePagination = useCallback(
    (updates: Partial<EventFilters>) => {
      applyFilters({ ...readCurrentFilters(), ...updates });
    },
    [applyFilters, readCurrentFilters]
  );

  /**
   * Reset every filter (search, categories, date, hour, freeOnly, page) to its
   * default. viewMode and pageSize are display preferences, not filters, so the
   * user keeps whatever they picked.
   */
  const clearFilters = useCallback(() => {
    const current = readCurrentFilters();
    applyFilters({
      ...getDefaultFilters(),
      viewMode: current.viewMode,
      pageSize: current.pageSize,
    });
  }, [applyFilters, readCurrentFilters]);

  return { filters, readCurrentFilters, updateFilters, updatePagination, clearFilters };
}
