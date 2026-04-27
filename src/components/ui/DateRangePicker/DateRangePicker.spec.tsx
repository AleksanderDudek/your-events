import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DateRangePicker from './DateRangePicker';

function WithLocalization({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider>
  );
}

const defaultProps = {
  dateMode: null,
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
    render(
      <WithLocalization>
        <DateRangePicker {...defaultProps} dateMode="single" />
      </WithLocalization>
    );
    expect(screen.getAllByLabelText('Jeden dzień').length).toBeGreaterThan(0);
  });

  it('shows range inputs when mode is range', () => {
    render(
      <WithLocalization>
        <DateRangePicker {...defaultProps} dateMode="range" />
      </WithLocalization>
    );
    expect(screen.getAllByLabelText('Od').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Do').length).toBeGreaterThan(0);
  });
});
