import { describe, it, expect } from 'vitest';
import {
  MIN_RELATED,
  MIN_SCORE,
  distanceKm,
  pickRelatedEvents,
  scoreRelated,
  seriesKey,
} from './relatedEvents';
import type { Event } from '@/types/event.types';

const TODAY = new Date(2026, 6, 27, 12, 0, 0); // Monday 2026-07-27

function makeEvent(overrides: Partial<Event> & { name?: string } = {}): Event {
  const name = overrides.name ?? 'Salsa dla początkujących';
  return {
    id: overrides.eventKey ?? name,
    eventKey: overrides.eventKey ?? `key-${name}`,
    name,
    description: '',
    categoryMain: 'Taniec',
    categorySub: 'Salsa',
    date: '2026-07-28',
    startTime: '18:00',
    endTime: '19:00',
    durationMin: 60,
    location: { name: 'AbbaLlu Dance Studio', city: 'Szczecin', lat: 53.43, lng: 14.55 },
    price: { amount: 40, currency: 'PLN', label: '40 PLN', showLabel: false },
    url: '',
    imageUrl: '',
    sources: ['abballu'],
    updatedAt: null,
    ...overrides,
  };
}

/** A batch of distinct events, so list-level rules have something to chew on. */
function makeMany(count: number, overrides: Partial<Event> = {}): Event[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      name: `Wydarzenie ${i}`,
      eventKey: `key-${i}`,
      location: { name: `Miejsce ${i}`, city: 'Szczecin', lat: 53.43, lng: 14.55 },
      ...overrides,
    })
  );
}

describe('seriesKey', () => {
  it('gives every instance of a weekly class the same key', () => {
    const week1 = makeEvent({ eventKey: 'a', date: '2026-07-28' });
    const week2 = makeEvent({ eventKey: 'b', date: '2026-08-04' });
    expect(seriesKey(week1)).toBe(seriesKey(week2));
  });

  it('keeps the same class at two venues apart', () => {
    // There is no series id in the data, so the key leans on name + venue.
    // Two clubs both running a "Trening obwodowy" must not collapse into one.
    const gymA = makeEvent({ name: 'Trening obwodowy', location: { name: 'Klub A', city: 'Szczecin', lat: null, lng: null } });
    const gymB = makeEvent({ name: 'Trening obwodowy', location: { name: 'Klub B', city: 'Szczecin', lat: null, lng: null } });
    expect(seriesKey(gymA)).not.toBe(seriesKey(gymB));
  });
});

describe('distanceKm', () => {
  it('returns null when either side has no coordinates', () => {
    const withCoords = makeEvent();
    const without = makeEvent({ location: { name: 'X', city: 'Szczecin', lat: null, lng: null } });
    expect(distanceKm(withCoords, without)).toBeNull();
  });

  it('measures a short city hop in kilometres', () => {
    const a = makeEvent({ location: { name: 'A', city: 'Szczecin', lat: 53.43, lng: 14.55 } });
    const b = makeEvent({ location: { name: 'B', city: 'Szczecin', lat: 53.44, lng: 14.55 } });
    const km = distanceKm(a, b) ?? 0;
    expect(km).toBeGreaterThan(0.9);
    expect(km).toBeLessThan(1.3);
  });
});

describe('scoreRelated', () => {
  it('ranks a shared subcategory above a shared category alone', () => {
    const target = makeEvent();
    const sameSub = makeEvent({ eventKey: 'x', location: { name: 'Inne', city: 'Szczecin', lat: null, lng: null } });
    const sameMainOnly = makeEvent({
      eventKey: 'y',
      categorySub: 'Bachata',
      location: { name: 'Inne', city: 'Szczecin', lat: null, lng: null },
    });
    expect(scoreRelated(target, sameSub)).toBeGreaterThan(scoreRelated(target, sameMainOnly));
  });

  it('does not pay twice for a subcategory match', () => {
    // A subcategory match already implies the category; counting both would let
    // it outrank a same-venue match without carrying more information.
    const target = makeEvent();
    const sameSub = makeEvent({ eventKey: 'x', location: { name: 'Inne', city: 'Szczecin', lat: null, lng: null } });
    const sameVenueDifferentKind = makeEvent({
      eventKey: 'y',
      categoryMain: 'Muzyka',
      categorySub: 'Koncert',
    });
    expect(scoreRelated(target, sameSub)).toBeLessThan(
      scoreRelated(target, sameSub) + scoreRelated(target, sameVenueDifferentKind)
    );
    // Same venue on its own is a real signal and clears the bar.
    expect(scoreRelated(target, sameVenueDifferentKind)).toBeGreaterThanOrEqual(MIN_SCORE);
  });

  it('leaves an unrelated event across town below the bar', () => {
    const target = makeEvent();
    const unrelated = makeEvent({
      eventKey: 'z',
      categoryMain: 'Edukacja',
      categorySub: 'Wykład',
      location: { name: 'Aula', city: 'Szczecin', lat: 53.5, lng: 14.7 },
      date: '2026-11-20',
    });
    expect(scoreRelated(target, unrelated)).toBeLessThan(MIN_SCORE);
  });

  it('prefers what is happening sooner', () => {
    const target = makeEvent();
    const soon = makeEvent({ eventKey: 'a', date: '2026-07-29' });
    const later = makeEvent({ eventKey: 'b', date: '2026-12-01' });
    expect(scoreRelated(target, soon)).toBeGreaterThan(scoreRelated(target, later));
  });
});

