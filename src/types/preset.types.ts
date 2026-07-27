import { PageSize, ViewMode, Weekday } from './filter.types';

/**
 * When a preset's date filter should point, resolved at the moment the user
 * opens it rather than when they saved it.
 *
 * This is the whole reason presets are not just a stored query string. "Co się
 * dzieje w ten weekend" saved on a Tuesday must still mean *this* weekend in a
 * month's time; a preset holding `dateFrom=2026-07-31` would quietly rot into a
 * link to an empty past. `fixed` exists for the case where an absolute range is
 * genuinely what the user meant (a festival week, a holiday).
 */
export type PresetDateWindow = 'none' | 'today' | 'weekend' | 'next7' | 'fixed';

/** The parts of a filter set worth carrying between visits. */
export interface PresetFilters {
  search: string;
  categories: string[];
  dateWindow: PresetDateWindow;
  // Only meaningful when dateWindow is 'fixed'.
  dateFrom: string | null;
  dateTo: string | null;
  // Survives independently of dateWindow — "Mondays and Thursdays" is a lasting
  // habit, not a window that has to be re-resolved against today.
  weekdays: Weekday[];
  hourFrom: string | null;
  hourTo: string | null;
  freeOnly: boolean;
  viewMode: ViewMode;
  pageSize: PageSize;
}

/** A named filter set the user keeps in their own browser. */
export interface FilterPreset {
  id: string;
  name: string;
  // Presets are per city: the same filters mean different things in Wrocław and
  // Szczecin, and the city is a route segment rather than a query parameter.
  cityId: string;
  filters: PresetFilters;
  createdAt: string;
}
