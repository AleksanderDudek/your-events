import { EventFilters } from '@/types/filter.types';

export const eventsKeys = {
  all: ['events'] as const,
  list: (filters: EventFilters) => ['events', 'list', filters] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
  categories: ['categories'] as const,
  sources: ['sources'] as const,
};
