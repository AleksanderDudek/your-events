import { EventFilters } from '@/types/filter.types';
import { CityId } from '@/config/cities';

// Query keys are scoped by cityId so switching cities invalidates caches
// automatically and per-city data never bleeds across tenants.
export const eventsKeys = {
  list: (cityId: CityId | string, filters: EventFilters) =>
    ['events', cityId, 'list', filters] as const,
  categories: () => ['categories'] as const,
};
