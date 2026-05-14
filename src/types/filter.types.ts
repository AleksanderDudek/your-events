export type DateMode = 'single' | 'range' | null;
export type PageSize = 15 | 30 | 60;
export type ViewMode = 'grid' | 'row';

export interface EventFilters {
  search: string;
  categories: string[];
  dateMode: DateMode;
  dateSingle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hourFrom: string | null;
  hourTo: string | null;
  freeOnly: boolean;
  page: number;
  pageSize: PageSize;
  viewMode: ViewMode;
}
