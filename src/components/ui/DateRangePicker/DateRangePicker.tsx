'use client';

import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO, isValid } from 'date-fns';
import { S } from '@/lib/strings';
import { DateMode } from '@/types/filter.types';

interface DateRangePickerProps {
  dateMode: DateMode;
  dateSingle: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  onDateModeChange: (mode: DateMode) => void;
  onDateSingleChange: (date: string | null) => void;
  onDateFromChange: (date: string | null) => void;
  onDateToChange: (date: string | null) => void;
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
  onDateModeChange,
  onDateSingleChange,
  onDateFromChange,
  onDateToChange,
}: Readonly<DateRangePickerProps>) {
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (newMode === null) {
      onDateModeChange(null);
      onDateSingleChange(null);
      onDateFromChange(null);
      onDateToChange(null);
    } else {
      onDateModeChange(newMode as DateMode);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ToggleButtonGroup
        value={dateMode}
        exclusive
        onChange={handleModeChange}
        size="small"
        fullWidth
        sx={{
          '& .MuiToggleButton-root': {
            color: 'var(--color-text-secondary)',
            borderColor: 'var(--color-border)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-body)',
            textTransform: 'none',
            '&.Mui-selected': {
              backgroundColor: 'rgba(244, 162, 40, 0.15)',
              color: 'var(--color-accent-primary)',
              borderColor: 'var(--color-accent-primary)',
            },
          },
        }}
      >
        <ToggleButton value="single">{S.FILTER_DATE_SINGLE}</ToggleButton>
        <ToggleButton value="range">{S.FILTER_DATE_RANGE}</ToggleButton>
      </ToggleButtonGroup>

      {dateMode === 'single' && (
        <DatePicker
          value={toDate(dateSingle)}
          onChange={(date) => onDateSingleChange(fromDate(date))}
          slotProps={pickerSlotProps}
        />
      )}

      {dateMode === 'range' && (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <DatePicker
            label={S.FILTER_DATE_FROM}
            value={toDate(dateFrom)}
            onChange={(date) => onDateFromChange(fromDate(date))}
            maxDate={toDate(dateTo) ?? undefined}
            slotProps={pickerSlotProps}
          />
          <DatePicker
            label={S.FILTER_DATE_TO}
            value={toDate(dateTo)}
            onChange={(date) => onDateToChange(fromDate(date))}
            minDate={toDate(dateFrom) ?? undefined}
            slotProps={pickerSlotProps}
          />
        </Box>
      )}
    </Box>
  );
}
