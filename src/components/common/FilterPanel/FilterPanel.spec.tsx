import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Źródło')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Godzina')).toBeInTheDocument();
    expect(screen.getByText('Wiek')).toBeInTheDocument();
    expect(screen.getByText('Poziom')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<FilterPanel />);
    expect(screen.getByPlaceholderText('Szukaj wydarzeń...')).toBeInTheDocument();
  });
});
