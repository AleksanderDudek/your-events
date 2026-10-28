import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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

const HALLOWEEN = {
  slug: 'halloween',
  name: 'Halloween',
  emoji: '🎃',
  description: 'Bale przebierańców i warsztaty z dyniami.',
  dateFrom: '2026-10-15',
  dateTo: '2026-11-02',
  showFrom: '2026-10-10',
  sort: 10,
  count: 63,
  upcoming: false,
};

// Swappable per test: outside a season the hook answers with nothing.
const seasonMocks = vi.hoisted(() => ({ seasons: [] as unknown[] }));
vi.mock('@/components/service/useSeasons', () => ({
  useSeasons: () => ({ seasons: seasonMocks.seasons, isLoading: false }),
}));

beforeEach(() => {
  seasonMocks.seasons = [];
});

// next/dynamic loads EventsMapInner async; jsdom doesn't fully exercise it.
// The placeholder div is fine for the test surface.
vi.mock('@/components/common/EventsMap/EventsMap', () => ({
  default: () => <div data-testid="events-map" />,
}));

import HomeView from './HomeView';

describe('HomeView', () => {
  it('renders the headline prompt and tagline', () => {
    render(<HomeView />);
    expect(screen.getByText('Chcesz zrobić coś fajnego?')).toBeInTheDocument();
    // The headline is split into a static prefix + an animated last word that
    // toggles between generic + selected city — match just the static prefix.
    expect(screen.getByRole('heading', { level: 1, name: /^Idź na/i })).toBeInTheDocument();
  });

  it('renders all three CTA tiles', () => {
    render(<HomeView />);
    expect(screen.getByText('Co się dzieje teraz na mieście?')).toBeInTheDocument();
    expect(screen.getByText('Co się dzieje w ten weekend?')).toBeInTheDocument();
    expect(screen.getByText('Gdzie mogę dzisiaj poćwiczyć?')).toBeInTheDocument();
  });

  it('has the browse-all secondary link', () => {
    render(<HomeView />);
    expect(screen.getByText('Przeglądaj wszystkie wydarzenia')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<HomeView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows no seasonal tile outside a season', () => {
    render(<HomeView />);
    expect(screen.queryByText('Zobacz program')).not.toBeInTheDocument();
  });

  it('leads the tiles with the season on offer, linking to its filtered list', () => {
    seasonMocks.seasons = [HALLOWEEN];
    render(<HomeView />);
    const tile = screen.getByRole('link', { name: /Halloween/ });
    expect(tile).toHaveAttribute('href', '/szczecin/wydarzenia?season=halloween');
    expect(tile).toHaveTextContent('Bale przebierańców i warsztaty z dyniami.');
    expect(tile).toHaveTextContent('63 wydarzenia');
    // First in the grid, ahead of the regular tiles.
    const links = screen.getAllByRole('link');
    expect(links.indexOf(tile)).toBeLessThan(
      links.findIndex((link) => link.textContent?.includes('Co się dzieje teraz'))
    );
  });

  it('says when an announced season starts', () => {
    seasonMocks.seasons = [{ ...HALLOWEEN, upcoming: true }];
    render(<HomeView />);
    expect(screen.getByRole('link', { name: /Halloween/ })).toHaveTextContent(/Startuje 15 paź/);
  });

  it('passes accessibility check with a seasonal tile', async () => {
    seasonMocks.seasons = [HALLOWEEN];
    const { container } = render(<HomeView />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
