'use client';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { SortKey, SortDir } from '@/types/filter.types';
import { useTranslation } from '@/i18n';

interface SortSelectProps {
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey) => void;
  onDirChange: (dir: SortDir) => void;
  /** Offer ordering by distance — only meaningful while there is a point to measure from. */
  withDistance?: boolean;
}

const SORT_KEYS: SortKey[] = ['date', 'name', 'venue', 'price'];

// Controlled, like the page-size Select beside it: the caller (EventsListView)
// owns the state and writes through updateFilters, which already resets to
// page 1 — this component holds none of its own.
export default function SortSelect({
  sort,
  dir,
  onSortChange,
  onDirChange,
  withDistance = false,
}: SortSelectProps) {
  const { t } = useTranslation();

  const labels: Record<SortKey, string> = {
    date: t.SORT_DATE,
    name: t.SORT_NAME,
    venue: t.SORT_VENUE,
    price: t.SORT_PRICE,
    distance: t.SORT_DISTANCE,
  };
  const keys: SortKey[] = withDistance ? [...SORT_KEYS, 'distance'] : SORT_KEYS;

  const nextDir: SortDir = dir === 'asc' ? 'desc' : 'asc';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-tour="sort">
      <FormControl size="small" sx={{ minWidth: 96 }}>
        <Select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          sx={{ fontSize: '0.8125rem' }}
          SelectDisplayProps={{ 'aria-label': t.SORT_LABEL }}
        >
          {keys.map((key) => (
            <MenuItem key={key} value={key}>
              {labels[key]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <IconButton
        size="small"
        onClick={() => onDirChange(nextDir)}
        aria-label={nextDir === 'asc' ? t.SORT_DIR_ASC : t.SORT_DIR_DESC}
        sx={{ color: 'var(--color-text-muted)' }}
      >
        {dir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
