import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  onChange: vi.fn(),
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

  // Each call navigates, so the whole reset has to travel in ONE patch —
  // emitting a setter per field raced itself into a no-op and left the date
  // filter stuck in the URL.
  it('clears mode and every date in a single patch when the mode is deselected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WithLocalization>
        <DateRangePicker
          {...defaultProps}
          dateMode="single"
          dateSingle="2026-07-23"
          onChange={onChange}
        />
      </WithLocalization>
    );
    await user.click(screen.getByRole('button', { name: 'Jeden dzień' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      dateMode: null,
      dateSingle: null,
      dateFrom: null,
      dateTo: null,
    });
  });

  it('drops the other mode’s value when switching mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WithLocalization>
        <DateRangePicker
          {...defaultProps}
          dateMode="single"
          dateSingle="2026-07-23"
          onChange={onChange}
        />
      </WithLocalization>
    );
    await user.click(screen.getByRole('button', { name: 'Zakres dat' }));
    expect(onChange).toHaveBeenCalledWith({ dateMode: 'range', dateSingle: null });
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
