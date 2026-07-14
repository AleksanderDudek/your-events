import { EventFilters } from '@/types/filter.types';
import { CityId } from '@/config/cities';

// Query keys are scoped by cityId so switching cities invalidates caches
// automatically and per-city data never bleeds across tenants.
export const eventsKeys = {
  all: (cityId: CityId | string) => ['events', cityId] as const,
  list: (cityId: CityId | string, filters: EventFilters) =>
    ['events', cityId, 'list', filters] as const,
  detail: (cityId: CityId | string, id: string) =>
    ['events', cityId, 'detail', id] as const,
  categories: () => ['categories'] as const,
  sources: (cityId: CityId | string) => ['sources', cityId] as const,
};
