'use client';


import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

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

export default function DateRangePicker({
  dateMode,
  dateSingle,
  dateFrom,
  dateTo,
  onDateModeChange,
  onDateSingleChange,
  onDateFromChange,
  onDateToChange,
}: DateRangePickerProps) {
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
        <TextField
          type="date"
          size="small"
          fullWidth
          value={dateSingle ?? ''}
          onChange={(e) => onDateSingleChange(e.target.value || null)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-label': S.FILTER_DATE_SINGLE }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
            },
          }}
        />
      )}

      {dateMode === 'range' && (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <TextField
            type="date"
            size="small"
            fullWidth
            label={S.FILTER_DATE_FROM}
            value={dateFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value || null)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': S.FILTER_DATE_FROM }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
              },
            }}
          />
          <TextField
            type="date"
            size="small"
            fullWidth
            label={S.FILTER_DATE_TO}
            value={dateTo ?? ''}
            onChange={(e) => onDateToChange(e.target.value || null)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': S.FILTER_DATE_TO }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
