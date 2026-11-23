import { describe, it, expect } from 'vitest';
import { defaultDaysOf, settingsForDays } from './weekPlan';
import {
  cleanPlanName,
  copySourceKey,
  createPlan,
  isPlanId,
  MAX_PLAN_NAME,
  migrateLegacyPlan,
  mondayOf,
  newPlanId,
  openDates,
  parsePlans,
  SavedPlan,
  serializePlans,
  sortPlans,
  weekOptions,
  weeksFromNow,
  windowDates,
  windowEnd,
} from './weekPlans';

// 2026-11-23 is a Monday.
const MON = '2026-11-23';
const THU = '2026-11-26';
const SAT = '2026-11-28';
const SUN = '2026-11-29';

function plan(overrides: Partial<SavedPlan> = {}): SavedPlan {
  return {
    id: 'plan0001',
    name: null,
    start: MON,
    origin: 'own',
    sourceKey: null,
    createdAt: 1,
    settings: settingsForDays([THU, SUN]),
    chosen: {},
    ...overrides,
  };
}

describe('weeks', () => {
  it('finds the Monday of any day of the week', () => {
    expect(mondayOf(MON)).toBe(MON);
    expect(mondayOf(THU)).toBe(MON);
    expect(mondayOf(SUN)).toBe(MON);
    expect(mondayOf('2026-11-30')).toBe('2026-11-30');
  });

  it('spans 7 days and opens only what is still ahead', () => {
    expect(windowDates(MON)).toEqual([
      MON,
      '2026-11-24',
      '2026-11-25',
      THU,
      '2026-11-27',
      SAT,
      SUN,
    ]);
    expect(windowEnd(MON)).toBe(SUN);
    expect(openDates(MON, THU)).toEqual([THU, '2026-11-27', SAT, SUN]);
    expect(openDates(MON, '2026-11-30')).toEqual([]);
  });

  it('counts weeks from today’s week, whatever the weekday', () => {
    expect(weeksFromNow(SUN, MON)).toBe(0);
    expect(weeksFromNow('2026-11-30', SUN)).toBe(1);
    expect(weeksFromNow('2026-12-17', THU)).toBe(3);
  });

  it('offers this week’s remaining days and the next three weeks', () => {
    const options = weekOptions(SAT);
    expect(options.map((o) => [o.start, o.weeksAhead])).toEqual([
      [MON, 0],
      ['2026-11-30', 1],
      ['2026-12-07', 2],
      ['2026-12-14', 3],
    ]);
    expect(options[0].dates).toEqual([SAT, SUN]);
    expect(options[1].dates).toHaveLength(7);
  });
});

describe('a new plan', () => {
  it('takes the default days still ahead in its week', () => {
    expect(createPlan('abcd1234', MON, THU, 5).settings.days.map((d) => d.date)).toEqual([
      '2026-11-27',
      SUN,
    ]);
    expect(createPlan('abcd1234', '2026-11-30', THU, 5).settings.days.map((d) => d.date)).toEqual([
      '2026-11-30',
      '2026-12-02',
      '2026-12-04',
      '2026-12-06',
    ]);
    expect(createPlan('abcd1234', MON, SUN, 5).settings.days.map((d) => d.date)).toEqual([SUN]);
  });

  it('starts empty, named after its week, with no source', () => {
    const fresh = createPlan('abcd1234', MON, MON, 5);
    expect(fresh).toMatchObject({
      id: 'abcd1234',
      name: null,
      origin: 'own',
      sourceKey: null,
      createdAt: 5,
      chosen: {},
    });
  });

  it('falls back to the first open day when no default weekday is left', () => {
    expect(defaultDaysOf(['2026-11-24', THU])).toEqual(['2026-11-24']);
    expect(defaultDaysOf([])).toEqual([]);
  });
});

describe('ids, names, sources', () => {
  it('makes short URL-safe ids', () => {
    const id = newPlanId();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(isPlanId(id)).toBe(true);
    expect(newPlanId(() => 0)).toBe('00000000');
    expect(isPlanId('../etc')).toBe(false);
    expect(isPlanId(null)).toBe(false);
  });

  it('tidies a name, and an empty one means "named after its week"', () => {
    expect(cleanPlanName('  Weekend   z  rodzicami ')).toBe('Weekend z rodzicami');
    expect(cleanPlanName('   ')).toBeNull();
    expect(cleanPlanName('x'.repeat(100))).toHaveLength(MAX_PLAN_NAME);
  });

  it('knows a shared plan whatever order its ids come in', () => {
    expect(copySourceKey(['30', '4', '200'])).toBe(copySourceKey(['200', '30', '4']));
  });

  it('lists plans by week, then oldest first', () => {
    const a = plan({ id: 'aaaa0001', start: '2026-11-30', createdAt: 1 });
    const b = plan({ id: 'bbbb0001', start: MON, createdAt: 9 });
    const c = plan({ id: 'cccc0001', start: MON, createdAt: 3 });
    expect(sortPlans([a, b, c]).map((p) => p.id)).toEqual(['cccc0001', 'bbbb0001', 'aaaa0001']);
  });
});

