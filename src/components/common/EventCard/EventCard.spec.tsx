import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import EventCard from './EventCard';
import { Event } from '@/types/event.types';

const mockEvent: Event = {
  id: 'evt-001',
  name: 'Hip Hop Choreo',
  description: 'Zajęcia choreograficzne',
  categories: ['dance', 'dance-hip-hop'],
  tags: ['open-level'],
  date: '2026-03-14',
  startTime: '18:00',
  endTime: '19:15',
  location: { name: 'Kimama Dance Studio', address: 'ul. Bohaterów Warszawy 57', city: 'Szczecin' },
  price: { amount: 35, currency: 'PLN', description: '35 zł' },
  ageGroup: 'adults',
  level: 'open',
  instructor: 'Weronika Jaśkiewicz',
  capacity: 20,
  url: 'https://kimama.pl/',
  sourceName: 'Kimama Dance Studio',
  sourceType: 'dance_studio',
  isRecurring: true,
  recurrenceRule: 'weekly',
  imageUrl: null,
  status: 'active',
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

  it('shows status badge for non-active events', () => {
    const soldOut = { ...mockEvent, status: 'sold_out' as const };
    render(<EventCard event={soldOut} />);
    expect(screen.getByText('Brak miejsc')).toBeInTheDocument();
  });

  it('links to event detail page', () => {
    render(<EventCard event={mockEvent} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/events/evt-001');
  });

  it('has article role with aria-label', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
