import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/service/useCategories', () => ({
  useCategories: () => ({
    categories: [],
    topLevel: [],
    bySlug: new Map(),
    byParent: new Map(),
    byDisplayName: new Map(),
    displayNameToSlug: new Map(),
    isLoading: false,
    isError: false,
  }),
}));

import EventRow from './EventRow';
import { eventPath } from '@/lib/slug';
import { Event } from '@/types/event.types';

const mockEvent: Event = {
  id: 'evt-001',
  eventKey: 'evt-test',
  name: 'Hip Hop Choreo',
  description: 'Zajęcia choreograficzne',
  categoryMain: 'Taniec',
  categorySub: 'Hip Hop',
  date: '2026-03-14',
  startTime: '18:00',
  endTime: '19:15',
  durationMin: 75,
  location: { name: 'Kimama Dance Studio', city: 'Szczecin', lat: null, lng: null },
  price: { amount: 35, currency: 'PLN', label: '35 zł', showLabel: false },
  url: 'https://kimama.pl/',
  imageUrl: '',
  sources: ['kimama'],
  updatedAt: null,
};

describe('EventRow', () => {
  it('renders without crashing', () => {
    render(<EventRow event={mockEvent} />);
    expect(screen.getByText('Hip Hop Choreo')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<EventRow event={mockEvent} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays date in mono font column', () => {
    render(<EventRow event={mockEvent} />);
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('links to event detail', () => {
    render(<EventRow event={mockEvent} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', eventPath('szczecin', mockEvent, new Map()));
  });

  describe('time placement', () => {
    it('renders the time range', () => {
      render(<EventRow event={mockEvent} />);
      expect(screen.getByText('18:00–19:15')).toBeInTheDocument();
    });

    it('puts the time in the right column, not the venue meta line', () => {
      render(<EventRow event={mockEvent} />);

      const time = screen.getByText('18:00–19:15');
      const venue = screen.getByText('Kimama Dance Studio');
      // Sharing a parent would mean the time's x-position tracks the venue's length.
      expect(time.parentElement).not.toBe(venue.parentElement);
      // Same column as the price, so both anchor to the row's right edge.
      expect(time.parentElement).toContainElement(screen.getByText(/35/));
    });

    it('still renders the time slot when the event has no time', () => {
      render(<EventRow event={{ ...mockEvent, startTime: '', endTime: '', durationMin: null }} />);

      // Slot is empty but present, so the price keeps its y-offset.
      expect(screen.queryByText('18:00–19:15')).not.toBeInTheDocument();
      expect(screen.getByText(/35/)).toBeInTheDocument();
    });
  });

  describe('distance from the chosen point', () => {
    const placed: Event = { ...mockEvent, location: { ...mockEvent.location, lat: 51.11, lng: 17.032 } };
    // 0.0076° of latitude north of the venue: ~845 m.
    const origin = { lat: 51.1176, lng: 17.032 };

    it('says how far away the venue is, to the eye and to a screen reader', () => {
      render(<EventRow event={placed} distanceFrom={origin} />);
      // \s: Testing Library collapses the no-break space to a plain one.
      expect(screen.getByText(/^850\sm$/)).toBeInTheDocument();
      expect(screen.getByRole('article')).toHaveAccessibleName(/850\sm od wybranego punktu/);
    });

    it('says nothing without a point to measure from', () => {
      render(<EventRow event={placed} />);
      expect(screen.getByRole('article')).not.toHaveAccessibleName(/od wybranego punktu/);
    });
  });
});
