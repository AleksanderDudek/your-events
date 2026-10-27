import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
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

  describe('quick picks', () => {
    // A Monday. Only Date is faked, so userEvent's own timers still run.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('says what the list shows while no date is picked', () => {
      render(<DateRangePicker {...defaultProps} />);
      expect(
        screen.getByText('Bez wybranej daty: od dziś przez najbliższe 3 miesiące.')
      ).toBeInTheDocument();
    });

    it('drops that note once a date is picked', () => {
      render(
        <WithLocalization>
          <DateRangePicker {...defaultProps} dateMode="single" dateSingle="2026-07-30" />
        </WithLocalization>
      );
      expect(screen.queryByText(/Bez wybranej daty/)).not.toBeInTheDocument();
    });

    it('writes today as a single day, in one patch', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DateRangePicker {...defaultProps} onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Dziś' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        dateMode: 'single',
        dateSingle: '2026-07-27',
        dateFrom: null,
        dateTo: null,
      });
    });

    it('writes the coming weekend and the next seven days as ranges', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DateRangePicker {...defaultProps} onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Ten weekend' }));
      expect(onChange).toHaveBeenLastCalledWith({
        dateMode: 'range',
        dateSingle: null,
        dateFrom: '2026-07-31',
        dateTo: '2026-08-02',
      });
      await user.click(screen.getByRole('button', { name: '7 dni' }));
      expect(onChange).toHaveBeenLastCalledWith({
        dateMode: 'range',
        dateSingle: null,
        dateFrom: '2026-07-27',
        dateTo: '2026-08-03',
      });
    });

    it('shows a pick as pressed whenever the dates match it, however they were chosen', () => {
      // A "today" preset opens as a one-day range, not as a single day.
      render(
        <WithLocalization>
          <DateRangePicker
            {...defaultProps}
            dateMode="range"
            dateFrom="2026-07-27"
            dateTo="2026-07-27"
          />
        </WithLocalization>
      );
      expect(screen.getByRole('button', { name: 'Dziś' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Ten weekend' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('clears the date when the pressed pick is pressed again', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <WithLocalization>
          <DateRangePicker
            {...defaultProps}
            dateMode="single"
            dateSingle="2026-07-27"
            onChange={onChange}
          />
        </WithLocalization>
      );
      await user.click(screen.getByRole('button', { name: 'Dziś' }));
      expect(onChange).toHaveBeenCalledWith({
        dateMode: null,
        dateSingle: null,
        dateFrom: null,
        dateTo: null,
      });
    });

    it('passes accessibility check with a pick pressed', async () => {
      const { container } = render(
        <WithLocalization>
          <DateRangePicker {...defaultProps} dateMode="single" dateSingle="2026-07-27" />
        </WithLocalization>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
