import { describe, it, expect } from 'vitest';
import type { Event } from '@/types/event.types';
import {
  baseWeight,
  chosenInOrder,
  contextWeight,
  dayPartOf,
  decodePlanParam,
  diverseSample,
  defaultPlanDates,
  defaultSettings,
  emptyPlan,
  encodePlanParam,
  fitsDayPart,
  MAX_SHARED_EVENTS,
  parseStoredPlan,
  planDates,
  planCost,
  planReducer,
  planSlots,
  PlanCandidate,
  PlanContext,
  PlanSettings,
  PlanState,
  slotId,
  slotPool,
  weightedSample,
} from './weekPlan';

// Monday 2026-11-09.
const TODAY = '2026-11-09';

/** Deterministic random source (mulberry32), so every draw is repeatable. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1;

function makeEvent(overrides: Partial<Event> = {}): Event {
  const id = String(nextId++);
  return {
    id,
    eventKey: `key-${id}`,
    name: `Koncert ${id}`,
    description: '',
    categoryMain: 'Muzyka',
    categorySub: 'Koncert',
    date: TODAY,
    startTime: '19:00',
    endTime: '',
    durationMin: null,
    location: { name: `Klub ${id}`, city: 'Szczecin', lat: null, lng: null },
    price: { amount: 40, currency: 'PLN', label: '40 zł', showLabel: false },
    url: '',
    imageUrl: '',
    sources: ['test'],
    updatedAt: null,
    ...overrides,
  };
}

function cand(event: Partial<Event> = {}, extra: Partial<PlanCandidate> = {}): PlanCandidate {
  return {
    event: makeEvent(event),
    popularity: 1,
    imageKind: 'poster',
    seasons: [],
    audience: [],
    isLastDay: false,
    soldOut: false,
    ...extra,
  };
}

function ctxOf(candidates: PlanCandidate[], seed = 1): PlanContext {
  return { candidates: new Map(candidates.map((c) => [c.event.id, c])), rng: seeded(seed) };
}

function settingsFor(days: Array<[string, PlanSettings['days'][number]['parts']]>, extra: Partial<PlanSettings> = {}): PlanSettings {
  return { days: days.map(([date, parts]) => ({ date, parts })), moods: [], freeOnly: false, ...extra };
}

describe('days', () => {
  it('spans the rolling week from today', () => {
    expect(planDates(TODAY)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('defaults to Monday, Wednesday, Friday and Sunday wherever the week starts', () => {
    expect(defaultPlanDates(TODAY)).toEqual(['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-15']);
    // From a Thursday the four days wrap into the next week.
    expect(defaultPlanDates('2026-11-12')).toEqual(['2026-11-13', '2026-11-15', '2026-11-16', '2026-11-18']);
  });

  it('gives every default day one slot at any time', () => {
    const s = defaultSettings(TODAY);
    expect(s.days.every((d) => d.parts.length === 1 && d.parts[0] === 'any')).toBe(true);
    expect(planSlots(s).map((x) => x.id)).toEqual(s.days.map((d) => slotId(d.date, 0)));
  });
});

describe('time of day', () => {
  it('splits the day at noon and five', () => {
    expect(dayPartOf('09:30')).toBe('morning');
    expect(dayPartOf('12:00')).toBe('afternoon');
    expect(dayPartOf('16:59')).toBe('afternoon');
    expect(dayPartOf('17:00')).toBe('evening');
    expect(dayPartOf('')).toBeNull();
  });

  it('lets an event without a time fit any part of the day', () => {
    const allDay = makeEvent({ startTime: '' });
    expect(fitsDayPart(allDay, 'morning')).toBe(true);
    expect(fitsDayPart(makeEvent({ startTime: '20:00' }), 'morning')).toBe(false);
    expect(fitsDayPart(makeEvent({ startTime: '20:00' }), 'any')).toBe(true);
  });
});

describe('slotPool', () => {
  const slot = { id: slotId(TODAY, 0), date: TODAY, part: 'any' as const };

  it('treats one film in two cinemas as one series', () => {
    const helios = cand({ categoryMain: 'Film', name: 'Clayface', location: { name: 'Helios', city: '', lat: null, lng: null } });
    const multikino = cand({ categoryMain: 'Film', name: 'Clayface', location: { name: 'Multikino', city: '', lat: null, lng: null } });
    expect(slotPool([helios, multikino], slot, { moods: [], freeOnly: false })).toHaveLength(1);
  });

  it('folds a series to its earliest session that day', () => {
    const late = cand({ name: 'Dziadek do orzechów', startTime: '20:30', location: { name: 'Helios', city: '', lat: null, lng: null } });
    const early = cand({ name: 'Dziadek do orzechów', startTime: '15:00', location: { name: 'Helios', city: '', lat: null, lng: null } });
    const other = cand();
    const pool = slotPool([late, early, other], slot, { moods: [], freeOnly: false });
    expect(pool.map((c) => c.event.id).sort()).toEqual([early.event.id, other.event.id].sort());
  });

  it('never proposes a cancelled session', () => {
    const cancelled = cand({ name: 'ODWOŁANE: LOFT MINI CHAMP' });
    const ok = cand({ name: 'Koncert odwołanych marzeń' });
    expect(slotPool([cancelled, ok], slot, { moods: [], freeOnly: false })).toEqual([ok]);
  });

  it('drops sold-out events, other days and the wrong time of day', () => {
    const sold = cand({}, { soldOut: true });
    const tomorrow = cand({ date: '2026-11-10' });
    const morning = cand({ startTime: '10:00' });
    const evening = cand({ startTime: '19:00' });
    const pool = slotPool([sold, tomorrow, morning, evening], { ...slot, part: 'evening' }, { moods: [], freeOnly: false });
    expect(pool.map((c) => c.event.id)).toEqual([evening.event.id]);
  });

  it('keeps only the chosen moods, reading the audience tag for kids', () => {
    const concert = cand();
    const play = cand({ categoryMain: 'Teatr i Widowiska' });
    const familyConcert = cand({}, { audience: ['dzieci', 'rodziny'] });
    const pool = slotPool([concert, play, familyConcert], slot, { moods: ['kids'], freeOnly: false });
    expect(pool.map((c) => c.event.id)).toEqual([familyConcert.event.id]);
  });

  it('leaves classes out unless the visitor wants to be active', () => {
    const zumba = cand({ categoryMain: 'Taniec', name: 'ZUMBA' });
    const yoga = cand({ categoryMain: 'Wellness i Duchowość', name: 'YOGA' });
    const concert = cand();
    expect(slotPool([zumba, yoga, concert], slot, { moods: [], freeOnly: false })).toEqual([concert]);
    expect(slotPool([zumba, yoga, concert], slot, { moods: ['active'], freeOnly: false })).toHaveLength(2);
  });

  it('keeps only free events when asked', () => {
    const free = cand({ price: { amount: 0, currency: 'PLN', label: 'Wstęp wolny', showLabel: false } });
    const unknown = cand({ price: { amount: null, currency: 'PLN', label: '', showLabel: false } });
    const paid = cand();
    const pool = slotPool([free, unknown, paid], slot, { moods: [], freeOnly: true });
    expect(pool.map((c) => c.event.id)).toEqual([free.event.id]);
  });
});

describe('weights', () => {
  it('lets one-off evenings outweigh screenings when no mood is set', () => {
    const concert = cand();
    const film = cand({ categoryMain: 'Film' });
    expect(baseWeight(concert, [])).toBeGreaterThan(baseWeight(film, []) * 2);
    // ...but a chosen mood is the visitor's own ask: equal footing.
    expect(baseWeight(cand({ categoryMain: 'Sport i Fitness' }), ['active'])).toBe(baseWeight(concert, ['music']));
  });

  it('favours real pictures, several sources, seasons and last chances', () => {
    const plain = cand({}, { imageKind: 'placeholder' });
    expect(baseWeight(cand(), [])).toBeGreaterThan(baseWeight(plain, []));
    expect(baseWeight(cand({}, { popularity: 3 }), [])).toBeGreaterThan(baseWeight(cand(), []));
    expect(baseWeight(cand({}, { seasons: ['swieta'] }), [])).toBeGreaterThan(baseWeight(cand(), []));
    expect(baseWeight(cand({}, { isLastDay: true }), [])).toBeGreaterThan(baseWeight(cand(), []));
  });

  it('rules out repeats and same-day clashes, and favours a nearby second event', () => {
    const slot = { id: slotId(TODAY, 1), date: TODAY, part: 'any' as const };
    const here = { name: 'A', city: '', lat: 53.43, lng: 14.55 };
    const first = makeEvent({ startTime: '18:00', durationMin: 120, location: here });
    const clash = cand({ startTime: '19:00' });
    const sameSeries = cand({ name: first.name, location: here, startTime: '21:00' });
    const near = cand({ startTime: '21:00', location: { ...here, name: 'B', lat: 53.431 } });
    const far = cand({ startTime: '21:00', location: { ...here, name: 'C', lat: 53.5 } });
    expect(contextWeight(clash, slot, [first], [])).toBe(0);
    expect(contextWeight(sameSeries, slot, [first], [])).toBe(0);
    expect(contextWeight(near, slot, [first], [])).toBeGreaterThan(contextWeight(far, slot, [first], []));
  });
});

describe('weightedSample', () => {
  it('draws distinct items and never one of weight zero', () => {
    const items = ['a', 'b', 'c', 'd'];
    const picked = weightedSample(items, 3, (x) => (x === 'b' ? 0 : 1), seeded(7));
    expect(new Set(picked).size).toBe(3);
    expect(picked).not.toContain('b');
  });

  it('stops short when the pool runs out', () => {
    expect(weightedSample(['a'], 3, () => 1, seeded(1))).toEqual(['a']);
    expect(weightedSample(['a', 'b'], 2, () => 0, seeded(1))).toEqual([]);
  });

  it('draws heavier items more often', () => {
    const rng = seeded(42);
    let heavy = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (weightedSample(['light', 'heavy'], 1, (x) => (x === 'heavy' ? 4 : 1), rng)[0] === 'heavy') heavy += 1;
    }
    expect(heavy / 2000).toBeGreaterThan(0.75);
    expect(heavy / 2000).toBeLessThan(0.85);
  });
});

describe('diverseSample', () => {
  it('keeps a crowd of films from filling the shortlist', () => {
    const films = Array.from({ length: 30 }, (_, i) => cand({ categoryMain: 'Film', name: `Film ${i}` }));
    const concert = cand();
    const play = cand({ categoryMain: 'Teatr i Widowiska' });
    const pool = [...films, concert, play];
    const rng = seeded(11);
    let filmsShown = 0;
    for (let i = 0; i < 300; i += 1) {
      filmsShown += diverseSample(pool, 3, (c) => baseWeight(c, []), rng).filter(
        (c) => c.event.categoryMain === 'Film'
      ).length;
    }
    // Only two non-films exist, so every shortlist of 3 holds at least one film.
    // Weighted by item it would be ~2.8; spread across categories, close to the floor.
    expect(filmsShown / 300).toBeLessThan(1.5);
  });

  it('damps a category already on screen', () => {
    const a = cand({ categoryMain: 'Muzyka' });
    const b = cand({ categoryMain: 'Teatr i Widowiska' });
    const rng = seeded(5);
    let theatre = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (diverseSample([a, b], 1, () => 1, rng, [cand({ categoryMain: 'Muzyka' })])[0] === b) theatre += 1;
    }
    expect(theatre / 1000).toBeGreaterThan(0.75);
  });
});

describe('planReducer', () => {
  const MON = TODAY;
  const WED = '2026-11-11';

  function setup(seed = 3) {
    const monday = Array.from({ length: 8 }, (_, i) => cand({ date: MON, startTime: `${10 + i}:00`, name: `Pon ${i}` }));
    const wednesday = Array.from({ length: 8 }, (_, i) => cand({ date: WED, startTime: `${10 + i}:00`, name: `Śr ${i}` }));
    const ctx = ctxOf([...monday, ...wednesday], seed);
    const settings = settingsFor([[MON, ['any']], [WED, ['any']]]);
    const state = planReducer(emptyPlan(settings), { type: 'settings', settings }, ctx);
    return { ctx, state, monday, wednesday };
  }

  it('offers three proposals per open slot, each from its own day', () => {
    const { state, ctx } = setup();
    for (const slot of planSlots(state.settings)) {
      const ids = state.proposals[slot.id];
      expect(ids).toHaveLength(3);
      expect(ids.every((id) => ctx.candidates.get(id)!.event.date === slot.date)).toBe(true);
    }
  });

  it('replaces only the skipped card and never offers it again in that slot', () => {
    const { state, ctx } = setup();
    const slot = slotId(MON, 0);
    let s: PlanState = state;
    const seen = new Set<string>(s.proposals[slot]);
    for (let round = 0; round < 5; round += 1) {
      const [first, second, third] = s.proposals[slot];
      s = planReducer(s, { type: 'skip', slotId: slot, eventId: second }, ctx);
      expect(s.proposals[slot][0]).toBe(first);
      expect(s.proposals[slot][2]).toBe(third);
      expect(s.proposals[slot]).not.toContain(second);
      expect(s.skipped[slot]).toContain(second);
      s.proposals[slot].forEach((id) => seen.add(id));
    }
    // 8 Monday events: 3 shown + 5 skips uses them all up.
    expect(seen.size).toBe(8);
    const empty = planReducer(s, { type: 'skip', slotId: slot, eventId: s.proposals[slot][1] }, ctx);
    expect(empty.proposals[slot]).toHaveLength(2);
  });

  it('rerolls a slot without showing the same cards again', () => {
    const { state, ctx } = setup();
    const slot = slotId(MON, 0);
    const before = state.proposals[slot];
    const after = planReducer(state, { type: 'reroll', slotId: slot }, ctx).proposals[slot];
    expect(after.some((id) => before.includes(id))).toBe(false);
  });

  it('records a choice, closes the slot and lists it in plan order', () => {
    const { state, ctx } = setup();
    const wedPick = state.proposals[slotId(WED, 0)][0];
    const monPick = state.proposals[slotId(MON, 0)][1];
    let s = planReducer(state, { type: 'choose', slotId: slotId(WED, 0), eventId: wedPick }, ctx);
    s = planReducer(s, { type: 'choose', slotId: slotId(MON, 0), eventId: monPick }, ctx);
    expect(s.proposals[slotId(WED, 0)]).toBeUndefined();
    expect(chosenInOrder(s, ctx.candidates).map((e) => e.id)).toEqual([monPick, wedPick]);
    const undone = planReducer(s, { type: 'unchoose', slotId: slotId(MON, 0) }, ctx);
    expect(undone.chosen[slotId(MON, 0)]).toBeUndefined();
    expect(undone.proposals[slotId(MON, 0)]).toHaveLength(3);
  });

  it('pulls a clashing proposal from the other slot of the same day once one is chosen', () => {
    const at19 = cand({ startTime: '19:00', durationMin: 120 });
    const at20 = cand({ startTime: '20:00' });
    const at10 = cand({ startTime: '10:00' });
    const at12 = cand({ startTime: '12:00' });
    const ctx = ctxOf([at19, at20, at10, at12], 5);
    const settings = settingsFor([[MON, ['any', 'any']]]);
    let s: PlanState = {
      ...emptyPlan(settings),
      proposals: { [slotId(MON, 0)]: [at19.event.id], [slotId(MON, 1)]: [at20.event.id, at10.event.id] },
    };
    s = planReducer(s, { type: 'choose', slotId: slotId(MON, 0), eventId: at19.event.id }, ctx);
    const second = s.proposals[slotId(MON, 1)];
    expect(second).not.toContain(at20.event.id);
    expect(second).toContain(at10.event.id);
    expect(second).toContain(at12.event.id);
  });

  it('keeps choices for days that remain when the settings change', () => {
    const { state, ctx } = setup();
    const pick = state.proposals[slotId(MON, 0)][0];
    let s = planReducer(state, { type: 'choose', slotId: slotId(MON, 0), eventId: pick }, ctx);
    s = planReducer(s, { type: 'settings', settings: settingsFor([[MON, ['any', 'evening']]]) }, ctx);
    expect(s.chosen).toEqual({ [slotId(MON, 0)]: pick });
    expect(s.proposals[slotId(WED, 0)]).toBeUndefined();
    expect(s.proposals[slotId(MON, 1)].length).toBeGreaterThan(0);
  });
});

describe('storage', () => {
  it('round-trips a plan and drops days that have passed', () => {
    const settings = settingsFor([['2026-11-08', ['any']], [TODAY, ['evening', 'morning']]], { moods: ['music'] });
    const raw = JSON.stringify({ settings, chosen: { [slotId('2026-11-08', 0)]: '5', [slotId(TODAY, 1)]: '7' } });
    expect(parseStoredPlan(raw, TODAY)).toEqual({
      settings: settingsFor([[TODAY, ['evening', 'morning']]], { moods: ['music'] }),
      chosen: { [slotId(TODAY, 1)]: '7' },
    });
  });

  it('rejects garbage and plans with no day left', () => {
    expect(parseStoredPlan(null, TODAY)).toBeNull();
    expect(parseStoredPlan('{oops', TODAY)).toBeNull();
    expect(parseStoredPlan(JSON.stringify({ settings: { days: [{ date: '2026-01-01', parts: ['any'] }] } }), TODAY)).toBeNull();
    const odd = JSON.stringify({ settings: { days: [{ date: TODAY, parts: ['brunch', 'any'] }], moods: ['x'] }, chosen: { a: 1 } });
    expect(parseStoredPlan(odd, TODAY)).toEqual({ settings: settingsFor([[TODAY, ['any']]]), chosen: {} });
  });
});

describe('share link', () => {
  it('round-trips ids and ignores anything that is not one', () => {
    expect(decodePlanParam(encodePlanParam(['12', '345']))).toEqual(['12', '345']);
    expect(decodePlanParam('12.abc..12.7')).toEqual(['12', '7']);
    expect(decodePlanParam(null)).toEqual([]);
  });

  it('caps the number of events a link can ask for', () => {
    const many = Array.from({ length: 100 }, (_, i) => String(i + 1)).join('.');
    expect(decodePlanParam(many)).toHaveLength(MAX_SHARED_EVENTS);
  });
});

describe('planReducer: board actions', () => {
  const MON = TODAY;
  const WED = '2026-11-11';

  function setup(parts: PlanSettings['days'][number]['parts'] = ['any']) {
    const evs = [
      ...Array.from({ length: 8 }, (_, i) => cand({ date: MON, startTime: `${String(8 + i).padStart(2, '0')}:00`, name: `Pon ${i}` })),
      ...Array.from({ length: 8 }, (_, i) => cand({ date: WED, startTime: `${String(8 + i).padStart(2, '0')}:00`, name: `Śr ${i}` })),
    ];
    const ctx = ctxOf(evs, 9);
    const settings = settingsFor([[MON, parts], [WED, ['any']]]);
    return { ctx, state: planReducer(emptyPlan(settings), { type: 'settings', settings }, ctx) };
  }

  it('fills every open slot at once and leaves decided ones alone', () => {
    const { ctx, state } = setup(['any', 'any']);
    const kept = state.proposals[slotId(MON, 1)][2];
    const decided = planReducer(state, { type: 'choose', slotId: slotId(MON, 1), eventId: kept }, ctx);
    const full = planReducer(decided, { type: 'autofill' }, ctx);
    expect(Object.keys(full.chosen).sort()).toEqual([slotId(MON, 0), slotId(MON, 1), slotId(WED, 0)].sort());
    expect(full.chosen[slotId(MON, 1)]).toBe(kept);
    expect(new Set(Object.values(full.chosen)).size).toBe(3);
  });

  it('moves the later slots of a day up when one is removed', () => {
    const { ctx, state } = setup(['morning', 'afternoon', 'evening']);
    const pick = state.proposals[slotId(MON, 2)][0];
    let s = planReducer(state, { type: 'choose', slotId: slotId(MON, 2), eventId: pick }, ctx);
    s = planReducer(s, { type: 'removeSlot', slotId: slotId(MON, 0) }, ctx);
    expect(s.settings.days.find((d) => d.date === MON)!.parts).toEqual(['afternoon', 'evening']);
    // The evening choice followed its slot from #2 to #1.
    expect(s.chosen).toEqual({ [slotId(MON, 1)]: pick });
    expect(s.proposals[slotId(MON, 2)]).toBeUndefined();
  });

  it('drops the whole day with its last slot', () => {
    const { ctx, state } = setup();
    const s = planReducer(state, { type: 'removeSlot', slotId: slotId(MON, 0) }, ctx);
    expect(s.settings.days.map((d) => d.date)).toEqual([WED]);
    expect(s.proposals[slotId(MON, 0)]).toBeUndefined();
  });

  it('adds a slot to a day, up to the limit', () => {
    const { ctx, state } = setup(['any', 'any', 'any']);
    expect(planReducer(state, { type: 'addSlot', date: MON }, ctx)).toBe(state);
    const more = planReducer(state, { type: 'addSlot', date: WED }, ctx);
    expect(more.settings.days.find((d) => d.date === WED)!.parts).toEqual(['any', 'any']);
    expect(more.proposals[slotId(WED, 1)]).toHaveLength(3);
  });

  it('redraws one slot for a new time of day, forgetting its choice', () => {
    const { ctx, state } = setup();
    const pick = state.proposals[slotId(MON, 0)][0];
    let s = planReducer(state, { type: 'choose', slotId: slotId(MON, 0), eventId: pick }, ctx);
    s = planReducer(s, { type: 'setPart', slotId: slotId(MON, 0), part: 'morning' }, ctx);
    expect(s.chosen[slotId(MON, 0)]).toBeUndefined();
    const offered = s.proposals[slotId(MON, 0)].map((id) => ctx.candidates.get(id)!.event.startTime);
    expect(offered.every((t) => t < '12:00')).toBe(true);
    expect(s.proposals[slotId(WED, 0)]).toEqual(state.proposals[slotId(WED, 0)]);
  });
});

describe('planCost', () => {
  const price = (amount: number | null, showLabel = false) =>
    makeEvent({ price: { amount, currency: 'PLN', label: '', showLabel } });

  it('adds known prices and counts free and unknown apart', () => {
    expect(planCost([price(40), price(0), price(35), price(null)])).toEqual({ total: 75, paid: 2, free: 1, unknown: 1 });
  });

  it('does not read a membership label or a ticket id as a price', () => {
    expect(planCost([price(149, true), price(196331)])).toEqual({ total: 0, paid: 0, free: 0, unknown: 2 });
  });

  it('is zero for an empty plan', () => {
    expect(planCost([])).toEqual({ total: 0, paid: 0, free: 0, unknown: 0 });
  });
});
