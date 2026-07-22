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
    hourFrom: filters.hourFrom,
    hourTo: filters.hourTo,
    freeOnly: filters.freeOnly,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// Query keys are scoped by cityId so switching cities invalidates caches
// automatically and per-city data never bleeds across tenants.
export const eventsKeys = {
  list: (cityId: CityId | string, filters: EventFilters) =>
    ['events', cityId, 'list', queryShape(filters)] as const,
  categories: () => ['categories'] as const,
};
