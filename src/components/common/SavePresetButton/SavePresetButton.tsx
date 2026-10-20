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
import Snackbar from '@mui/material/Snackbar';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { useTranslation } from '@/i18n';
import { usePresets } from '@/components/service/usePresets';
import {
  MAX_NAME_LENGTH,
  MAX_PRESETS,
  newPresetId,
  presetFiltersFromEventFilters,
} from '@/lib/presets';
import { MY_FILTERS_PATH } from '@/config/community';
import type { EventFilters } from '@/types/filter.types';

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
 */
export default function SavePresetButton({ filters, cityId }: SavePresetButtonProps) {
  const { t } = useTranslation();
  const { presets, save } = usePresets();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const isFull = presets.length >= MAX_PRESETS;
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    save({
      id: newPresetId(),
      name: trimmed.slice(0, MAX_NAME_LENGTH),
      cityId,
      filters: presetFiltersFromEventFilters(filters),
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
        onClick={() => setOpen(true)}
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
