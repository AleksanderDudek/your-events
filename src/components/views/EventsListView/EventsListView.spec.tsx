import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

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

const seasonMocks = vi.hoisted(() => ({ seasons: [] as unknown[] }));
vi.mock('@/components/service/useSeasons', () => ({
  useSeasons: () => ({ seasons: seasonMocks.seasons, isLoading: false }),
}));

const baseFilters = {
  search: '',
  categories: [],
  dateMode: null,
  dateSingle: null,
  dateFrom: null,
  dateTo: null,
  weekdays: [],
  hourFrom: null,
  hourTo: null,
  freeOnly: false,
  near: null,
  season: null,
  page: 1,
  pageSize: 15,
  viewMode: 'grid',
  sort: 'date',
  dir: 'asc',
};

// Swappable per test: the mock below reads whatever is here at render time.
const mocks = vi.hoisted(() => ({
  filters: {} as Record<string, unknown>,
  map: {} as Record<string, unknown>,
}));

vi.mock('@/components/service/useEvents', () => ({
  useEvents: () => ({
    events: [],
    total: 0,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    filters: mocks.filters,
  }),
  // The map runs a separate query — it shows every match rather than the page
  // the list is on — so it has to be stubbed alongside useEvents.
  useMapEvents: () => mocks.map,
}));

import EventsListView from './EventsListView';

const baseMap = {
  events: [],
  total: 0,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};

beforeEach(() => {
  mocks.filters = { ...baseFilters };
  mocks.map = { ...baseMap };
  seasonMocks.seasons = [];
});

describe('EventsListView', () => {
  it('renders without crashing', () => {
    render(<EventsListView />);
    expect(screen.getByText('Znaleziono 0 wydarzeń')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<EventsListView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows empty state when no events', () => {
    render(<EventsListView />);
    expect(screen.getByText('Nie znaleziono wydarzeń')).toBeInTheDocument();
  });

  it('has aria-live on results count', () => {
    render(<EventsListView />);
    const count = screen.getByText('Znaleziono 0 wydarzeń');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the proximity filter as a chip naming the radius and the place', () => {
    mocks.filters = {
      ...baseFilters,
      near: { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' },
    };
    render(<EventsListView />);
    // \s: Testing Library collapses the no-break space to a plain one.
    expect(screen.getByText(/^W promieniu 1,5\skm: Rynek$/)).toBeInTheDocument();
  });

  // With a point set, an empty map reads as "nothing nearby": a failed map
  // query must not pass for one.
  it('shows the error state when the map query itself fails', () => {
    mocks.filters = { ...baseFilters, viewMode: 'map' };
    mocks.map = { ...baseMap, isError: true };
    render(<EventsListView />);
    expect(screen.getByText('Coś poszło nie tak')).toBeInTheDocument();
    expect(screen.queryByText(/reszta bez lokalizacji/)).not.toBeInTheDocument();
  });

  it('offers no season bar outside a season', () => {
    render(<EventsListView />);
    expect(screen.queryByRole('group', { name: 'Sezonowe' })).not.toBeInTheDocument();
  });

  it('offers the season as a toggle above the results', () => {
    seasonMocks.seasons = [HALLOWEEN];
    render(<EventsListView />);
    const toggle = screen.getByRole('button', { name: 'Halloween: 63 wydarzenia' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the chosen season pressed, with its description and a chip', () => {
    seasonMocks.seasons = [HALLOWEEN];
    mocks.filters = { ...baseFilters, season: 'halloween' };
    render(<EventsListView />);
    expect(screen.getByRole('button', { name: 'Halloween: 63 wydarzenia' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Bale przebierańców i warsztaty z dyniami.')).toBeInTheDocument();
    expect(screen.getByText('🎃 Halloween')).toBeInTheDocument();
  });

  it('still shows a chip for a season in the URL that is not on offer', () => {
    mocks.filters = { ...baseFilters, season: 'swieta' };
    render(<EventsListView />);
    expect(screen.queryByRole('group', { name: 'Sezonowe' })).not.toBeInTheDocument();
    expect(screen.getByText('Swieta')).toBeInTheDocument();
  });
});
