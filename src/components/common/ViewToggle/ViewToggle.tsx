'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import MapIcon from '@mui/icons-material/Map';
import { ViewMode } from '@/types/filter.types';
import { useTranslation } from '@/i18n';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  const { t } = useTranslation();
  const handleChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) {
      onChange(newMode);
    }
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      size="small"
      aria-label="Widok wydarzeń"
      // Onboarding spotlight anchor — see lib/tourSteps.
      data-tour="view"
      sx={{
        '& .MuiToggleButton-root': {
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
          padding: '6px',
          '&.Mui-selected': {
            backgroundColor: 'var(--color-accent-tint-strong)',
            color: 'var(--color-accent-primary)',
            borderColor: 'var(--color-accent-primary)',
          },
        },
      }}
    >
      <ToggleButton value="grid" aria-label={t.VIEW_GRID} aria-pressed={value === 'grid'}>
        <GridViewIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="row" aria-label={t.VIEW_LIST} aria-pressed={value === 'row'}>
        <ViewListIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="map" aria-label={t.VIEW_MAP} aria-pressed={value === 'map'}>
        <MapIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
