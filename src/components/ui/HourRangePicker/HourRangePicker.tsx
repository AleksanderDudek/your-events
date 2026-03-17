'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { S } from '@/lib/strings';

interface HourRangePickerProps {
  hourFrom: string | null;
  hourTo: string | null;
  disabled: boolean;
  onHourFromChange: (hour: string | null) => void;
  onHourToChange: (hour: string | null) => void;
}

export default function HourRangePicker({
  hourFrom,
  hourTo,
  disabled,
  onHourFromChange,
  onHourToChange,
}: HourRangePickerProps) {
  const content = (
    <Box sx={{ display: 'flex', gap: 1, opacity: disabled ? 0.5 : 1 }}>
      <TextField
        type="time"
        size="small"
        fullWidth
        label={S.FILTER_DATE_FROM}
        value={hourFrom ?? ''}
        onChange={(e) => onHourFromChange(e.target.value || null)}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': `${S.FILTER_HOUR} ${S.FILTER_DATE_FROM}` }}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
          },
        }}
      />
      <TextField
        type="time"
        size="small"
        fullWidth
        label={S.FILTER_DATE_TO}
        value={hourTo ?? ''}
        onChange={(e) => onHourToChange(e.target.value || null)}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': `${S.FILTER_HOUR} ${S.FILTER_DATE_TO}` }}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
          },
        }}
      />
    </Box>
  );

  if (disabled) {
    return (
      <Tooltip title={S.FILTER_HOUR_DISABLED} placement="top">
        <Box>{content}</Box>
      </Tooltip>
    );
  }

  return content;
}
