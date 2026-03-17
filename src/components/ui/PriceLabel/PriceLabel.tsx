'use client';

import Typography from '@mui/material/Typography';
import { S } from '@/lib/strings';

interface PriceLabelProps {
  amount: number | null;
  currency: string;
  className?: string;
}

export default function PriceLabel({ amount, currency, className }: PriceLabelProps) {
  if (amount === null) {
    return (
      <Typography
        variant="body2"
        component="span"
        className={className}
        sx={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}
      >
        {S.PRICE_UNKNOWN}
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
        {S.PRICE_FREE}
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
