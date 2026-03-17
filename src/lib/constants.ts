import { AgeGroup, EventCategory, SkillLevel, SourceType } from '@/types/event.types';
import { PageSize } from '@/types/filter.types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE: PageSize = 15;
export const PAGE_SIZE_OPTIONS: PageSize[] = [15, 30, 60];
export const SEARCH_DEBOUNCE_MS = 1500;

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  dance: 'Taniec',
  'dance-hip-hop': 'Hip Hop',
  'dance-bachata': 'Bachata',
  'dance-salsa': 'Salsa',
  'dance-kizomba': 'Kizomba',
  'dance-reggaeton': 'Reggaeton',
  'dance-contemporary': 'Taniec współczesny',
  'dance-ballet': 'Balet',
  'dance-sensual': 'Taniec zmysłowy',
  fitness: 'Fitness',
  'fitness-yoga': 'Joga',
  'fitness-pilates': 'Pilates',
  'fitness-zumba': 'Zumba',
  'fitness-cross': 'Crossfit',
  'fitness-tabata': 'Tabata',
  'fitness-cycling': 'Cycling',
  'fitness-stretching': 'Stretching',
  'fitness-abs': 'Brzuszki',
  'fitness-shape': 'Shape',
  'fitness-fat-burner': 'Fat Burner',
  'martial-arts': 'Sztuki walki',
  'martial-arts-mma': 'MMA',
  'martial-arts-boxing': 'Boks',
  'martial-arts-kickboxing': 'Kickboxing',
  culinary: 'Kulinarne',
  'culinary-workshop': 'Warsztaty kulinarne',
  'culinary-tasting': 'Degustacja',
  'culinary-wine': 'Wino',
  'culinary-asian': 'Kuchnia azjatycka',
  concert: 'Koncert',
  'concert-jazz': 'Jazz',
  'concert-rock': 'Rock',
  'concert-classical': 'Muzyka klasyczna',
  'concert-hip-hop': 'Hip Hop (koncert)',
  theatre: 'Teatr',
  standup: 'Stand-up',
  exhibition: 'Wystawa',
  workshop: 'Warsztaty',
  'kids-event': 'Dla dzieci',
  'sports-event': 'Sport',
  'social-event': 'Spotkanie',
};

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

export const CATEGORY_GROUPS: { label: string; categories: EventCategory[] }[] = [
  {
    label: 'Taniec',
    categories: [
      'dance',
      'dance-hip-hop',
      'dance-bachata',
      'dance-salsa',
      'dance-kizomba',
      'dance-reggaeton',
      'dance-contemporary',
      'dance-ballet',
      'dance-sensual',
    ],
  },
  {
    label: 'Fitness',
    categories: [
      'fitness',
      'fitness-yoga',
      'fitness-pilates',
      'fitness-zumba',
      'fitness-cross',
      'fitness-tabata',
      'fitness-cycling',
      'fitness-stretching',
      'fitness-abs',
      'fitness-shape',
      'fitness-fat-burner',
    ],
  },
  {
    label: 'Sztuki walki',
    categories: [
      'martial-arts',
      'martial-arts-mma',
      'martial-arts-boxing',
      'martial-arts-kickboxing',
    ],
  },
  {
    label: 'Kulinarne',
    categories: ['culinary', 'culinary-workshop', 'culinary-tasting', 'culinary-wine', 'culinary-asian'],
  },
  {
    label: 'Muzyka',
    categories: ['concert', 'concert-jazz', 'concert-rock', 'concert-classical', 'concert-hip-hop'],
  },
  {
    label: 'Inne',
    categories: ['theatre', 'standup', 'exhibition', 'workshop', 'kids-event', 'sports-event', 'social-event'],
  },
];
