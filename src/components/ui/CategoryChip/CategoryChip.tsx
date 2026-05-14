'use client';

import Chip from '@mui/material/Chip';

interface CategoryChipProps {
  category: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function CategoryChip({ category, onClick, selected }: CategoryChipProps) {
  const label = category;

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
              backgroundColor: selected ? 'primary.dark' : 'var(--color-accent-tint)',
            }
          : {},
      }}
    />
  );
}
