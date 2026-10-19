import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/router';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import FilterPanel from './FilterPanel';

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
    renderWithRouter(<FilterPanel />);
    expect(screen.getByText('Filtry')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = renderWithRouter(<FilterPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows filter sections', () => {
    renderWithRouter(<FilterPanel />);
    expect(screen.getByText('Kategorie')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Dni tygodnia')).toBeInTheDocument();
    expect(screen.getByText('Godzina')).toBeInTheDocument();
  });

  it('shows search input', () => {
    renderWithRouter(<FilterPanel />);
    expect(screen.getByPlaceholderText('Szukaj wydarzenia lub miejsca...')).toBeInTheDocument();
  });
});
