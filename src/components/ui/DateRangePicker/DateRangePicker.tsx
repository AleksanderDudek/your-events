'use client';

import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO, isValid } from 'date-fns';
import { useTranslation } from '@/i18n';
import {
  DEFAULT_WINDOW_MONTHS,
  RelativeDateWindow,
  hasDateValue,
  matchRelativeWindow,
  relativeWindowFilters,
} from '@/lib/dateWindows';
import { DateMode, EventFilters } from '@/types/filter.types';

export type DatePatch = Partial<
  Pick<EventFilters, 'dateMode' | 'dateSingle' | 'dateFrom' | 'dateTo'>
>;

interface DateRangePickerProps {
  dateMode: DateMode;
  dateSingle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  // One patch per interaction, never a setter per field: each call navigates,
  // and four navigations fired from one handler used to race each other into a
  // no-op (deselecting "Jeden dzień" left the date filter stuck in the URL).
  onChange: (patch: DatePatch) => void;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

function fromDate(date: Date | null): string | null {
  if (!date || !isValid(date)) return null;
  return format(date, 'yyyy-MM-dd');
}

const toggleGroupSx = {
  '& .MuiToggleButton-root': {
    color: 'var(--color-text-secondary)',
    borderColor: 'var(--color-border)',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-body)',
    textTransform: 'none',
    '&.Mui-selected': {
      backgroundColor: 'var(--color-accent-tint-strong)',
      color: 'var(--color-accent-primary)',
      borderColor: 'var(--color-accent-primary)',
    },
  },
} as const;

const pickerSlotProps = {
  textField: {
    size: 'small' as const,
    fullWidth: true,
    sx: {
      '& .MuiOutlinedInput-root': {
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8125rem',
      },
    },
  },
};

export default function DateRangePicker({
  dateMode,
  dateSingle,
  dateFrom,
  dateTo,
  onChange,
}: Readonly<DateRangePickerProps>) {
  const { t } = useTranslation();
  const now = new Date();
  // Pressed whenever the dates on screen are that window — picked here, by
  // calendar, or by opening a saved filter today.
  const quickPick = matchRelativeWindow({ dateSingle, dateFrom, dateTo }, now);
  const quickPicks: { value: RelativeDateWindow; label: string }[] = [
    { value: 'today', label: t.FILTER_DATE_TODAY },
    { value: 'weekend', label: t.FILTER_DATE_WEEKEND },
    { value: 'next7', label: t.FILTER_DATE_NEXT7 },
  ];

  // These are the windows a saved filter can keep as relative, so picking one
  // here is what lets "today" be saved as today rather than as this date.
  // Pressing the pressed one clears the date, like deselecting a mode.
  const handleQuickPick = (_: React.MouseEvent<HTMLElement>, next: RelativeDateWindow | null) => {
    onChange(
      next === null
        ? { dateMode: null, dateSingle: null, dateFrom: null, dateTo: null }
        : relativeWindowFilters(next, now)
    );
  };

  // Switching mode drops the values belonging to the other mode, so a stale
  // dateSingle can never leak back in when the user returns to "single".
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (newMode === null) {
      onChange({ dateMode: null, dateSingle: null, dateFrom: null, dateTo: null });
    } else if (newMode === 'single') {
      onChange({ dateMode: 'single', dateFrom: null, dateTo: null });
    } else {
      onChange({ dateMode: 'range' as DateMode, dateSingle: null });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* The list is never unbounded: with no date it shows the default window
          (see withDefaultDateWindow), and saying so is what makes "no date"
          read as a choice rather than as nothing. */}
      {!hasDateValue({ dateSingle, dateFrom, dateTo }) && (
        <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
          {t.FILTER_DATE_DEFAULT(DEFAULT_WINDOW_MONTHS)}
        </Typography>
      )}

      <ToggleButtonGroup
        value={quickPick}
        exclusive
        onChange={handleQuickPick}
        size="small"
        fullWidth
        aria-label={t.FILTER_DATE_QUICK}
        sx={toggleGroupSx}
      >
        {quickPicks.map((pick) => (
          <ToggleButton key={pick.value} value={pick.value}>
            {pick.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ToggleButtonGroup
        value={dateMode}
        exclusive
        onChange={handleModeChange}
        size="small"
        fullWidth
        sx={toggleGroupSx}
      >
        <ToggleButton value="single">{t.FILTER_DATE_SINGLE}</ToggleButton>
        <ToggleButton value="range">{t.FILTER_DATE_RANGE}</ToggleButton>
      </ToggleButtonGroup>

      {dateMode === 'single' && (
        <DatePicker
          label={t.FILTER_DATE_SINGLE}
          value={toDate(dateSingle)}
          onChange={(date) => onChange({ dateSingle: fromDate(date) })}
          slotProps={pickerSlotProps}
        />
      )}

      {dateMode === 'range' && (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <DatePicker
            label={t.FILTER_DATE_FROM}
            value={toDate(dateFrom)}
            onChange={(date) => onChange({ dateFrom: fromDate(date) })}
            maxDate={toDate(dateTo) ?? undefined}
            slotProps={pickerSlotProps}
          />
          <DatePicker
            label={t.FILTER_DATE_TO}
            value={toDate(dateTo)}
            onChange={(date) => onChange({ dateTo: fromDate(date) })}
            minDate={toDate(dateFrom) ?? undefined}
            slotProps={pickerSlotProps}
          />
        </Box>
      )}
    </Box>
  );
}
