// Reflects the actual shape of an events-table row after `mapRow` in
// eventsApi.ts. Fields the scraper never populates (age group, skill level,
// instructor, capacity, recurrence, status, tags, sourceType) have
// been removed — re-add them when the data pipeline starts surfacing them.
// `imageUrl` is now populated (poster from multikino API / per-source logo
// fallback at ~100% coverage), so it lives in Event again.

export interface EventLocation {
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

export interface EventPrice {
  amount: number | null;     // PLN, or null when unknown / suspect
  currency: string;
  label: string;             // raw price_label from the scraper, used as fallback display
  showLabel: boolean;        // true when the label itself should be shown (e.g. "Karnet od 189 zł"
                             // for membership-only pricing, where a bare number would mislead)
}

export interface Event {
  id: string;
  eventKey: string;          // immutable natural key (event_key); source of the permalink id
  name: string;
  description: string;
  categoryMain: string;
  categorySub: string;
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM or '' when missing
  durationMin: number | null;
  location: EventLocation;
  price: EventPrice;
  url: string;               // '' when missing
  imageUrl: string;          // event poster / source logo; '' when missing
  sources: string[];         // 1+ scraper sources that listed this event
  updatedAt: string | null;  // ISO timestamp; freshness signal
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
