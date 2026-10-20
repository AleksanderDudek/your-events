'use client';

import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { useTranslated } from '@/i18n/translation';

interface PriceLabelProps {
  amount: number | null;
  currency: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export default function PriceLabel({ amount, currency, label, showLabel, className }: PriceLabelProps) {
  const { t } = useTranslation();
  // Only this descriptive-label branch carries translatable Polish prose
  // ("Karnet od 189 zł"); the numeric amount/currency below are formatted,
  // not text, and the `title` attribute needs a plain string, hence the hook.
  const translatedLabel = useTranslated(label);

  // Membership-only pricing (e.g. "Karnet od 189 zł"): show the label verbatim
  // instead of a bare number, which would read as a single-entry price.
  if (showLabel && label) {
    return (
      <Typography
        variant="body2"
        component="span"
        className={className}
        title={translatedLabel}
        sx={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
      >
        {translatedLabel}
      </Typography>
    );
  }

  if (amount === null) {
    return (
      <Typography
        variant="body2"
        component="span"
        className={className}
        sx={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}
      >
        {t.PRICE_UNKNOWN}
      </Typography>
    );
  }

  if (amount === 0) {
    return (
      <Typography
        variant="body2"
        component="span"
        className={className}
        sx={{ color: 'var(--color-status-active)', fontWeight: 600 }}
      >
        {t.PRICE_FREE}
      </Typography>
    );
  }

  return (
    <Typography
      variant="body2"
      component="span"
      className={className}
      sx={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
    >
      {amount} {currency}
    </Typography>
  );
}
