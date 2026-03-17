import { render, screen } from '@testing-library/react';

import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import DateRangePicker from './DateRangePicker';

const defaultProps = {
  dateMode: null as const,
  dateSingle: null,
  dateFrom: null,
  dateTo: null,
  onDateModeChange: vi.fn(),
  onDateSingleChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
};

describe('DateRangePicker', () => {
  it('renders without crashing', () => {
    render(<DateRangePicker {...defaultProps} />);
    expect(screen.getByText('Jeden dzień')).toBeInTheDocument();
    expect(screen.getByText('Zakres dat')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<DateRangePicker {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows single date input when mode is single', () => {
    render(<DateRangePicker {...defaultProps} dateMode="single" />);
    expect(screen.getByLabelText('Jeden dzień')).toBeInTheDocument();
  });

  it('shows range inputs when mode is range', () => {
    render(<DateRangePicker {...defaultProps} dateMode="range" />);
    expect(screen.getByLabelText('Od')).toBeInTheDocument();
    expect(screen.getByLabelText('Do')).toBeInTheDocument();
  });
});
