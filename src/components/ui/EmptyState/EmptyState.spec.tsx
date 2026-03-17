import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders without crashing', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nie znaleziono wydarzeń')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<EmptyState />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows clear button when onClear provided', () => {
    render(<EmptyState onClear={vi.fn()} />);
    expect(screen.getByText('Wyczyść filtry')).toBeInTheDocument();
  });

  it('calls onClear when button clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<EmptyState onClear={onClear} />);
    await user.click(screen.getByText('Wyczyść filtry'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
