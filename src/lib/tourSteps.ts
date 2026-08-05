import type { EventFilters, Weekday } from '@/types/filter.types';
import type { PresetFilters } from '@/types/preset.types';
import { DEFAULT_PAGE_SIZE } from './constants';

// The onboarding walkthrough, as a story the app actually performs.
//
// It does not describe the filters in the abstract — it builds one concrete,
// plausible filter set in front of the visitor ("dance or fitness classes,
// Mon/Tue/Thu, 16:00–21:00, because that is when work ends"), saves it, opens
// it from Moje filtry, then edits it when the story's job changes. Every step
// is a real state change, so what the visitor is left with at the end is a real
// saved filter of their own rather than a memory of a slideshow.
//
// This file stays pure: steps name a DOM anchor and declare WHAT should happen.
// Performing it — routing, filter writes, preset storage — belongs to the
// orchestrator, which has the hooks. That split is what lets the whole script be
// unit-tested without a DOM.

export type TourStepId =
  | 'categories'
  | 'weekdays'
  | 'hours'
  | 'results'
  | 'save'
  | 'presets'
  | 'open'
  | 'edit'
  | 'edited';

/** Which page a step belongs on. The action is what gets us there. */
export type TourSurface = 'events' | 'presets';

/**
 * What the app should do when a step becomes active. Declarative on purpose:
 * a step cannot reach for a router or localStorage, so the script is data and
 * the effects live in one place.
 */
export type TourAction =
  | { kind: 'none' }
  /** Write the story's filters onto the events list, in stages. */
  | { kind: 'filter'; stage: 'categories' | 'weekdays' | 'hours' }
  /** Save the on-screen filters as the story's preset. */
  | { kind: 'savePreset' }
  /** Go to Moje filtry. */
  | { kind: 'goToPresets' }
  /** Open the story's preset — back to the list with its filters applied. */
  | { kind: 'openPreset' }
  /** Move the saved preset's hour window later ("you changed jobs"). */
  | { kind: 'editPresetHours' };

export interface TourStep {
  id: TourStepId;
  /** Queried against the document once the action has had a chance to land. */
  selector: string;
  /** Preferred tooltip side; the Popper flips it when it would overflow. */
  placement: 'bottom' | 'top' | 'left' | 'right';
  surface: TourSurface;
  action: TourAction;
}

// ─── The story's numbers, in one place ──────────────────────────────────────

/** Dance and fitness — the two categories the story is interested in. */
export const STORY_CATEGORIES = ['taniec', 'sport-i-fitness'] as const;

/** Monday, Tuesday, Thursday (JS `Date#getDay()` numbering). */
export const STORY_WEEKDAYS: Weekday[] = [1, 2, 4];

/** After the office closes. */
export const STORY_HOUR_FROM = '16:00';
export const STORY_HOUR_TO = '21:00';

/** The new job's hours — the edit at the end of the story. */
export const STORY_HOUR_FROM_LATER = '18:00';

/** How far ahead the story looks. */
export const STORY_WINDOW_DAYS = 7;

const pad2 = (n: number) => String(n).padStart(2, '0');

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * The date window the story filters within.
 *
 * An hour range is only honoured alongside a date range (see
 * `presetToEventFilters`), so "16:00–21:00" on its own would silently do
 * nothing. The next seven days is the smallest window that makes the hours
 * mean something without pretending to be a date the visitor picked.
 */
export function storyDateRange(now: Date): { dateFrom: string; dateTo: string } {
  const end = new Date(now);
  end.setDate(end.getDate() + STORY_WINDOW_DAYS);
  return { dateFrom: toDateString(now), dateTo: toDateString(end) };
}

/**
 * The filter patch for one stage of the story.
 *
 * Applied in three visible steps rather than one, because the point is to show
 * a filter set being *built*: categories, then days, then hours.
 */
export function storyFilterPatch(
  stage: 'categories' | 'weekdays' | 'hours',
  now: Date,
  availableCategories: readonly string[]
): Partial<EventFilters> {
  switch (stage) {
    case 'categories':
      return { categories: storyCategories(availableCategories) };
    case 'weekdays':
      return { weekdays: [...STORY_WEEKDAYS] };
    case 'hours': {
      const { dateFrom, dateTo } = storyDateRange(now);
      return {
        dateMode: 'range',
        dateSingle: null,
        dateFrom,
        dateTo,
        hourFrom: STORY_HOUR_FROM,
        hourTo: STORY_HOUR_TO,
      };
    }
  }
}

