import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import CategoryChip from './CategoryChip';

describe('CategoryChip', () => {
  it('renders without crashing', () => {
    render(<CategoryChip category="dance" />);
    expect(screen.getByText('Taniec')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<CategoryChip category="dance" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CategoryChip category="fitness-yoga" onClick={onClick} />);
    await user.click(screen.getByText('Joga'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders selected state', () => {
    render(<CategoryChip category="dance" selected />);
    expect(screen.getByText('Taniec')).toBeInTheDocument();
  });
});
