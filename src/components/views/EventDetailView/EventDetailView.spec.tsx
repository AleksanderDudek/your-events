import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import EventDetailView from './EventDetailView';
import { Event } from '@/types/event.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const mockEvent: Event = {
  id: 'evt-001',
  name: 'Hip Hop Choreo',
  description: 'Zajęcia choreograficzne inspirowane stylami hip hop.',
  categories: ['dance', 'dance-hip-hop'],
  tags: ['open-level', 'solo', 'choreography'],
  date: '2026-03-14',
  startTime: '18:00',
  endTime: '19:15',
  location: { name: 'Kimama Dance Studio', address: 'ul. Bohaterów Warszawy 57, Szczecin', city: 'Szczecin' },
  price: { amount: 35, currency: 'PLN', description: '35 zł jednorazowo' },
  ageGroup: 'adults',
  level: 'open',
  instructor: 'Weronika Jaśkiewicz',
  capacity: 20,
  url: 'https://kimama.pl/plan-zajec/',
  sourceName: 'Kimama Dance Studio',
  sourceType: 'dance_studio',
  isRecurring: true,
  recurrenceRule: 'weekly',
  imageUrl: null,
  status: 'active',
};

describe('EventDetailView', () => {
  it('renders without crashing', () => {
    render(<EventDetailView event={mockEvent} />);
    expect(screen.getByText('Hip Hop Choreo')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<EventDetailView event={mockEvent} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays event details', () => {
    render(<EventDetailView event={mockEvent} />);
    expect(screen.getByText('Kimama Dance Studio')).toBeInTheDocument();
    expect(screen.getByText('35 PLN')).toBeInTheDocument();
    expect(screen.getByText('Weronika Jaśkiewicz')).toBeInTheDocument();
    expect(screen.getByText('Co tydzień')).toBeInTheDocument();
  });

  it('shows back button', () => {
    render(<EventDetailView event={mockEvent} />);
    expect(screen.getByText('Wróć')).toBeInTheDocument();
  });

  it('shows external link with correct attrs', () => {
    render(<EventDetailView event={mockEvent} />);
    const link = screen.getByText('Przejdź do strony').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows status banner for non-active events', () => {
    const cancelled = { ...mockEvent, status: 'cancelled' as const };
    render(<EventDetailView event={cancelled} />);
    expect(screen.getByText('Odwołane')).toBeInTheDocument();
  });
});
