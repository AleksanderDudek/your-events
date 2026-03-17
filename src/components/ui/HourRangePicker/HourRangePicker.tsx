'use client';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import { S } from '@/lib/strings';

interface HourRangePickerProps {
  hourFrom: string | null;
  hourTo: string | null;
  disabled: boolean;
  onHourFromChange: (hour: string | null) => void;
  onHourToChange: (hour: string | null) => void;
}

function generateHourOptions(): string[] {
  const options: string[] = [];
  for (let h = 6; h <= 23; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 23) options.push(`${String(h).padStart(2, '0')}:30`);
  }
  options.push('23:30');
  return options;
}

const HOUR_OPTIONS = generateHourOptions();

const selectSx = {
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)',
};

export default function HourRangePicker({
  hourFrom,
  hourTo,
  disabled,
  onHourFromChange,
  onHourToChange,
}: Readonly<HourRangePickerProps>) {
  const fromOptions = hourTo
    ? HOUR_OPTIONS.filter((h) => h <= hourTo)
    : HOUR_OPTIONS;

  const toOptions = hourFrom
    ? HOUR_OPTIONS.filter((h) => h >= hourFrom)
    : HOUR_OPTIONS;

  const content = (
    <Box sx={{ display: 'flex', gap: 1, opacity: disabled ? 0.5 : 1 }}>
      <FormControl size="small" fullWidth disabled={disabled}>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>{S.FILTER_DATE_FROM}</InputLabel>
        <Select
          value={hourFrom ?? ''}
          label={S.FILTER_DATE_FROM}
          onChange={(e) => onHourFromChange(e.target.value || null)}
          sx={selectSx}
          inputProps={{ 'aria-label': `${S.FILTER_HOUR} ${S.FILTER_DATE_FROM}` }}
        >
          <MenuItem value=""><em>—</em></MenuItem>
          {fromOptions.map((h) => (
            <MenuItem key={h} value={h} sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
              {h}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" fullWidth disabled={disabled}>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>{S.FILTER_DATE_TO}</InputLabel>
        <Select
          value={hourTo ?? ''}
          label={S.FILTER_DATE_TO}
          onChange={(e) => onHourToChange(e.target.value || null)}
          sx={selectSx}
          inputProps={{ 'aria-label': `${S.FILTER_HOUR} ${S.FILTER_DATE_TO}` }}
        >
          <MenuItem value=""><em>—</em></MenuItem>
          {toOptions.map((h) => (
            <MenuItem key={h} value={h} sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
              {h}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
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
