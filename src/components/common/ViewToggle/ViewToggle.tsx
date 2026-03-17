'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import { ViewMode } from '@/types/filter.types';
import { S } from '@/lib/strings';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
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
      sx={{
        '& .MuiToggleButton-root': {
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
          padding: '6px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(244, 162, 40, 0.15)',
            color: 'var(--color-accent-primary)',
            borderColor: 'var(--color-accent-primary)',
          },
        },
      }}
    >
      <ToggleButton value="grid" aria-label={S.VIEW_GRID} aria-pressed={value === 'grid'}>
        <GridViewIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="row" aria-label={S.VIEW_LIST} aria-pressed={value === 'row'}>
        <ViewListIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
