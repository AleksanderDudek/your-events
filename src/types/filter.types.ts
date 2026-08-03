export type DateMode = 'single' | 'range' | null;
export type PageSize = 15 | 30 | 60;
export type ViewMode = 'grid' | 'row' | 'map';
/** JS `Date#getDay()` numbering: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** How the list is ordered. `mix` is the default: a spread across categories. */
export type SortKey = 'mix' | 'date' | 'name' | 'venue' | 'price';
export type SortDir = 'asc' | 'desc';

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
  page: number;
  pageSize: PageSize;
  viewMode: ViewMode;
  sort: SortKey;
  dir: SortDir;
}
