'use client';

import Chip from '@mui/material/Chip';
import { EventCategory } from '@/types/event.types';
import { CATEGORY_LABELS } from '@/lib/constants';

interface CategoryChipProps {
  category: EventCategory;
  onClick?: () => void;
  selected?: boolean;
}

export default function CategoryChip({ category, onClick, selected }: CategoryChipProps) {
  const label = CATEGORY_LABELS[category] || category;

  return (
    <Chip
      label={label}
      size="small"
      variant={selected ? 'filled' : 'outlined'}
      onClick={onClick}
      sx={{
        borderColor: selected ? 'primary.main' : 'primary.main',
        color: selected ? 'primary.contrastText' : 'primary.main',
        backgroundColor: selected ? 'primary.main' : 'transparent',
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontFamily: 'var(--font-dm-sans)',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? {
              backgroundColor: selected ? 'primary.dark' : 'rgba(244, 162, 40, 0.1)',
            }
          : {},
      }}
    />
  );
}
