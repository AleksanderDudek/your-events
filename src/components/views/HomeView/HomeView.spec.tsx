import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/router';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

// HomeView renders an EventsMap preview which calls useEvents → useQuery.
// Stub the hook so the tests don't need a QueryClientProvider wrapper.
vi.mock('@/components/service/useEvents', () => ({
  useEvents: () => ({
    events: [],
    total: 0,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    filters: {},
  }),
}));

// EventsMap lazy-loads Leaflet after mount; jsdom doesn't fully exercise it.
// The placeholder div is fine for the test surface.
vi.mock('@/components/common/EventsMap/EventsMap', () => ({
  default: () => <div data-testid="events-map" />,
}));

import HomeView from './HomeView';

describe('HomeView', () => {
  it('renders the headline prompt and tagline', () => {
    renderWithRouter(<HomeView />);
    expect(screen.getByText('Chcesz zrobić coś fajnego?')).toBeInTheDocument();
    // The headline is split into a static prefix + an animated last word that
    // toggles between generic + selected city — match just the static prefix.
    expect(screen.getByRole('heading', { level: 1, name: /^Idź na/i })).toBeInTheDocument();
  });

  it('renders all three CTA tiles', () => {
    renderWithRouter(<HomeView />);
    expect(screen.getByText('Co się dzieje teraz na mieście?')).toBeInTheDocument();
    expect(screen.getByText('Co się dzieje w ten weekend?')).toBeInTheDocument();
    expect(screen.getByText('Gdzie mogę dzisiaj poćwiczyć?')).toBeInTheDocument();
  });

  it('has the browse-all secondary link', () => {
    renderWithRouter(<HomeView />);
    expect(screen.getByText('Przeglądaj wszystkie wydarzenia')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = renderWithRouter(<HomeView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
