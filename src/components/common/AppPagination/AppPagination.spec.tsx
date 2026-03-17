import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import AppPagination from './AppPagination';

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

describe('AppPagination', () => {
  const defaultProps = {
    page: 1,
    pageSize: 15 as const,
    total: 80,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<AppPagination {...defaultProps} />);
    expect(screen.getByText('Strona 1 z 6')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppPagination {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('hides when only one page', () => {
    const { container } = render(
      <AppPagination {...defaultProps} total={10} />
    );
    expect(container.innerHTML).toBe('');
  });
});
