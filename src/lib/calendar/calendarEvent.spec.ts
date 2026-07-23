import { describe, it, expect } from 'vitest';
import { Event } from '@/types/event.types';
import { toCalendarEvent, DEFAULT_DURATION_MIN } from './calendarEvent';

const NOTE = 'Godzina zakończenia szacowana.';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '1',
    eventKey: 'evt-key',
    name: 'Koncert',
    description: 'Opis wydarzenia.',
    categoryMain: 'Muzyka',
    categorySub: 'Koncert',
    date: '2026-07-24',
    startTime: '18:00',
    endTime: '',
    durationMin: null,
    location: { name: 'CAL Widawa, Dekarska 3', city: 'Wrocław', lat: null, lng: null },
    price: { amount: null, currency: 'PLN', label: '', showLabel: false },
    url: 'https://example.test/event',
    imageUrl: '',
    sources: ['gowroclaw'],
    updatedAt: '2026-07-20T10:30:00Z',
    ...overrides,
  };
}

describe('toCalendarEvent', () => {
  it('uses an explicit end time verbatim', () => {
    const ce = toCalendarEvent(makeEvent({ endTime: '20:30' }), NOTE);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T16:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:30:00.000Z');
    expect(ce.allDay).toBe(false);
  });

  it('rolls an end time that falls after midnight onto the next day', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '22:00', endTime: '02:00' }), NOTE);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T20:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-25T00:00:00.000Z');
  });

  it('derives the end from durationMin when there is no end time', () => {
    const ce = toCalendarEvent(makeEvent({ durationMin: 75 }), NOTE);
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T17:15:00.000Z');
  });

  it('falls back to the default duration when neither is present', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(DEFAULT_DURATION_MIN).toBe(120);
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:00:00.000Z');
  });

  it('notes the estimate in the description only when the end was guessed', () => {
    expect(toCalendarEvent(makeEvent(), NOTE).description).toContain(NOTE);
    expect(toCalendarEvent(makeEvent({ endTime: '20:30' }), NOTE).description).not.toContain(NOTE);
    expect(toCalendarEvent(makeEvent({ durationMin: 75 }), NOTE).description).not.toContain(NOTE);
  });

  it('treats the 00:00-23:59 marker as an all-day entry with an exclusive end', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '00:00', endTime: '23:59' }), NOTE);
    expect(ce.allDay).toBe(true);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T00:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-25T00:00:00.000Z');
    expect(ce.description).not.toContain(NOTE);
  });

  it('treats a missing start time as all-day', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '' }), NOTE);
    expect(ce.allDay).toBe(true);
  });

  it('joins venue and city into one location string', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.location).toBe('CAL Widawa, Dekarska 3, Wrocław');
  });

  it('omits the separator when the city is missing', () => {
    const ce = toCalendarEvent(
      makeEvent({ location: { name: 'Rynek', city: '', lat: null, lng: null } }),
      NOTE
    );
    expect(ce.location).toBe('Rynek');
  });

  it('builds a description from the event text, the source link and the note', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.description).toBe(
      `Opis wydarzenia.\n\nhttps://example.test/event\n\n${NOTE}`
    );
  });

  it('collapses the separators when parts are missing', () => {
    const ce = toCalendarEvent(
      makeEvent({ description: '', url: '', endTime: '20:30' }),
      NOTE
    );
    expect(ce.description).toBe('');
  });

  it('takes DTSTAMP from updatedAt so the output is deterministic', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.stamp.toISOString()).toBe('2026-07-20T10:30:00.000Z');
  });

  it('falls back to the event date at midnight UTC when updatedAt is missing', () => {
    const ce = toCalendarEvent(makeEvent({ updatedAt: null }), NOTE);
    expect(ce.stamp.toISOString()).toBe('2026-07-24T00:00:00.000Z');
  });

  it('builds a stable UID from the event key', () => {
    expect(toCalendarEvent(makeEvent(), NOTE).uid).toBe('evt-key@idznamiasto');
  });

  // Duplicate scrape values, not a zero-length event: it takes the same route
  // as a missing end and is marked estimated, rather than becoming a 24h block.
  it('treats an end equal to the start as no end at all', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '20:00', endTime: '20:00' }), NOTE);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T18:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T20:00:00.000Z');
    expect(ce.description).toContain(NOTE);
  });

  it('still prefers durationMin over the default when the end equals the start', () => {
    const ce = toCalendarEvent(
      makeEvent({ startTime: '20:00', endTime: '20:00', durationMin: 45 }),
      NOTE
    );
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:45:00.000Z');
    expect(ce.description).not.toContain(NOTE);
  });

  it('ignores a negative duration and falls back to the default', () => {
    const ce = toCalendarEvent(makeEvent({ durationMin: -30 }), NOTE);
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:00:00.000Z');
    expect(ce.description).toContain(NOTE);
  });

  it('falls back to the event date when updatedAt does not parse', () => {
    const ce = toCalendarEvent(makeEvent({ updatedAt: 'not-a-date' }), NOTE);
    expect(ce.stamp.toISOString()).toBe('2026-07-24T00:00:00.000Z');
  });
});
