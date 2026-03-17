import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import EventRow from './EventRow';
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
    expect(link).toHaveAttribute('href', '/events/evt-001');
  });
});
