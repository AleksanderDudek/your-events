import { AgeGroup, SkillLevel, SourceType } from '@/types/event.types';
import { PageSize } from '@/types/filter.types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE: PageSize = 15;
export const PAGE_SIZE_OPTIONS: PageSize[] = [15, 30, 60];
export const SEARCH_DEBOUNCE_MS = 1500;

export const CATEGORY_MAIN_VALUES = [
  'Taniec',
  'Sport i Fitness',
  'Muzyka',
  'Film',
  'Teatr i Widowiska',
  'Warsztaty',
  'Edukacja',
  'Wellness i Duchowość',
  'Inne',
] as const;

export type CategoryMain = (typeof CATEGORY_MAIN_VALUES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  dance_studio: 'Szkoła tańca',
  fitness_club: 'Klub fitness',
  culinary_studio: 'Studio kulinarne',
  cultural_event: 'Wydarzenie kulturalne',
  facebook_event: 'Facebook',
  sports_club: 'Klub sportowy',
  other: 'Inne',
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  all: 'Wszyscy',
  adults: 'Dorośli',
  kids: 'Dzieci',
  seniors: 'Seniorzy',
};

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Początkujący',
  intermediate: 'Średniozaawansowany',
  advanced: 'Zaawansowany',
  open: 'Otwarty',
};
