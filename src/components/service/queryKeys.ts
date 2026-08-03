import { EventFilters } from '@/types/filter.types';
import { CityId } from '@/config/cities';

// Only the dimensions fetchEvents actually queries on. viewMode is deliberately
// excluded: grid/list/map render the very same rows, so keying on it would
// throw the cache away (and flash a loading pill) on every view switch.
function queryShape(filters: EventFilters) {
  return {
    search: filters.search,
    categories: filters.categories.join(','),
    dateSingle: filters.dateSingle,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    dateMode: filters.dateMode,
    weekdays: filters.weekdays.join(','),
    hourFrom: filters.hourFrom,
    hourTo: filters.hourTo,
    freeOnly: filters.freeOnly,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// Query keys are scoped by cityId so switching cities invalidates caches
// automatically and per-city data never bleeds across tenants.
// The map ignores paging entirely — it shows every matching event at once — so
// its key drops page/pageSize. Sharing the list key would make page 2 evict the
// map's full result set and vice versa.
function mapQueryShape(filters: EventFilters) {
  const { page, pageSize, ...rest } = queryShape(filters);
  void page;
  void pageSize;
  return rest;
}

export const eventsKeys = {
  list: (cityId: CityId | string, filters: EventFilters) =>
    ['events', cityId, 'list', queryShape(filters)] as const,
  map: (cityId: CityId | string, filters: EventFilters) =>
    ['events', cityId, 'map', mapQueryShape(filters)] as const,
  // The mix is a different fetch shape (one query per category, sampled) from
  // the ordinary list, so it needs its own cache entry rather than colliding
  // with `list`'s under the same filters. The seed is part of the key: a new
  // session-seed must not serve a shuffle taken under the previous one.
  mix: (cityId: CityId | string, filters: EventFilters, seed: number) =>
    ['events', cityId, 'mix', queryShape(filters), seed] as const,
  categories: () => ['categories'] as const,
};
