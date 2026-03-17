'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { S } from '@/lib/strings';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  onClear?: () => void;
}

export default function EmptyState({ onClear }: EmptyStateProps) {
  return (
    <Box className={styles.container} role="status">
      <SearchOffIcon className={styles.icon} sx={{ fontSize: 64, color: 'var(--color-text-muted)' }} />
      <Typography variant="h5" className={styles.title} sx={{ color: 'var(--color-text-primary)' }}>
        {S.EMPTY_TITLE}
      </Typography>
      <Typography variant="body2" className={styles.subtitle} sx={{ color: 'var(--color-text-secondary)' }}>
        {S.EMPTY_SUBTITLE}
      </Typography>
      {onClear && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onClear}
          className={styles.button}
          sx={{ mt: 2 }}
        >
          {S.FILTER_CLEAR}
        </Button>
      )}
    </Box>
  );
}
