import { describe, expect, it } from 'vitest';
import { TOUR_STEPS, visibleSteps } from './tourSteps';

// A stand-in for `document`: only querySelector is used, and only to ask
// "does this anchor exist".
function rootWith(selectors: string[]) {
  return {
    querySelector: (selector: string) => (selectors.includes(selector) ? ({} as Element) : null),
  };
}

describe('TOUR_STEPS', () => {
  it('has a unique id per step', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('anchors every step by data-tour attribute', () => {
    for (const step of TOUR_STEPS) {
      expect(step.selector).toBe(`[data-tour="${step.id}"]`);
    }
  });
});

describe('visibleSteps', () => {
  it('keeps only the steps whose anchors are on the page', () => {
    const steps = visibleSteps(rootWith(['[data-tour="search"]', '[data-tour="sort"]']));
    expect(steps.map((s) => s.id)).toEqual(['search', 'sort']);
  });

  it('preserves the declared order', () => {
    const all = visibleSteps(rootWith(TOUR_STEPS.map((s) => s.selector)));
    expect(all.map((s) => s.id)).toEqual(TOUR_STEPS.map((s) => s.id));
  });

  // The mobile shape: the navigation lives in a closed drawer, so the presets
  // anchor is absent and its step has to drop itself rather than spotlight a
  // rectangle that isn't there.
  it('drops the desktop-only presets step when the nav is not mounted', () => {
    const mobile = visibleSteps(
      rootWith([
        '[data-tour="search"]',
        '[data-tour="filters"]',
        '[data-tour="view"]',
        '[data-tour="sort"]',
      ])
    );
    expect(mobile.map((s) => s.id)).not.toContain('presets');
    expect(mobile).toHaveLength(4);
  });

  it('returns nothing when the page carries no anchors at all', () => {
    expect(visibleSteps(rootWith([]))).toEqual([]);
  });
});
