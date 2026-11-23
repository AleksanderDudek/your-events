import { describe, it, expect } from 'vitest';
import { eventFactory } from '@/test-utils/eventFactory';
import { messages } from '@/i18n';
import { parseStoredPlan } from '@/lib/weekPlan';
import {
  groupPlanByDay,
  planFromEvents,
  planCostLabel,
  planPdfContent,
  planPdfFileName,
  planShareText,
  planShareUrl,
  shortVenue,
  sortPlanEvents,
} from './planShare';

// A Monday.
const TODAY = '2026-11-23';

const makeEvent = eventFactory(TODAY);

describe('ordering', () => {
  it('sorts by day, then time, an all-day event first', () => {
    const late = makeEvent({ date: '2026-11-24', startTime: '20:00' });
    const allDay = makeEvent({ date: '2026-11-24', startTime: '' });
    const monday = makeEvent({ date: '2026-11-23', startTime: '21:00' });
    expect(sortPlanEvents([late, allDay, monday]).map((e) => e.id)).toEqual([monday.id, allDay.id, late.id]);
  });

  it('groups into days in order', () => {
    const a = makeEvent({ date: '2026-11-25' });
    const b = makeEvent({ date: '2026-11-23' });
    const c = makeEvent({ date: '2026-11-25', startTime: '10:00' });
    expect(groupPlanByDay([a, b, c]).map((d) => [d.date, d.events.map((e) => e.id)])).toEqual([
      ['2026-11-23', [b.id]],
      ['2026-11-25', [c.id, a.id]],
    ]);
  });
});

describe('planShareUrl', () => {
  it('carries the ids in plan order on the page’s own address', () => {
    const a = makeEvent({ id: '30', date: '2026-11-25' });
    const b = makeEvent({ id: '12', date: '2026-11-23' });
    expect(planShareUrl('https://idznamiasto.pl/szczecin/moj-tydzien/', [a, b])).toBe(
      'https://idznamiasto.pl/szczecin/moj-tydzien/?plan=12.30'
    );
  });
});

