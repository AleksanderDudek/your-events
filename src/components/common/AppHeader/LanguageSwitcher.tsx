'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { Locale, useTranslation } from '@/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  const handleChange = (_: React.MouseEvent<HTMLElement>, next: Locale | null) => {
    if (next && next !== locale) setLocale(next);
  };

  return (
    <ToggleButtonGroup
      value={locale}
      exclusive
      onChange={handleChange}
      size="small"
      aria-label={t.LANG_LABEL}
      sx={{
        // No left margin of its own: both callers space their children (the
        // desktop nav row and the drawer's settings block), and the extra 8px
        // knocked this out of alignment with everything above it in the drawer.
        '& .MuiToggleButton-root': {
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
          padding: '2px 8px',
          minWidth: 36,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          // DM Mono tops out at 500; 600 would be a synthesised fake bold.
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          '&.Mui-selected': {
            backgroundColor: 'var(--color-accent-tint-strong)',
            color: 'var(--color-accent-primary)',
            borderColor: 'var(--color-accent-primary)',
          },
        },
      }}
    >
      <ToggleButton value="pl" aria-label={t.LANG_PL}>PL</ToggleButton>
      <ToggleButton value="en" aria-label={t.LANG_EN}>EN</ToggleButton>
    </ToggleButtonGroup>
  );
}
