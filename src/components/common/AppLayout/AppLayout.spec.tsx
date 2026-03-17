import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import AppLayout from './AppLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

describe('AppLayout', () => {
  it('renders without crashing', () => {
    render(<AppLayout><div>Test</div></AppLayout>);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppLayout><div>Test content</div></AppLayout>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has skip-to-content link', () => {
    render(<AppLayout><div>Test</div></AppLayout>);
    expect(screen.getByText('Przejdź do treści')).toBeInTheDocument();
  });

  it('renders children in main', () => {
    render(<AppLayout><div>Child content</div></AppLayout>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});
