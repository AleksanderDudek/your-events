import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import ViewToggle from './ViewToggle';

describe('ViewToggle', () => {
  it('renders without crashing', () => {
    render(<ViewToggle value="grid" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Widok siatki')).toBeInTheDocument();
    expect(screen.getByLabelText('Widok listy')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<ViewToggle value="grid" onChange={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('calls onChange when toggled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle value="grid" onChange={onChange} />);
    await user.click(screen.getByLabelText('Widok listy'));
    expect(onChange).toHaveBeenCalledWith('row');
  });
});
