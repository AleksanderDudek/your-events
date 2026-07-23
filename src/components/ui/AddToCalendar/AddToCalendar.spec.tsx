import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import AddToCalendar from './AddToCalendar';
import { Event } from '@/types/event.types';

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

describe('AddToCalendar', () => {
  it('renders the trigger', () => {
    render(<AddToCalendar event={makeEvent()} />);
    expect(screen.getByRole('button', { name: 'Dodaj do kalendarza' })).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AddToCalendar event={makeEvent()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders nothing when the event has no date', () => {
    const { container } = render(<AddToCalendar event={makeEvent({ date: '' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a menu with the three destinations', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    expect(screen.getByRole('menuitem', { name: /Google Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Outlook/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Pobierz plik/ })).toBeInTheDocument();
  });

  it('points Google at a prefilled template in a new tab', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    const item = screen.getByRole('menuitem', { name: /Google Calendar/ });
    expect(item.getAttribute('href')).toContain(
      'calendar.google.com/calendar/render?action=TEMPLATE'
    );
    expect(item).toHaveAttribute('target', '_blank');
    expect(item.getAttribute('rel')).toContain('noopener');
  });

  it('offers the .ics as a named download carrying the calendar payload', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    const item = screen.getByRole('menuitem', { name: /Pobierz plik/ });
    expect(item).toHaveAttribute('download', 'koncert-2026-07-24.ics');

    const href = item.getAttribute('href') ?? '';
    expect(href.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    const payload = decodeURIComponent(href.slice('data:text/calendar;charset=utf-8,'.length));
    expect(payload).toContain('BEGIN:VCALENDAR');
    expect(payload).toContain('SUMMARY:Koncert');
    expect(payload).toContain('DTSTART:20260724T160000Z');
  });

  it('marks the trigger as a menu button for assistive tech', () => {
    render(<AddToCalendar event={makeEvent()} />);
    const trigger = screen.getByRole('button', { name: 'Dodaj do kalendarza' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
