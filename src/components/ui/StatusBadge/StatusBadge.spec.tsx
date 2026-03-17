import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders without crashing', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Dostępne')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<StatusBadge status="active" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows correct label for each status', () => {
    const { rerender } = render(<StatusBadge status="few_spots" />);
    expect(screen.getByText('Ostatnie miejsca')).toBeInTheDocument();

    rerender(<StatusBadge status="sold_out" />);
    expect(screen.getByText('Brak miejsc')).toBeInTheDocument();

    rerender(<StatusBadge status="cancelled" />);
    expect(screen.getByText('Odwołane')).toBeInTheDocument();
  });
});
