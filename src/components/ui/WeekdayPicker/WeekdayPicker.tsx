'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTranslation } from '@/i18n';
import { WEEKDAY_ORDER, sortWeekdays } from '@/lib/weekdays';
import { Weekday } from '@/types/filter.types';

interface WeekdayPickerProps {
  value: Weekday[];
  onChange: (weekdays: Weekday[]) => void;
}

/**
 * Pick any set of weekdays, each one toggled on and off independently — the
 * ToggleButtonGroup is deliberately NOT `exclusive`, which is what makes
 * "Mon + Wed + Fri" a single click each rather than a mode switch.
 */
export default function WeekdayPicker({ value, onChange }: Readonly<WeekdayPickerProps>) {
  const { t } = useTranslation();

  return (
    <ToggleButtonGroup
      value={value}
      onChange={(_, next: Weekday[]) => onChange(sortWeekdays(next))}
      size="small"
      fullWidth
      aria-label={t.FILTER_WEEKDAYS}
      sx={{
        '& .MuiToggleButton-root': {
          color: 'var(--color-text-secondary)',
          borderColor: 'var(--color-border)',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          textTransform: 'none',
          // Seven buttons have to survive the narrow sidebar and the mobile
          // drawer, so they give up their minimum width and share the row.
          minWidth: 0,
          px: 0.25,
          '&.Mui-selected': {
            backgroundColor: 'var(--color-accent-tint-strong)',
            color: 'var(--color-accent-primary)',
            borderColor: 'var(--color-accent-primary)',
          },
        },
      }}
    >
      {WEEKDAY_ORDER.map((day) => (
        <ToggleButton key={day} value={day} aria-label={t.WEEKDAY_LONG[day]}>
          {t.WEEKDAY_SHORT[day]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
