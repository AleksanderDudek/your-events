'use client';

import { useId } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from '@/i18n';
import { Translated, useTranslated } from '@/i18n/translation';
import { useSeasons } from '@/components/service/useSeasons';
import { seasonTheme } from '@/lib/seasons';
import { OfferedSeason } from '@/types/season.types';
import styles from './SeasonBar.module.scss';

interface SeasonBarProps {
  /** The season the list is narrowed to, if any. */
  value: string | null;
  onChange: (season: string | null) => void;
}

function SeasonToggle({
  season,
  pressed,
  onToggle,
  describedBy,
}: Readonly<{
  season: OfferedSeason;
  pressed: boolean;
  onToggle: () => void;
  describedBy?: string;
}>) {
  const { t } = useTranslation();
  const name = useTranslated(season.name);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={t.SEASON_TOGGLE_LABEL(name, season.count)}
      aria-describedby={describedBy}
      onClick={onToggle}
      className={`${styles.toggle} ${styles[`season-${seasonTheme(season.slug)}`]}`}
      data-season={season.slug}
    >
      <span className={styles.emoji} aria-hidden="true">
        {pressed ? <CheckIcon fontSize="inherit" /> : season.emoji}
      </span>
      <span>{name}</span>
      <span className={styles.count} aria-hidden="true">
        {season.count}
      </span>
    </button>
  );
}

/**
 * The seasonal quick filter above the results: one toggle per season on offer
 * (usually none, and then nothing renders). It sits on the page rather than in
 * the filter drawer so on a phone it is one tap away.
 *
 * The count is the season's whole programme from today on, not the current
 * result — the results header says that.
 */
export default function SeasonBar({ value, onChange }: Readonly<SeasonBarProps>) {
  const { t } = useTranslation();
  const { seasons } = useSeasons();
  const descriptionId = useId();
  if (seasons.length === 0) return null;
  const selected = seasons.find((season) => season.slug === value);

  return (
    <div className={styles.bar} role="group" aria-label={t.SEASON_SECTION_LABEL}>
      <div className={styles.toggles}>
        {seasons.map((season) => {
          const pressed = season.slug === value;
          return (
            <SeasonToggle
              key={season.slug}
              season={season}
              pressed={pressed}
              onToggle={() => onChange(pressed ? null : season.slug)}
              // The description appears once pressed; this is what lets a
              // screen reader hear it too.
              describedBy={pressed && season.description ? descriptionId : undefined}
            />
          );
        })}
      </div>
      {selected?.description && (
        <p id={descriptionId} className={styles.description}>
          <Translated text={selected.description} />
        </p>
      )}
    </div>
  );
}
