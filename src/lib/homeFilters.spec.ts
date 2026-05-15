import { describe, it, expect } from 'vitest';
import {
  buildArtUrl,
  buildDanceUrl,
  buildFoodUrl,
  buildNowUrl,
  buildSportNowUrl,
  buildTodayUrl,
  buildWeekendUrl,
  getUpcomingWeekend,
} from './homeFilters';

function paramsFrom(url: string): URLSearchParams {
  const [, qs = ''] = url.split('?');
  return new URLSearchParams(qs);
}

describe('homeFilters', () => {
  describe('buildNowUrl', () => {
    it('today, half-hour-floored start, +4h end', () => {
      // Tue 2026-03-10, 14:35 local
      const now = new Date(2026, 2, 10, 14, 35);
      const p = paramsFrom(buildNowUrl(now));
      expect(p.get('dateMode')).toBe('single');
      expect(p.get('dateSingle')).toBe('2026-03-10');
      expect(p.get('hourFrom')).toBe('14:30');
      expect(p.get('hourTo')).toBe('18:30');
    });

    it('floors to the hour when minutes < 30', () => {
      const now = new Date(2026, 5, 1, 9, 12);
      const p = paramsFrom(buildNowUrl(now));
      expect(p.get('hourFrom')).toBe('09:00');
      expect(p.get('hourTo')).toBe('13:00');
    });
  });

  describe('buildWeekendUrl', () => {
    it('Tue → upcoming Fri–Sun, 12:00–23:00', () => {
      // Tue 2026-03-10
      const now = new Date(2026, 2, 10, 10, 0);
      const p = paramsFrom(buildWeekendUrl(now));
      expect(p.get('dateMode')).toBe('range');
      expect(p.get('dateFrom')).toBe('2026-03-13'); // Fri
      expect(p.get('dateTo')).toBe('2026-03-15');   // Sun
      expect(p.get('hourFrom')).toBe('12:00');
      expect(p.get('hourTo')).toBe('23:00');
    });

    it('Saturday → weekend starts today, ends Sunday', () => {
      const sat = new Date(2026, 2, 14, 9, 0);
      const { fromDate, toDate } = getUpcomingWeekend(sat);
      expect(fromDate).toBe('2026-03-14');
      expect(toDate).toBe('2026-03-15');
    });

    it('Sunday → weekend is just today', () => {
      const sun = new Date(2026, 2, 15, 9, 0);
      const { fromDate, toDate } = getUpcomingWeekend(sun);
      expect(fromDate).toBe('2026-03-15');
      expect(toDate).toBe('2026-03-15');
    });

    it('Friday → today through Sunday', () => {
      const fri = new Date(2026, 2, 13, 9, 0);
      const { fromDate, toDate } = getUpcomingWeekend(fri);
      expect(fromDate).toBe('2026-03-13');
      expect(toDate).toBe('2026-03-15');
    });
  });

  describe('buildTodayUrl', () => {
    it('today, hourFrom floored, no hourTo (capped by date)', () => {
      const now = new Date(2026, 2, 10, 14, 45);
      const p = paramsFrom(buildTodayUrl(now));
      expect(p.get('dateMode')).toBe('single');
      expect(p.get('dateSingle')).toBe('2026-03-10');
      expect(p.get('hourFrom')).toBe('14:30');
      expect(p.get('hourTo')).toBeNull();
      expect(p.get('categories')).toBeNull();
    });
  });

  describe('buildSportNowUrl', () => {
    it('today, sport category, hourFrom only', () => {
      const now = new Date(2026, 2, 10, 14, 45);
      const p = paramsFrom(buildSportNowUrl(now));
      expect(p.get('categories')).toBe('sport-i-fitness');
      expect(p.get('dateMode')).toBe('single');
      expect(p.get('dateSingle')).toBe('2026-03-10');
      expect(p.get('hourFrom')).toBe('14:30');
      expect(p.get('hourTo')).toBeNull();
    });
  });

  describe('interest-based CTAs', () => {
    const now = new Date(2026, 2, 10, 14, 45);

    it('buildArtUrl filters to visual arts + theatre from today onward', () => {
      const p = paramsFrom(buildArtUrl(now));
      expect(p.get('categories')).toBe('sztuka-i-wystawy,teatr-i-widowiska');
      expect(p.get('dateMode')).toBe('range');
      expect(p.get('dateFrom')).toBe('2026-03-10');
      expect(p.get('dateTo')).toBeNull();
      expect(p.get('hourFrom')).toBeNull();
    });

    it('buildFoodUrl filters to culinary workshops from today onward', () => {
      const p = paramsFrom(buildFoodUrl(now));
      expect(p.get('categories')).toBe('warsztaty/warsztaty-kulinarne');
      expect(p.get('dateMode')).toBe('range');
      expect(p.get('dateFrom')).toBe('2026-03-10');
    });

    it('buildDanceUrl filters to dance from today onward', () => {
      const p = paramsFrom(buildDanceUrl(now));
      expect(p.get('categories')).toBe('taniec');
      expect(p.get('dateMode')).toBe('range');
      expect(p.get('dateFrom')).toBe('2026-03-10');
    });
  });
});
