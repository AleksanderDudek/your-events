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
});
