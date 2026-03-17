import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from './ErrorState';

describe('ErrorState', () => {
  it('renders without crashing', () => {
    render(<ErrorState />);
    expect(screen.getByText('Coś poszło nie tak')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<ErrorState />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows retry button when onRetry provided', () => {
    render(<ErrorState onRetry={vi.fn()} />);
    expect(screen.getByText('Spróbuj ponownie')).toBeInTheDocument();
  });

  it('calls onRetry when clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByText('Spróbuj ponownie'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
