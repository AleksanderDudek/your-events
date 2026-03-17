import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import AppHeader from './AppHeader';

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

describe('AppHeader', () => {
  it('renders without crashing', () => {
    render(<AppHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows navigation links', () => {
    render(<AppHeader />);
    expect(screen.getByText('Strona główna')).toBeInTheDocument();
    expect(screen.getByText('Wydarzenia')).toBeInTheDocument();
  });

  it('has correct nav aria-label', () => {
    render(<AppHeader />);
    expect(screen.getByLabelText('Główna nawigacja')).toBeInTheDocument();
  });
});
