'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { EventStatus } from '@/types/event.types';
import { S } from '@/lib/strings';
import styles from './StatusBadge.module.scss';

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  active: { label: S.STATUS_ACTIVE, color: 'var(--color-status-active)' },
  few_spots: { label: S.STATUS_FEW, color: 'var(--color-status-few)' },
  sold_out: { label: S.STATUS_SOLD, color: 'var(--color-status-sold)' },
  cancelled: { label: S.STATUS_CANCELLED, color: 'var(--color-status-cancelled)' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Box className={`${styles.badge} ${className ?? ''}`} component="span">
      <Box
        component="span"
        className={styles.dot}
        sx={{ backgroundColor: config.color }}
        aria-hidden="true"
      />
      <Typography
        component="span"
        variant="caption"
        className={styles.label}
        sx={{ color: config.color }}
      >
        {config.label}
      </Typography>
    </Box>
  );
}
