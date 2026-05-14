export type SourceType =
  | 'dance_studio'
  | 'fitness_club'
  | 'culinary_studio'
  | 'cultural_event'
  | 'facebook_event'
  | 'sports_club'
  | 'other';

export type EventStatus = 'active' | 'cancelled' | 'sold_out' | 'few_spots';

export type AgeGroup = 'adults' | 'kids' | 'seniors' | 'all';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'open';

export type RecurrenceRule = 'weekly' | 'biweekly' | 'monthly';

export interface EventLocation {
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

export interface EventPrice {
  amount: number | null;
  currency: string;
  description: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  categoryMain: string;
  categorySub: string;
  tags: string[];
  date: string;
  startTime: string;
  endTime: string;
  location: EventLocation;
  price: EventPrice;
  ageGroup: AgeGroup | null;
  level: SkillLevel | null;
  instructor: string | null;
  capacity: number | null;
  url: string;
  sourceName: string;
  sourceType: SourceType;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  imageUrl: string | null;
  status: EventStatus;
}

export interface CategoryItem {
  id: string;
  label: string;
}

export interface DbCategory {
  slug: string;
  parent_slug: string | null;
  display_name: string;
  display_plural: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface SourceItem {
  id: SourceType;
  label: string;
}
