import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import CategoryChip from './CategoryChip';

describe('CategoryChip', () => {
  it('renders without crashing', () => {
    render(<CategoryChip category="Taniec" />);
    expect(screen.getByText('Taniec')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<CategoryChip category="Taniec" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CategoryChip category="Sport i Fitness" onClick={onClick} />);
    await user.click(screen.getByText('Sport i Fitness'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders selected state', () => {
    render(<CategoryChip category="Muzyka" selected />);
    expect(screen.getByText('Muzyka')).toBeInTheDocument();
  });
});
