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

export type EventCategory =
  | 'dance'
  | 'dance-hip-hop'
  | 'dance-bachata'
  | 'dance-salsa'
  | 'dance-kizomba'
  | 'dance-reggaeton'
  | 'dance-contemporary'
  | 'dance-ballet'
  | 'dance-sensual'
  | 'fitness'
  | 'fitness-yoga'
  | 'fitness-pilates'
  | 'fitness-zumba'
  | 'fitness-cross'
  | 'fitness-tabata'
  | 'fitness-cycling'
  | 'fitness-stretching'
  | 'fitness-abs'
  | 'fitness-shape'
  | 'fitness-fat-burner'
  | 'martial-arts'
  | 'martial-arts-mma'
  | 'martial-arts-boxing'
  | 'martial-arts-kickboxing'
  | 'culinary'
  | 'culinary-workshop'
  | 'culinary-tasting'
  | 'culinary-wine'
  | 'culinary-asian'
  | 'concert'
  | 'concert-jazz'
  | 'concert-rock'
  | 'concert-classical'
  | 'concert-hip-hop'
  | 'theatre'
  | 'standup'
  | 'exhibition'
  | 'workshop'
  | 'kids-event'
  | 'sports-event'
  | 'social-event';

export interface EventLocation {
  name: string;
  address: string;
  city: string;
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
  categories: EventCategory[];
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
  id: EventCategory;
  label: string;
}

export interface SourceItem {
  id: SourceType;
  label: string;
}