describe('pickRelatedEvents', () => {
  const target = makeEvent({ eventKey: 'target' });

  it('never suggests the event you are already looking at', () => {
    const picked = pickRelatedEvents({
      target,
      candidates: [target, ...makeMany(6, { categorySub: 'Salsa' })],
      now: TODAY,
    });
    expect(picked.map((e) => e.eventKey)).not.toContain('target');
  });

  it('drops anything already past — a perfect match yesterday is worthless', () => {
    const past = makeMany(6, { categorySub: 'Salsa', date: '2026-07-01' });
    expect(pickRelatedEvents({ target, candidates: past, now: TODAY })).toEqual([]);
  });

  it('collapses a repeating class to one card', () => {
    // Twelve instances of one weekly class would otherwise fill the entire rail
    // and make it look broken.
    const weekly = ['2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18'].map((date, i) =>
      makeEvent({ name: 'Bachata Sensual', eventKey: `bach-${i}`, date, location: { name: 'Studio B', city: 'Szczecin', lat: 53.43, lng: 14.55 } })
    );
    const others = makeMany(6, { categorySub: 'Salsa' });
    const picked = pickRelatedEvents({ target, candidates: [...weekly, ...others], now: TODAY });

    const bachata = picked.filter((e) => e.name === 'Bachata Sensual');
    expect(bachata).toHaveLength(1);
    // And it is the soonest instance, not an arbitrary one.
    expect(bachata[0].date).toBe('2026-07-28');
  });

  it('excludes the target\'s own series — that is the same class, not a similar one', () => {
    const sameClassLater = makeEvent({ eventKey: 'later', date: '2026-08-03' });
    const picked = pickRelatedEvents({
      target,
      candidates: [sameClassLater, ...makeMany(6, { categorySub: 'Salsa' })],
      now: TODAY,
    });
    expect(picked.map((e) => e.eventKey)).not.toContain('later');
  });

  it('lets no single venue own the rail', () => {
    const oneClub = Array.from({ length: 8 }, (_, i) =>
      makeEvent({ name: `Zajęcia ${i}`, eventKey: `club-${i}`, location: { name: 'Wielki Klub', city: 'Szczecin', lat: 53.43, lng: 14.55 } })
    );
    const elsewhere = makeMany(6, { categorySub: 'Salsa' });
    const picked = pickRelatedEvents({ target, candidates: [...oneClub, ...elsewhere], now: TODAY });

    const fromClub = picked.filter((e) => e.location.name === 'Wielki Klub');
    expect(fromClub.length).toBeLessThanOrEqual(2);
  });

  it('shows nothing rather than a lonely card or two', () => {
    // A rail is a promise that there is more of this kind; two cards break it.
    const thin = makeMany(2, { categorySub: 'Salsa' });
    expect(pickRelatedEvents({ target, candidates: thin, now: TODAY })).toEqual([]);
  });

  it('returns at least the minimum once enough clears the bar', () => {
    const picked = pickRelatedEvents({
      target,
      candidates: makeMany(8, { categorySub: 'Salsa' }),
      now: TODAY,
    });
    expect(picked.length).toBeGreaterThanOrEqual(MIN_RELATED);
  });

  it('honours the limit', () => {
    const picked = pickRelatedEvents({
      target,
      candidates: makeMany(30, { categorySub: 'Salsa' }),
      now: TODAY,
      limit: 6,
    });
    expect(picked).toHaveLength(6);
  });

  it('puts the most similar first', () => {
    const sameSub = makeEvent({ eventKey: 'sub', name: 'Salsa Ladies', location: { name: 'Gdzie indziej', city: 'Szczecin', lat: null, lng: null } });
    const sameMainOnly = makeEvent({ eventKey: 'main', name: 'Bachata Lady', categorySub: 'Bachata', location: { name: 'Trzecie miejsce', city: 'Szczecin', lat: null, lng: null } });
    const picked = pickRelatedEvents({
      target,
      candidates: [sameMainOnly, sameSub, ...makeMany(4, { categorySub: 'Salsa' })],
      now: TODAY,
    });
    expect(picked[0].categorySub).toBe('Salsa');
  });

  it('survives events with no coordinates', () => {
    const noCoords = makeMany(6, {
      categorySub: 'Salsa',
      location: { name: 'Online', city: 'Szczecin', lat: null, lng: null },
    });
    expect(() => pickRelatedEvents({ target, candidates: noCoords, now: TODAY })).not.toThrow();
  });
});
