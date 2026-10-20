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

import EventCard from './EventCard';
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

describe('EventCard', () => {
  it('renders without crashing', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('Hip Hop Choreo')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<EventCard event={mockEvent} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays event details', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('Kimama Dance Studio')).toBeInTheDocument();
    expect(screen.getByText('35 PLN')).toBeInTheDocument();
  });

  it('links to event detail page', () => {
    render(<EventCard event={mockEvent} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', eventPath('szczecin', mockEvent, new Map()));
  });

  it('has article role with aria-label', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('shows the day number and month in the date badge', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('14')).toBeInTheDocument();   // 2026-03-14
    // pl-PL short month, uppercased. Regex (not exact) because some ICU builds
    // append a period ("mar." → "MAR."); substring match is stable across both.
    expect(screen.getByText(/MAR/)).toBeInTheDocument();
  });

  describe('time badge', () => {
    it('shows the time range on the hero band', () => {
      render(<EventCard event={mockEvent} />);
      expect(screen.getByText('18:00–19:15')).toBeInTheDocument();
    });

    it('omits the badge entirely when the event has no time', () => {
      render(<EventCard event={{ ...mockEvent, startTime: '', endTime: '', durationMin: null }} />);
      expect(screen.queryByText('18:00–19:15')).not.toBeInTheDocument();
    });

    it('carries the time in the article aria-label (the badge is aria-hidden)', () => {
      render(<EventCard event={mockEvent} />);
      expect(screen.getByRole('article')).toHaveAccessibleName(
        expect.stringContaining('18:00–19:15') as unknown as string
      );
    });
  });
});
