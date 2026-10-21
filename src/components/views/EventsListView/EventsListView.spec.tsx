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
  page: 1,
  pageSize: 15,
  viewMode: 'grid',
  sort: 'date',
  dir: 'asc',
};

// Swappable per test: the mock below reads whatever is here at render time.
const mocks = vi.hoisted(() => ({ filters: {} as Record<string, unknown> }));

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
  useMapEvents: () => ({
    events: [],
    total: 0,
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
}));

import EventsListView from './EventsListView';

beforeEach(() => {
  mocks.filters = { ...baseFilters };
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
});
