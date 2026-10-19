import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/router';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

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

vi.mock('@/components/service/useEvents', () => ({
  useEvents: () => ({
    events: [],
    total: 0,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    filters: {
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
      page: 1,
      pageSize: 15,
      viewMode: 'grid',
      sort: 'date',
      dir: 'asc',
    },
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

describe('EventsListView', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EventsListView />);
    expect(screen.getByText('Znaleziono 0 wydarzeń')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = renderWithRouter(<EventsListView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows empty state when no events', () => {
    renderWithRouter(<EventsListView />);
    expect(screen.getByText('Nie znaleziono wydarzeń')).toBeInTheDocument();
  });

  it('has aria-live on results count', () => {
    renderWithRouter(<EventsListView />);
    const count = screen.getByText('Znaleziono 0 wydarzeń');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });
});
