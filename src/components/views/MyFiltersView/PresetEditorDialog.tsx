'use client';

import { useCallback, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useTranslation } from '@/i18n';
import { useCategories } from '@/components/service/useCategories';
import { AVAILABLE_CITIES } from '@/config/cities';
import WeekdayPicker from '@/components/ui/WeekdayPicker/WeekdayPicker';
import { MAX_NAME_LENGTH, emptyPresetFilters } from '@/lib/presets';
import type { FilterPreset, PresetDateWindow } from '@/types/preset.types';

interface PresetEditorDialogProps {
  open: boolean;
  // The preset being edited, or a blank one when creating.
  draft: FilterPreset;
  onCancel: () => void;
  onSave: (preset: FilterPreset) => void;
}

export default function PresetEditorDialog({
  open,
  draft,
  onCancel,
  onSave,
}: PresetEditorDialogProps) {
  const { t, locale } = useTranslation();
  const { topLevel } = useCategories();
  const [preset, setPreset] = useState<FilterPreset>(draft);
  const [nameTouched, setNameTouched] = useState(false);
  // Which required fields the last Save attempt found empty. Ids, not labels,
  // so the summary below re-reads the live label and drops an entry the moment
  // the field is filled in.
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Remount on a new draft rather than syncing through an effect: the dialog is
  // keyed by preset id at the call site, so this component starts fresh.
  const filters = preset.filters ?? emptyPresetFilters();
  const nameError = nameTouched && preset.name.trim().length === 0;

  // The dialog is taller than the viewport, so Save sits far below the only
  // required field. A rejected save used to change nothing the user could see.
  // Driving that from one list keeps the summary, the focus jump and the check
  // itself in step — adding a second required field is one more entry here.
  const requiredFields = [
    { id: 'name', label: t.PRESETS_NAME, isEmpty: preset.name.trim().length === 0 },
  ];

  // Kept out of the array above so no ref is touched while rendering, which the
  // react-hooks lint rule rejects.
  const focusField = useCallback((id: string) => {
    if (id === 'name') nameInputRef.current?.focus();
  }, []);

  const missingFields = requiredFields.filter((f) => missingIds.includes(f.id) && f.isEmpty);

  const setFilters = (patch: Partial<typeof filters>) =>
    setPreset((p) => ({ ...p, filters: { ...p.filters, ...patch } }));

  const toggleCategory = (slug: string) =>
    setFilters({
      categories: filters.categories.includes(slug)
        ? filters.categories.filter((c) => c !== slug)
        : [...filters.categories, slug],
    });

  const dateWindows: { value: PresetDateWindow; label: string }[] = [
    { value: 'none', label: t.PRESETS_DATE_NONE },
    { value: 'today', label: t.PRESETS_DATE_TODAY },
    { value: 'weekend', label: t.PRESETS_DATE_WEEKEND },
    { value: 'next7', label: t.PRESETS_DATE_NEXT7 },
    { value: 'fixed', label: t.PRESETS_DATE_FIXED },
  ];

  const submit = () => {
    const unmet = requiredFields.filter((f) => f.isEmpty);
    if (unmet.length > 0) {
      setNameTouched(true);
      setMissingIds(unmet.map((f) => f.id));
      // Focus scrolls the field back into view, which is the point: the user
      // pressed Save at the bottom and the problem is off-screen above.
      focusField(unmet[0].id);
      return;
    }
    setMissingIds([]);
    onSave({ ...preset, name: preset.name.trim().slice(0, MAX_NAME_LENGTH) });
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {draft.name ? t.PRESETS_EDIT : t.PRESETS_NEW}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <TextField
          label={t.PRESETS_NAME}
          placeholder={t.PRESETS_NAME_PLACEHOLDER}
          value={preset.name}
          onChange={(e) => setPreset((p) => ({ ...p, name: e.target.value }))}
          onBlur={() => setNameTouched(true)}
          error={nameError}
          helperText={nameError ? t.PRESETS_NAME_REQUIRED : ' '}
          slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
          inputRef={nameInputRef}
          autoFocus
          fullWidth
        />

        <TextField
          select
          label={t.PRESETS_CITY}
          value={preset.cityId}
          onChange={(e) => setPreset((p) => ({ ...p, cityId: e.target.value }))}
          fullWidth
        >
          {AVAILABLE_CITIES.map((city) => (
            <MenuItem key={city.id} value={city.id}>
              {city.displayName[locale]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={t.SEARCH_LABEL}
          placeholder={t.SEARCH_PLACEHOLDER}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          fullWidth
        />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.FILTER_CATEGORIES}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {topLevel.map((category) => (
              <Chip
                key={category.slug}
                label={category.display_name}
                onClick={() => toggleCategory(category.slug)}
                color={filters.categories.includes(category.slug) ? 'primary' : 'default'}
                variant={filters.categories.includes(category.slug) ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Box>
        </Box>

        <Box>
          <TextField
            select
            label={t.PRESETS_DATE_WINDOW}
            value={filters.dateWindow}
            onChange={(e) => setFilters({ dateWindow: e.target.value as PresetDateWindow })}
            fullWidth
          >
            {dateWindows.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
            {t.PRESETS_DATE_HINT}
          </Typography>
        </Box>

        {filters.dateWindow === 'fixed' && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              type="date"
              label={t.FILTER_DATE_FROM}
              value={filters.dateFrom ?? ''}
              onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="date"
              label={t.FILTER_DATE_TO}
              value={filters.dateTo ?? ''}
              onChange={(e) => setFilters({ dateTo: e.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.FILTER_WEEKDAYS}
          </Typography>
          <WeekdayPicker
            value={filters.weekdays}
            onChange={(weekdays) => setFilters({ weekdays })}
          />
        </Box>

        {/* The events list only applies an hour window alongside a date one, so
            offering it without a date would be a control that does nothing. */}
        {filters.dateWindow !== 'none' && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              type="time"
              label={t.FILTER_DATE_FROM}
              value={filters.hourFrom ?? ''}
              onChange={(e) => setFilters({ hourFrom: e.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="time"
              label={t.FILTER_DATE_TO}
              value={filters.hourTo ?? ''}
              onChange={(e) => setFilters({ hourTo: e.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Box>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={filters.freeOnly}
              onChange={(e) => setFilters({ freeOnly: e.target.checked })}
            />
          }
          label={t.FILTER_FREE_ONLY}
        />
      </DialogContent>

      {/* Sits directly above the buttons on purpose: this is where the user is
          looking when Save does not work. role="alert" so it is announced too,
          since a sighted-only cue would leave screen-reader users with the same
          silent failure. */}
      {missingFields.length > 0 && (
        <Alert severity="error" role="alert" sx={{ mx: 3, mb: 1 }}>
          {t.PRESETS_MISSING_TITLE}
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {missingFields.map((f) => (
              <li key={f.id}>
                <Link component="button" type="button" onClick={() => focusField(f.id)} underline="always">
                  {f.label}
                </Link>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{t.PRESETS_CANCEL}</Button>
        <Button onClick={submit} variant="contained">
          {t.PRESETS_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
