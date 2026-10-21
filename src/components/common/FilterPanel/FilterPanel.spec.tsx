import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import FilterPanel from './FilterPanel';

// Which layout and which query the panel sees; reset after every test.
const view = vi.hoisted(() => ({ isMdUp: true, query: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(view.query),
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => view.isMdUp,
}));

afterEach(() => {
  view.isMdUp = true;
  view.query = '';
  window.history.replaceState(null, '', '/');
});

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

describe('FilterPanel', () => {
  it('renders without crashing', () => {
    render(<FilterPanel />);
    expect(screen.getByText('Filtry')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<FilterPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows filter sections', () => {
    render(<FilterPanel />);
    expect(screen.getByText('Kategorie')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Dni tygodnia')).toBeInTheDocument();
    expect(screen.getByText('Godzina')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<FilterPanel />);
    expect(screen.getByPlaceholderText('Szukaj wydarzenia lub miejsca...')).toBeInTheDocument();
  });

  it('offers a nearby section with the three ways to set a point', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FilterPanel />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'W pobliżu' }));

    expect(await screen.findByRole('button', { name: 'Użyj mojej lokalizacji' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Adres lub miejsce' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wskaż na mapie' })).toBeInTheDocument();
  });
});

describe('FilterPanel on a phone', () => {
  beforeEach(() => {
    view.isMdUp = false;
  });

  it('puts the search box on the page, not in the drawer', async () => {
    const user = userEvent.setup();
    render(<FilterPanel />);

    expect(screen.getByPlaceholderText('Szukaj wydarzenia lub miejsca...')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Filtry/ }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Kategorie')).toBeInTheDocument();
    expect(within(drawer).queryByPlaceholderText('Szukaj wydarzenia lub miejsca...')).not.toBeInTheDocument();
  });

  // A bare icon in a corner was easy to miss; the count leaves the search out
  // because the drawer no longer shows it.
  it('labels the trigger and counts what the drawer holds, not the search', () => {
    view.query = 'search=jazz&freeOnly=true&weekdays=1';
    render(<FilterPanel />);

    const trigger = screen.getByRole('button', { name: 'Filtry (2)' });
    expect(trigger).toHaveTextContent(/^Filtry2$/);
  });

  it('passes accessibility check', async () => {
    view.query = 'freeOnly=true';
    const { container } = render(<FilterPanel />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("clears what the drawer holds but leaves the page's search alone", async () => {
    view.query = 'search=jazz&freeOnly=true';
    window.history.replaceState(null, '', `/?${view.query}`);
    const user = userEvent.setup();
    render(<FilterPanel />);

    await user.click(screen.getByRole('button', { name: /^Filtry/ }));
    const drawer = await screen.findByRole('dialog');
    const clears = within(drawer).getAllByRole('button', { name: 'Wyczyść filtry' });
    await user.click(clears[clears.length - 1]);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('search')).toBe('jazz');
    expect(params.has('freeOnly')).toBe(false);
  });
});
