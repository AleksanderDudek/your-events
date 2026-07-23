import { describe, it, expect } from 'vitest';
import { warsawToUtc } from './warsawTime';

describe('warsawToUtc', () => {
  it('subtracts 2 hours in summer (CEST)', () => {
    expect(warsawToUtc('2026-07-24', '18:00').toISOString()).toBe('2026-07-24T16:00:00.000Z');
  });

  it('subtracts 1 hour in winter (CET)', () => {
    expect(warsawToUtc('2026-01-15', '18:00').toISOString()).toBe('2026-01-15T17:00:00.000Z');
  });

  // 2026-03-29: clocks jump 02:00 -> 03:00. Before the jump the offset is +1,
  // after it +2, on the same calendar day.
  it('uses the pre-jump offset on the spring DST morning', () => {
    expect(warsawToUtc('2026-03-29', '01:00').toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('uses the post-jump offset later on the spring DST day', () => {
    expect(warsawToUtc('2026-03-29', '04:00').toISOString()).toBe('2026-03-29T02:00:00.000Z');
  });

  // 2026-10-25: clocks fall back 03:00 -> 02:00.
  it('uses the post-fallback offset on the autumn DST day', () => {
    expect(warsawToUtc('2026-10-25', '04:00').toISOString()).toBe('2026-10-25T03:00:00.000Z');
  });

  it('still uses summer time the day before the autumn switch', () => {
    expect(warsawToUtc('2026-10-24', '04:00').toISOString()).toBe('2026-10-24T02:00:00.000Z');
  });

  it('handles late evening times without rolling the date', () => {
    expect(warsawToUtc('2026-07-24', '23:30').toISOString()).toBe('2026-07-24T21:30:00.000Z');
  });

  // 02:00-02:59 happens twice on the autumn switch day. The conversion always
  // resolves to the second, winter-time pass; pinned so a refactor of the
  // offset re-check cannot silently flip it.
  it('resolves the repeated autumn hour to the winter reading', () => {
    expect(warsawToUtc('2026-10-25', '02:30').toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  // 02:00-02:59 never happens on the spring switch day — the clock jumps over
  // it. A scraped time landing there shifts forward rather than failing.
  it('shifts a time inside the spring gap forward past the jump', () => {
    expect(warsawToUtc('2026-03-29', '02:30').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
});
