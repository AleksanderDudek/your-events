'use client';

import Chip from '@mui/material/Chip';
import CategoryIcon from '@/components/ui/CategoryIcon/CategoryIcon';
import { categoryColorVar, categoryColorInkVar, categoryColorSolidVar } from '@/lib/utils';
import { useTranslated } from '@/i18n/translation';

interface CategoryChipProps {
  category: string;
  onClick?: () => void;
  selected?: boolean;
}

// Tinted category pill (brief §2/§6). Unselected: color-mix tint bg, with the
// LABEL in the darker AA-contrast ink hue and the ICON in the base category
// hue. Selected: solid category fill + white.
//
// This is the one place EventCard, EventRow and EventDetailView all funnel
// their chips through, so it is also the one place their translation lives:
// only the rendered `label` goes through useTranslated. `category` itself
// stays Polish and keeps feeding categoryColorVar/Ink/Solid and CategoryIcon
// below — translating it would break every card's colour and icon lookup.
export default function CategoryChip({ category, onClick, selected }: CategoryChipProps) {
  const color = categoryColorVar(category);
  const ink = categoryColorInkVar(category);
  const solid = categoryColorSolidVar(category);
  const label = useTranslated(category);

  return (
    <Chip
      label={label}
      size="small"
      icon={<CategoryIcon category={category} size={16} />}
      onClick={onClick}
      sx={{
        height: 24,
        borderRadius: 999,
        fontFamily: 'var(--font-body)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        color: selected ? '#fff' : ink,
        backgroundColor: selected
          ? solid
          : `color-mix(in oklab, ${color} 14%, var(--surface))`,
        '& .MuiChip-icon': {
          color: selected ? '#fff' : color,
          marginLeft: '6px',
          marginRight: '-4px',
        },
        '&:hover': onClick
          ? {
              backgroundColor: selected
                ? solid
                : `color-mix(in oklab, ${color} 22%, var(--surface))`,
            }
          : {},
      }}
    />
  );
}
