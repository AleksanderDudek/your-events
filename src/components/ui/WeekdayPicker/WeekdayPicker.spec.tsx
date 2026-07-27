import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import WeekdayPicker from './WeekdayPicker';

describe('WeekdayPicker', () => {
  it('renders all seven days, Monday first', () => {
    render(<WeekdayPicker value={[]} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Pn',
      'Wt',
      'Śr',
      'Cz',
      'Pt',
      'So',
      'Nd',
    ]);
  });

  it('passes accessibility check', async () => {
    const { container } = render(<WeekdayPicker value={[1]} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('marks the selected days as pressed', () => {
    render(<WeekdayPicker value={[1, 5]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Poniedziałek' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Środa' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds a day without dropping the ones already picked', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[1]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Piątek' }));

    expect(onChange).toHaveBeenCalledWith([1, 5]);
  });

  it('un-picks a day that is already on', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[1, 5]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Poniedziałek' }));

    expect(onChange).toHaveBeenCalledWith([5]);
  });

  it('reports the selection in display order, Sunday last', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[0, 3]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Poniedziałek' }));

    expect(onChange).toHaveBeenCalledWith([1, 3, 0]);
  });
});
