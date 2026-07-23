import { describe, it, expect } from 'vitest';
import { CalendarEvent } from './calendarEvent';
import { googleCalendarUrl, outlookCalendarUrl } from './links';

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'Koncert',
    startUtc: new Date('2026-07-24T16:00:00Z'),
    endUtc: new Date('2026-07-24T18:00:00Z'),
    allDay: false,
    location: 'CAL Widawa, Dekarska 3',
    description: 'Opis.',
    url: 'https://example.test/event',
    uid: 'evt-key@idznamiasto',
    stamp: new Date('2026-07-20T10:30:00Z'),
    ...overrides,
  };
}

const allDayEvent = makeCalendarEvent({
  allDay: true,
  startUtc: new Date('2026-07-24T00:00:00Z'),
  endUtc: new Date('2026-07-25T00:00:00Z'),
});

describe('googleCalendarUrl', () => {
  it('builds a template URL for a timed event', () => {
    expect(googleCalendarUrl(makeCalendarEvent())).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Koncert' +
        '&dates=20260724T160000Z%2F20260724T180000Z&details=Opis.' +
        '&location=CAL+Widawa%2C+Dekarska+3'
    );
  });

  it('uses bare dates for an all-day event', () => {
    expect(googleCalendarUrl(allDayEvent)).toContain('dates=20260724%2F20260725');
  });
});

describe('outlookCalendarUrl', () => {
  it('builds a compose URL for a timed event', () => {
    expect(outlookCalendarUrl(makeCalendarEvent())).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose' +
        '?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=Koncert' +
        '&startdt=2026-07-24T16%3A00%3A00Z&enddt=2026-07-24T18%3A00%3A00Z' +
        '&body=Opis.&location=CAL+Widawa%2C+Dekarska+3'
    );
  });

  it('sends an inclusive end date and the allday flag for an all-day event', () => {
    expect(outlookCalendarUrl(allDayEvent)).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose' +
        '?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=Koncert' +
        '&startdt=2026-07-24&enddt=2026-07-24' +
        '&body=Opis.&location=CAL+Widawa%2C+Dekarska+3&allday=true'
    );
  });
});
