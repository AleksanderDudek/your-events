'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { useTranslation } from '@/i18n';
import { usePresets } from '@/components/service/usePresets';
import {
  MAX_NAME_LENGTH,
  MAX_PRESETS,
  describeFixedRange,
  newPresetId,
  presetFiltersFromEventFilters,
} from '@/lib/presets';
import { DEFAULT_WINDOW_MONTHS, hasDateValue, inferDateWindow } from '@/lib/dateWindows';
import { MY_FILTERS_PATH } from '@/config/community';
import type { EventFilters } from '@/types/filter.types';
import type { PresetDateWindow } from '@/types/preset.types';

interface SavePresetButtonProps {
  filters: EventFilters;
  cityId: string;
}

/**
 * Turns the filters currently on screen into a named preset.
 *
 * This is the entry point that matters: nobody builds a filter set twice, once
 * on the list and again in a form. The management page exists for editing what
 * lands here.
 *
 * The dates on screen are always absolute, but what someone saving "today"
 * means is almost never "27 July". So the dialog asks how the dates should
 * behave, preselecting the relative window they match — or "from today" when
 * there are none, which is what a filter without a date opens on.
 */
export default function SavePresetButton({ filters, cityId }: SavePresetButtonProps) {
  const { t } = useTranslation();
  const { presets, save } = usePresets();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [dateWindow, setDateWindow] = useState<PresetDateWindow>('none');

  const isFull = presets.length >= MAX_PRESETS;
  const trimmed = name.trim();

  const shownRange = describeFixedRange(
    filters.dateSingle ?? filters.dateFrom,
    filters.dateSingle ?? filters.dateTo,
    { from: t.PRESETS_RANGE_FROM, to: t.PRESETS_RANGE_TO }
  );
  // The list honours hours only alongside a date, and so does a preset. Saved
  // with no date they would be dropped — say so rather than lose them quietly.
  const losesHours = dateWindow === 'none' && Boolean(filters.hourFrom || filters.hourTo);
  const dateWindows: { value: PresetDateWindow; label: string }[] = [
    { value: 'none', label: t.PRESETS_DATE_NONE(DEFAULT_WINDOW_MONTHS) },
    { value: 'today', label: t.PRESETS_DATE_TODAY },
    { value: 'weekend', label: t.PRESETS_DATE_WEEKEND },
    { value: 'next7', label: t.PRESETS_DATE_NEXT7 },
    // Only when there is something to keep: fixing no dates is "from today".
    ...(hasDateValue(filters)
      ? [{ value: 'fixed' as const, label: t.PRESETS_DATE_FIXED_THESE(shownRange) }]
      : []),
  ];

  // Worked out when the dialog opens, not on every render: the user's own pick
  // must not be overwritten while they type the name.
  const openDialog = () => {
    setDateWindow(inferDateWindow(filters, new Date()));
    setOpen(true);
  };

  const submit = () => {
    if (!trimmed) return;
    save({
      id: newPresetId(),
      name: trimmed.slice(0, MAX_NAME_LENGTH),
      cityId,
      filters: presetFiltersFromEventFilters(filters, dateWindow),
      createdAt: new Date().toISOString(),
    });
    setOpen(false);
    setName('');
    setSaved(true);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        data-tour="save"
        startIcon={<BookmarkAddOutlinedIcon />}
        onClick={openDialog}
        disabled={isFull}
        // The limit is not obvious from a disabled button on its own.
        title={isFull ? t.PRESETS_FULL(MAX_PRESETS) : undefined}
      >
        {t.PRESETS_SAVE_CURRENT}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t.PRESETS_SAVE_CURRENT}
        </DialogTitle>
        <DialogContent>
          <TextField
            label={t.PRESETS_NAME}
            placeholder={t.PRESETS_NAME_PLACEHOLDER}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
            autoFocus
            fullWidth
            margin="dense"
          />
          <TextField
            select
            label={t.PRESETS_DATE_WINDOW}
            value={dateWindow}
            onChange={(e) => setDateWindow(e.target.value as PresetDateWindow)}
            fullWidth
            margin="dense"
          >
            {dateWindows.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: losesHours ? 'error.main' : 'var(--color-text-muted)' }}
          >
            {losesHours ? t.PRESETS_HOURS_NEED_DATE : t.PRESETS_DATE_HINT}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{t.PRESETS_CANCEL}</Button>
          <Button onClick={submit} variant="contained" disabled={!trimmed}>
            {t.PRESETS_SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={saved}
        autoHideDuration={5000}
        onClose={() => setSaved(false)}
        message={t.PRESETS_SAVED_TOAST}
        action={
          <Button
            component={Link}
            href={MY_FILTERS_PATH as Route}
            size="small"
            sx={{ color: 'var(--accent)' }}
          >
            {t.NAV_PRESETS}
          </Button>
        }
      />
    </>
  );
}