/**
 * The story's categories, narrowed to the ones this city's taxonomy actually
 * has. The list is owned by the scrape pipeline, so pointing at a slug that
 * does not exist would produce an empty result set and a story that looks
 * broken.
 *
 * An empty `available` means "the taxonomy is not known yet" — the categories
 * query is still in flight, or it failed — NOT "this city has no categories".
 * Filtering against it would quietly reduce the story's first move to ticking
 * nothing, which is exactly the bug this comment exists to stop coming back:
 * the walkthrough ran, the URL never changed, and the visitor was told the list
 * had just narrowed. Falling back to the canonical slugs is the useful guess.
 */
export function storyCategories(available: readonly string[]): string[] {
  if (available.length === 0) return [...STORY_CATEGORIES];
  const known = STORY_CATEGORIES.filter((slug) => available.includes(slug));
  // A taxonomy that genuinely has neither is possible; ticking nothing beats
  // filtering on a slug this city cannot match.
  return known;
}

/**
 * What gets saved as the preset.
 *
 * Deliberately NOT `presetFiltersFromEventFilters(current)`: that would store
 * the absolute dates now on screen as a `fixed` window, and a preset called
 * "after work" pinned to this week rots into a link to the past. `next7` is the
 * relative window that keeps meaning the same thing next month — which is the
 * whole reason presets are not just a saved query string.
 */
export function storyPresetFilters(availableCategories: readonly string[]): PresetFilters {
  return {
    search: '',
    categories: storyCategories(availableCategories),
    dateWindow: 'next7',
    dateFrom: null,
    dateTo: null,
    weekdays: [...STORY_WEEKDAYS],
    hourFrom: STORY_HOUR_FROM,
    hourTo: STORY_HOUR_TO,
    freeOnly: false,
    viewMode: 'grid',
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

// ─── The script ─────────────────────────────────────────────────────────────

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'categories',
    selector: '[data-tour="filters"]',
    placement: 'right',
    surface: 'events',
    action: { kind: 'filter', stage: 'categories' },
  },
  {
    id: 'weekdays',
    selector: '[data-tour="filters"]',
    placement: 'right',
    surface: 'events',
    action: { kind: 'filter', stage: 'weekdays' },
  },
  {
    id: 'hours',
    selector: '[data-tour="filters"]',
    placement: 'right',
    surface: 'events',
    action: { kind: 'filter', stage: 'hours' },
  },
  {
    id: 'results',
    selector: '[data-tour="results"]',
    placement: 'bottom',
    surface: 'events',
    action: { kind: 'none' },
  },
  {
    id: 'save',
    selector: '[data-tour="save"]',
    placement: 'bottom',
    surface: 'events',
    action: { kind: 'savePreset' },
  },
  {
    id: 'presets',
    selector: '[data-tour="preset-tile"]',
    placement: 'bottom',
    surface: 'presets',
    action: { kind: 'goToPresets' },
  },
  {
    id: 'open',
    selector: '[data-tour="results"]',
    placement: 'bottom',
    surface: 'events',
    action: { kind: 'openPreset' },
  },
  {
    id: 'edit',
    selector: '[data-tour="preset-edit"]',
    placement: 'left',
    surface: 'presets',
    action: { kind: 'editPresetHours' },
  },
  {
    id: 'edited',
    selector: '[data-tour="results"]',
    placement: 'bottom',
    surface: 'events',
    action: { kind: 'openPreset' },
  },
];

/**
 * The steps that can run here.
 *
 * A step is kept when its anchor exists OR when its action is what puts the
 * anchor on screen (a navigation, or a control that only appears once filters
 * are active — the save button is exactly that). Only the inert steps have to
 * prove their anchor up front.
 *
 * On a phone this is also what quietly reshapes the story: nothing is dropped,
 * because every anchor the script uses exists in both layouts — the filter
 * panel is a Fab there rather than a sidebar, and the tooltip flips to fit.
 */
export function visibleSteps(root: Pick<Document, 'querySelector'>): TourStep[] {
  return TOUR_STEPS.filter(
    (step) => step.action.kind !== 'none' || root.querySelector(step.selector) !== null
  );
}
