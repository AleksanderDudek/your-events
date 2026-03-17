import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import HourRangePicker from './HourRangePicker';

const defaultProps = {
  hourFrom: null,
  hourTo: null,
  disabled: false,
  onHourFromChange: vi.fn(),
  onHourToChange: vi.fn(),
};

describe('HourRangePicker', () => {
  it('renders without crashing', () => {
    render(<HourRangePicker {...defaultProps} />);
    expect(screen.getByLabelText('Godzina Od')).toBeInTheDocument();
    expect(screen.getByLabelText('Godzina Do')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<HourRangePicker {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('disables inputs when disabled prop is true', () => {
    render(<HourRangePicker {...defaultProps} disabled />);
    expect(screen.getByLabelText('Godzina Od')).toBeDisabled();
    expect(screen.getByLabelText('Godzina Do')).toBeDisabled();
  });
});
