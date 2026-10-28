export type DateMode = 'single' | 'range' | null;
export type PageSize = 15 | 30 | 60;
export type ViewMode = 'grid' | 'row' | 'map';
/** JS `Date#getDay()` numbering: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** How the list is ordered. `date` is the default: soonest first. `distance` needs a point to measure from. */
export type SortKey = 'date' | 'name' | 'venue' | 'price' | 'distance';
export type SortDir = 'asc' | 'desc';

/**
 * "Within `radius` metres of this point" — the point being wherever the visitor
 * said: their location, an address, or a pin dropped on a map.
 */
export interface NearFilter {
  lat: number;
  lng: number;
  /** Metres, MIN_RADIUS_M–MAX_RADIUS_M (lib/geo). */
  radius: number;
  /** What the point is called — an address. Null for a location fix or a map pick. */
  label: string | null;
}

export interface EventFilters {
  search: string;
  categories: string[];
  dateMode: DateMode;
  dateSingle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  // Recurring day-of-week narrowing ("only Mon/Wed/Fri"). Independent of
  // dateMode: it composes with a range, and works on its own.
  weekdays: Weekday[];
  hourFrom: string | null;
  hourTo: string | null;
  freeOnly: boolean;
  // Only events within a radius of a point. Composes with every other filter.
  near: NearFilter | null;
  // Only events tagged with this seasonal section's slug ("halloween"). Null
  // for none. Composes with every other filter.
  season: string | null;
  page: number;
  pageSize: PageSize;
  viewMode: ViewMode;
  sort: SortKey;
  dir: SortDir;
}
