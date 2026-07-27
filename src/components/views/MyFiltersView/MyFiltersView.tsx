'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useCategories } from '@/components/service/useCategories';
import { usePresets } from '@/components/service/usePresets';
import CategoryIcon from '@/components/ui/CategoryIcon/CategoryIcon';
import {
  MAX_PRESETS,
  emptyPresetFilters,
  newPresetId,
  presetHref,
} from '@/lib/presets';
import { getCity } from '@/config/cities';
import type { FilterPreset } from '@/types/preset.types';
import styles from './MyFiltersView.module.scss';
import PresetEditorDialog from './PresetEditorDialog';

export default function MyFiltersView() {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { byDisplayName, topLevel } = useCategories();
  const { presets, save, remove, duplicate } = usePresets();
  const [draft, setDraft] = useState<FilterPreset | null>(null);

  const slugToName = new Map(topLevel.map((c) => [c.slug, c.display_name]));

  const startNew = () =>
    setDraft({
      id: newPresetId(),
      name: '',
      cityId: city.id,
      filters: emptyPresetFilters(),
      createdAt: new Date().toISOString(),
    });

  const onDelete = (preset: FilterPreset) => {
    if (window.confirm(t.PRESETS_DELETE_CONFIRM(preset.name))) remove(preset.id);
  };

  // Human-readable gist of a preset, so a tile says what it does without being
  // opened. Deliberately short: the tile is a shortcut, not a filter panel.
  const summarise = (preset: FilterPreset): string => {
    const parts: string[] = [];
    const names = preset.filters.categories
      .map((slug) => slugToName.get(slug) ?? slug)
      .filter(Boolean);
    if (names.length) parts.push(names.join(', '));
    if (preset.filters.search) parts.push(t.PRESETS_SUMMARY_SEARCH(preset.filters.search));

    const windowLabel: Record<string, string> = {
      today: t.PRESETS_DATE_TODAY,
      weekend: t.PRESETS_DATE_WEEKEND,
      next7: t.PRESETS_DATE_NEXT7,
      fixed: [preset.filters.dateFrom, preset.filters.dateTo].filter(Boolean).join(' – '),
    };
    const when = windowLabel[preset.filters.dateWindow];
    if (when) parts.push(when);

    if (preset.filters.weekdays.length) {
      parts.push(preset.filters.weekdays.map((day) => t.WEEKDAY_SHORT[day]).join(', '));
    }
    if (preset.filters.hourFrom && preset.filters.hourTo) {
      parts.push(t.PRESETS_SUMMARY_HOURS(preset.filters.hourFrom, preset.filters.hourTo));
    }
    if (preset.filters.freeOnly) parts.push(t.PRESETS_SUMMARY_FREE);

    return parts.length ? parts.join(' · ') : t.PRESETS_SUMMARY_ANY;
  };

  // The tile borrows its accent from the first category in the preset, so a set
  // of tiles reads the same way the chips and map pins do.
  const accentFor = (preset: FilterPreset): string | null => {
    const first = preset.filters.categories[0];
    if (!first) return null;
    const name = slugToName.get(first);
    return name ? byDisplayName.get(name)?.color ?? null : null;
  };

  const isFull = presets.length >= MAX_PRESETS;

  return (
    <Box className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.PRESETS_TITLE}</h1>
        <p className={styles.subtitle}>{t.PRESETS_SUBTITLE}</p>
      </header>

      {presets.length === 0 ? (
        <Box className={styles.empty}>
          <h2 className={styles.emptyTitle}>{t.PRESETS_EMPTY_TITLE}</h2>
          <p className={styles.emptyBody}>{t.PRESETS_EMPTY_BODY}</p>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startNew}>
            {t.PRESETS_NEW}
          </Button>
        </Box>
      ) : (
        <>
          <Box className={styles.actions}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={startNew}
              disabled={isFull}
            >
              {t.PRESETS_NEW}
            </Button>
            {isFull && <span className={styles.limit}>{t.PRESETS_FULL(MAX_PRESETS)}</span>}
          </Box>

          <ul className={styles.grid}>
            {presets.map((preset) => {
              const accent = accentFor(preset);
              const firstCategoryName = preset.filters.categories[0]
                ? slugToName.get(preset.filters.categories[0])
                : null;
              return (
                <li
                  key={preset.id}
                  className={styles.tile}
                  style={accent ? ({ '--tile-accent': accent } as React.CSSProperties) : undefined}
                >
                  <Link
                    href={presetHref(preset, new Date()) as Route}
                    className={styles.tileLink}
                  >
                    <span className={styles.tileHead}>
                      {firstCategoryName && (
                        <span className={styles.tileIcon} aria-hidden="true">
                          <CategoryIcon category={firstCategoryName} size={18} />
                        </span>
                      )}
                      <span className={styles.tileCity}>
                        {getCity(preset.cityId).displayName[locale]}
                      </span>
                    </span>
                    <span className={styles.tileName}>{preset.name}</span>
                    <span className={styles.tileSummary}>{summarise(preset)}</span>
                    <span className={styles.tileCta}>
                      {t.PRESETS_OPEN}
                      <ArrowForwardIcon fontSize="inherit" />
                    </span>
                  </Link>

                  <div className={styles.tileActions}>
                    <Tooltip title={t.PRESETS_EDIT}>
                      <IconButton size="small" onClick={() => setDraft(preset)} aria-label={t.PRESETS_EDIT}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t.PRESETS_DUPLICATE}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={isFull}
                          aria-label={t.PRESETS_DUPLICATE}
                          onClick={() =>
                            duplicate(
                              preset.id,
                              newPresetId(),
                              `${preset.name} (${t.PRESETS_COPY_SUFFIX})`,
                              new Date().toISOString()
                            )
                          }
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t.PRESETS_DELETE}>
                      <IconButton
                        size="small"
                        onClick={() => onDelete(preset)}
                        aria-label={t.PRESETS_DELETE}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {draft && (
        <PresetEditorDialog
          // Keyed by id so switching which preset is being edited starts the
          // form from that preset's values instead of the previous one's.
          key={draft.id}
          open
          draft={draft}
          onCancel={() => setDraft(null)}
          onSave={(preset) => {
            save(preset);
            setDraft(null);
          }}
        />
      )}
    </Box>
  );
}