describe('planShareText', () => {
  const t = messages.pl;
  const url = 'https://idznamiasto.pl/szczecin/moj-tydzien/?plan=1.2';

  it('reads as a plan without opening the link, and ends with the link', () => {
    const text = planShareText(
      [
        makeEvent({ name: 'Wernisaż', startTime: '', date: '2026-11-27', location: { name: 'BWA, Rynek 1', city: 'Szczecin', lat: null, lng: null } }),
        makeEvent({ name: 'Koncert jazzowy', startTime: '19:00', date: '2026-11-23', location: { name: 'Filharmonia', city: 'Szczecin', lat: null, lng: null } }),
      ],
      { t, locale: 'pl', cityLocative: 'Szczecinie', url }
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe(t.WEEK_SHARE_TEXT('Szczecinie'));
    expect(lines).toContain('• 19:00 Koncert jazzowy (Filharmonia)');
    expect(lines).toContain('• Wernisaż (BWA)');
    expect(lines.indexOf('• 19:00 Koncert jazzowy (Filharmonia)')).toBeLessThan(lines.indexOf('• Wernisaż (BWA)'));
    expect(lines.at(-1)).toBe(url);
  });

  it('labels each day with its weekday', () => {
    const text = planShareText([makeEvent({ date: '2026-11-27' })], { t, locale: 'pl', cityLocative: 'Szczecinie', url });
    expect(text).toMatch(/^Pt 27 lis/m);
  });

  it('clips a very long title', () => {
    const text = planShareText([makeEvent({ name: 'A'.repeat(200) })], { t, locale: 'pl', cityLocative: 'X', url });
    const line = text.split('\n').find((l) => l.startsWith('•'))!;
    expect([...line].length).toBeLessThan(100);
    expect(line).toContain('…');
  });
});

describe('shortVenue', () => {
  it('keeps the name, drops the address', () => {
    expect(shortVenue('Kino Helios Magnolia, ul. Legnicka 58, Wrocław')).toBe('Kino Helios Magnolia');
    expect(shortVenue('')).toBe('');
  });
});

describe('planFromEvents (copying a shared plan)', () => {
  it('makes one decided slot per event, at its time of day', () => {
    const morning = makeEvent({ date: '2026-11-24', startTime: '10:00' });
    const evening = makeEvent({ date: '2026-11-24', startTime: '19:30' });
    const allDay = makeEvent({ date: '2026-11-26', startTime: '' });
    const plan = planFromEvents([evening, allDay, morning], TODAY)!;
    expect(plan.settings).toEqual({
      days: [
        { date: '2026-11-24', parts: ['morning', 'evening'] },
        { date: '2026-11-26', parts: ['any'] },
      ],
      moods: [],
      freeOnly: false,
    });
    expect(plan.chosen).toEqual({
      '2026-11-24#0': morning.id,
      '2026-11-24#1': evening.id,
      '2026-11-26#0': allDay.id,
    });
  });

  it('survives the planner’s own storage check unchanged', () => {
    const plan = planFromEvents(
      [makeEvent({ date: '2026-11-24', startTime: '10:00' }), makeEvent({ date: '2026-11-25', startTime: '' })],
      TODAY
    )!;
    expect(parseStoredPlan(JSON.stringify(plan), TODAY)).toEqual(plan);
  });

  it('keeps a day to the planner’s three slots', () => {
    const day = Array.from({ length: 5 }, (_, i) => makeEvent({ date: '2026-11-24', startTime: `1${i}:00` }));
    const plan = planFromEvents(day, TODAY)!;
    expect(plan.settings.days[0].parts).toHaveLength(3);
    expect(Object.keys(plan.chosen)).toHaveLength(3);
  });

  it('leaves out what has passed or lies beyond this week', () => {
    const past = makeEvent({ date: '2026-11-22' });
    const far = makeEvent({ date: '2026-12-10' });
    expect(planFromEvents([past, far], TODAY)).toBeNull();
    const kept = makeEvent({ date: '2026-11-29' });
    expect(Object.values(planFromEvents([past, kept, far], TODAY)!.chosen)).toEqual([kept.id]);
  });
});

describe('planPdfFileName', () => {
  it('names the city and the first day', () => {
    expect(planPdfFileName('szczecin', [makeEvent({ date: '2026-11-27' }), makeEvent({ date: '2026-11-24' })])).toBe(
      'idznamiasto-plan-szczecin-2026-11-24.pdf'
    );
    expect(planPdfFileName('wroclaw', [])).toBe('idznamiasto-plan-wroclaw.pdf');
  });
});

describe('planCostLabel', () => {
  const t = messages.pl;
  it('says what one person pays', () => {
    expect(planCostLabel(t, { total: 125.4, paid: 3, free: 1, unknown: 0 })).toBe('ok. 125 zł');
    expect(planCostLabel(t, { total: 60, paid: 1, free: 0, unknown: 2 })).toBe('ok. 60 zł + 2 bez ceny');
    expect(planCostLabel(t, { total: 0, paid: 0, free: 2, unknown: 0 })).toBe('za darmo');
    expect(planCostLabel(t, { total: 0, paid: 0, free: 0, unknown: 1 })).toBe('cena w opisie');
  });
});

describe('planPdfContent', () => {
  const t = messages.pl;
  const content = planPdfContent(
    [
      makeEvent({
        id: '7',
        name: 'Wernisaż',
        date: '2026-11-27',
        startTime: '',
        categoryMain: 'Sztuka i Wystawy',
        price: { amount: 0, currency: 'PLN', label: '', showLabel: false },
        location: { name: 'BWA, Rynek 1', city: 'Szczecin', lat: null, lng: null },
      }),
      makeEvent({
        id: '3',
        name: 'Koncert',
        date: '2026-11-24',
        startTime: '19:00',
        price: { amount: 60, currency: 'PLN', label: '60 zł', showLabel: false },
        location: { name: 'Filharmonia', city: 'Szczecin', lat: null, lng: null },
      }),
    ],
    {
      t,
      locale: 'pl',
      cityLocative: 'Szczecinie',
      planUrl: 'https://idznamiasto.pl/szczecin/moj-tydzien/?plan=3.7',
      eventUrl: (e) => `https://idznamiasto.pl/e/${e.id}/`,
      colorOf: (e) => (e.categoryMain === 'Muzyka' ? '#7c4dff' : undefined),
      today: new Date('2026-11-23T12:00:00'),
    }
  );

  it('titles the plan with the city and its days', () => {
    expect(content.title).toBe(t.WEEK_META_TITLE('Szczecinie'));
    expect(content.subtitle).toBe('24 lis – 27 lis');
    expect(content.cost).toBe('Tydzień: ok. 60 zł · na osobę');
  });

  it('lists every event under its day, with time, place, price and link', () => {
    expect(content.days.map((d) => d.label)).toEqual(['Wtorek, 24 lis', 'Piątek, 27 lis']);
    expect(content.days[0].events[0]).toEqual({
      time: '19:00',
      name: 'Koncert',
      meta: 'Filharmonia · 60 zł · Muzyka',
      url: 'https://idznamiasto.pl/e/3/',
      color: '#7c4dff',
    });
    expect(content.days[1].events[0]).toMatchObject({ time: 'cały dzień', meta: 'BWA · Bezpłatne · Sztuka i Wystawy' });
  });

  it('ends with the plan’s own link and today’s date', () => {
    expect(content.planUrl).toBe('https://idznamiasto.pl/szczecin/moj-tydzien/?plan=3.7');
    expect(content.footer).toBe('Plan z idznamiasto.pl · 23.11.2026');
    expect(content.language).toBe('pl-PL');
  });
});
