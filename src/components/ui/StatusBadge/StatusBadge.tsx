'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { EventStatus } from '@/types/event.types';
import { useTranslation } from '@/i18n';
import styles from './StatusBadge.module.scss';

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

const STATUS_COLOR: Record<EventStatus, string> = {
  active: 'var(--color-status-active)',
  few_spots: 'var(--color-status-few)',
  sold_out: 'var(--color-status-sold)',
  cancelled: 'var(--color-status-cancelled)',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();

  const labelByStatus: Record<EventStatus, string> = {
    active: t.STATUS_ACTIVE,
    few_spots: t.STATUS_FEW,
    sold_out: t.STATUS_SOLD,
    cancelled: t.STATUS_CANCELLED,
  };

  const color = STATUS_COLOR[status];
  const label = labelByStatus[status];

  return (
    <Box className={`${styles.badge} ${className ?? ''}`} component="span">
      <Box
        component="span"
        className={styles.dot}
        sx={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <Typography
        component="span"
        variant="caption"
        className={styles.label}
        sx={{ color }}
      >
        {label}
      </Typography>
    </Box>
  );
}
