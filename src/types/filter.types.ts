import { AgeGroup, SkillLevel, SourceType } from './event.types';

export type DateMode = 'single' | 'range' | null;
export type PageSize = 15 | 30 | 60;
export type ViewMode = 'grid' | 'row';

export interface EventFilters {
  search: string;
  categories: string[];
  sourceTypes: SourceType[];
  dateMode: DateMode;
  dateSingle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hourFrom: string | null;
  hourTo: string | null;
  ageGroup: AgeGroup | null;
  level: SkillLevel | null;
  freeOnly: boolean;
  hideUnavailable: boolean;
  page: number;
  pageSize: PageSize;
  viewMode: ViewMode;
}
