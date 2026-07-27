import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

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
});
