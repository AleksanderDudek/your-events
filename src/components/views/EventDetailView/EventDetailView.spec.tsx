import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

import EventDetailView from './EventDetailView';
import { Event } from '@/types/event.types';

const mockEvent: Event = {
  id: 'evt-001',
  eventKey: 'evt-test',
  name: 'Hip Hop Choreo',
  description: 'Zajęcia choreograficzne inspirowane stylami hip hop.',
  categoryMain: 'Taniec',
  categorySub: 'Hip Hop',
  date: '2026-03-14',
  startTime: '18:00',
  endTime: '19:15',
  durationMin: 75,
  location: { name: 'Kimama Dance Studio', city: 'Szczecin', lat: null, lng: null },
  price: { amount: 35, currency: 'PLN', label: '35 zł jednorazowo', showLabel: false },
  url: 'https://kimama.pl/plan-zajec/',
  imageUrl: '',
  sources: ['kimama'],
  updatedAt: '2026-03-10T12:00:00Z',
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

  it('hides the external link when url is empty', () => {
    const noUrl = { ...mockEvent, url: '' };
    render(<EventDetailView event={noUrl} />);
    expect(screen.queryByText('Przejdź do strony')).not.toBeInTheDocument();
  });
});
