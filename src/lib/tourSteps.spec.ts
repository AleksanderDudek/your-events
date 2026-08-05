import { describe, expect, it } from 'vitest';
import {
  STORY_HOUR_FROM,
  STORY_HOUR_TO,
  STORY_WEEKDAYS,
  STORY_WINDOW_DAYS,
  TOUR_STEPS,
  storyCategories,
  storyDateRange,
  storyFilterPatch,
  storyPresetFilters,
  visibleSteps,
} from './tourSteps';

const ALL_CATEGORIES = ['muzyka', 'taniec', 'sport-i-fitness', 'film'];

function rootWith(selectors: string[]) {
  return {
    querySelector: (selector: string) => (selectors.includes(selector) ? ({} as Element) : null),
  };
}

describe('TOUR_STEPS (the story script)', () => {
  it('has a unique id per step', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tells the story in order: build, look, save, revisit, edit, look again', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      'categories',
      'weekdays',
      'hours',
      'results',
      'save',
      'presets',
      'open',
      'edit',
      'edited',
    ]);
  });

  // A step whose action lands on another page must not claim to be anchored on
  // the page it starts from, or the overlay would spotlight the wrong thing.
  it('puts every step on the surface its action leads to', () => {
    const surfaceById = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, s.surface]));
    expect(surfaceById.presets).toBe('presets');
    expect(surfaceById.edit).toBe('presets');
    expect(surfaceById.open).toBe('events');
    expect(surfaceById.edited).toBe('events');
  });
});

describe('storyDateRange', () => {
  it('runs from today to a week out', () => {
    const { dateFrom, dateTo } = storyDateRange(new Date(2026, 7, 5));
    expect(dateFrom).toBe('2026-08-05');
    expect(dateTo).toBe('2026-08-12');
  });

  it('crosses a month boundary without arithmetic damage', () => {
    const { dateFrom, dateTo } = storyDateRange(new Date(2026, 7, 28));
    expect(dateFrom).toBe('2026-08-28');
    expect(dateTo).toBe('2026-09-04');
  });

  it('spans the documented window', () => {
    const { dateFrom, dateTo } = storyDateRange(new Date(2026, 0, 1));
    const days = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000;
    expect(days).toBe(STORY_WINDOW_DAYS);
  });
});

describe('storyCategories', () => {
  it('keeps the story categories this city actually has', () => {
    expect(storyCategories(ALL_CATEGORIES)).toEqual(['taniec', 'sport-i-fitness']);
  });

  // The taxonomy is owned by the scrape pipeline. Filtering on a slug that does
  // not exist would produce zero results and a story that looks broken.
  it('drops the ones it does not', () => {
    expect(storyCategories(['muzyka', 'taniec'])).toEqual(['taniec']);
  });

  // Regression: an empty list means "not loaded yet", and treating it as "this
  // city has none" made the story's first step tick nothing while the tooltip
  // announced that the list had narrowed.
  it('falls back to the canonical slugs when the taxonomy is not loaded yet', () => {
    expect(storyCategories([])).toEqual(['taniec', 'sport-i-fitness']);
  });
});

describe('storyFilterPatch', () => {
  const now = new Date(2026, 7, 5);

  it('ticks dance and fitness first', () => {
    expect(storyFilterPatch('categories', now, ALL_CATEGORIES)).toEqual({
      categories: ['taniec', 'sport-i-fitness'],
    });
  });

  it('then narrows to Monday, Tuesday and Thursday', () => {
    expect(storyFilterPatch('weekdays', now, ALL_CATEGORIES)).toEqual({
      weekdays: STORY_WEEKDAYS,
    });
    // JS getDay() numbering — Monday is 1, Thursday is 4.
    expect(STORY_WEEKDAYS).toEqual([1, 2, 4]);
  });

  // The list only honours an hour window alongside a date one, so setting the
  // hours without a range would silently do nothing.
  it('sets the hours together with the date range they need', () => {
    const patch = storyFilterPatch('hours', now, ALL_CATEGORIES);
    expect(patch).toMatchObject({
      dateMode: 'range',
      dateFrom: '2026-08-05',
      dateTo: '2026-08-12',
      hourFrom: STORY_HOUR_FROM,
      hourTo: STORY_HOUR_TO,
    });
    // A leftover single date would fight the range it just set.
    expect(patch.dateSingle).toBeNull();
  });
});

describe('storyPresetFilters', () => {
  it('saves a relative window, not the dates currently on screen', () => {
    const filters = storyPresetFilters(ALL_CATEGORIES);
    // 'fixed' with today's dates is what naively saving the on-screen filters
    // would produce — and a preset called "after work" pinned to this week rots
    // into a link to the past.
    expect(filters.dateWindow).toBe('next7');
    expect(filters.dateFrom).toBeNull();
    expect(filters.dateTo).toBeNull();
  });

  it('carries the categories, days and hours the story built', () => {
    expect(storyPresetFilters(ALL_CATEGORIES)).toMatchObject({
      categories: ['taniec', 'sport-i-fitness'],
      weekdays: STORY_WEEKDAYS,
      hourFrom: STORY_HOUR_FROM,
      hourTo: STORY_HOUR_TO,
    });
  });
});

describe('visibleSteps', () => {
  // A step whose action IS what puts its anchor on screen cannot be asked to
  // prove that anchor beforehand — the preset tile does not exist until the
  // preset is saved, and the save button not until filters are active.
  it('keeps action-bearing steps even when their anchor is absent', () => {
    const steps = visibleSteps(rootWith([]));
    expect(steps.map((s) => s.id)).toContain('save');
    expect(steps.map((s) => s.id)).toContain('presets');
  });

  it('drops an inert step whose anchor is missing', () => {
    const steps = visibleSteps(rootWith([]));
    expect(steps.map((s) => s.id)).not.toContain('results');
  });

  it('keeps the whole script when the page is fully rendered', () => {
    const all = visibleSteps(rootWith(TOUR_STEPS.map((s) => s.selector)));
    expect(all).toHaveLength(TOUR_STEPS.length);
  });
});