describe('storage', () => {
  it('reads back what it wrote', () => {
    const saved = [
      plan({ chosen: { [`${THU}#0`]: '17' }, name: 'Mój' }),
      plan({ id: 'plan0002', start: '2026-11-30', settings: settingsForDays(['2026-12-01']) }),
    ];
    expect(parsePlans(serializePlans(saved), MON)).toEqual(saved);
  });

  it('drops a plan whose week is over, and past days from the rest', () => {
    const over = plan({
      id: 'over0001',
      start: '2026-11-16',
      settings: settingsForDays(['2026-11-20']),
    });
    const current = plan({ chosen: { [`${THU}#0`]: '17', [`${SUN}#0`]: '18' } });
    const [kept] = parsePlans(serializePlans([over, current]), SAT);
    expect(kept.id).toBe(current.id);
    expect(kept.settings.days.map((d) => d.date)).toEqual([SUN]);
    expect(kept.chosen).toEqual({ [`${SUN}#0`]: '18' });
  });

  it('keeps a plan whose chosen days have passed while its week is still on', () => {
    const [kept] = parsePlans(serializePlans([plan({ settings: settingsForDays([THU]) })]), SAT);
    expect(kept.settings.days).toEqual([]);
  });

  it('skips what is malformed and keeps the rest', () => {
    const good = plan();
    const raw = JSON.stringify({
      version: 2,
      plans: [
        null,
        { ...good, id: 'NOT VALID' },
        { ...good, id: 'bad00001', start: '23.11.2026' },
        { ...good, id: 'bad00002', settings: 'none' },
        good,
        { ...good, name: 'Duplikat' },
        {
          ...good,
          id: 'odd00001',
          origin: 'stolen',
          name: 7,
          sourceKey: '<script>',
          createdAt: 'x',
        },
      ],
    });
    const plans = parsePlans(raw, MON);
    // Same week; the unreadable createdAt counts as 0, so it sorts first.
    expect(plans.map((p) => p.id)).toEqual(['odd00001', 'plan0001']);
    const odd = plans.find((p) => p.id === 'odd00001')!;
    expect(odd).toMatchObject({ origin: 'own', name: null, sourceKey: null, createdAt: 0 });
    expect(plans.find((p) => p.id === 'plan0001')!.name).toBeNull();
  });

  it('reads nothing from nothing', () => {
    expect(parsePlans(null, MON)).toEqual([]);
    expect(parsePlans('not json', MON)).toEqual([]);
    expect(parsePlans('{"plans":5}', MON)).toEqual([]);
  });
});

describe('the single plan from before', () => {
  it('becomes the first plan of the list, from its first day still ahead', () => {
    // Made on Thursday for a rolling week, Thursday to Wednesday; read on Friday.
    const legacy = {
      settings: {
        days: [
          { date: THU, parts: ['any'] },
          { date: SAT, parts: ['evening'] },
          { date: '2026-12-01', parts: ['any'] },
        ],
        moods: ['music'],
        freeOnly: false,
      },
      chosen: { [`${THU}#0`]: '1', [`${SAT}#0`]: '2', ['2026-12-01#0']: '3' },
    };
    const migrated = migrateLegacyPlan(JSON.stringify(legacy), '2026-11-27', 'mig00001', 42)!;
    expect(migrated).toMatchObject({
      id: 'mig00001',
      start: SAT,
      origin: 'own',
      name: null,
      createdAt: 42,
    });
    expect(migrated.settings.days.map((d) => d.date)).toEqual([SAT, '2026-12-01']);
    expect(migrated.settings.moods).toEqual(['music']);
    expect(migrated.chosen).toEqual({ [`${SAT}#0`]: '2', ['2026-12-01#0']: '3' });
    // ...and it reads back through the list.
    expect(parsePlans(serializePlans([migrated]), '2026-11-27')).toEqual([migrated]);
  });

  it('migrates nothing when there was nothing', () => {
    expect(migrateLegacyPlan(null, MON, 'mig00001', 1)).toBeNull();
    expect(migrateLegacyPlan('{"settings":{"days":[]}}', MON, 'mig00001', 1)).toBeNull();
  });
});
