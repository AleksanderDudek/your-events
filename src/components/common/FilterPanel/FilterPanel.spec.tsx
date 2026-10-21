import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import FilterPanel from './FilterPanel';

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
