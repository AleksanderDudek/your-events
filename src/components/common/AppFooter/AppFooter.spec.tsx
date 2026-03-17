import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import AppFooter from './AppFooter';

describe('AppFooter', () => {
  it('renders without crashing', () => {
    render(<AppFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppFooter />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays copyright with current year', () => {
    render(<AppFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} your-events`)).toBeInTheDocument();
  });

  it('shows source chips', () => {
    render(<AppFooter />);
    expect(screen.getByText('Szkoła tańca')).toBeInTheDocument();
    expect(screen.getByText('Klub fitness')).toBeInTheDocument();
  });
});
