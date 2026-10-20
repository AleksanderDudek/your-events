'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useTranslation } from '@/i18n';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  onClear?: () => void;
}

export default function EmptyState({ onClear }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <Box className={styles.container} role="status">
      <SearchOffIcon className={styles.icon} sx={{ fontSize: 64, color: 'var(--color-text-muted)' }} />
      <Typography variant="h5" component="p" className={styles.title} sx={{ color: 'var(--color-text-primary)' }}>
        {t.EMPTY_TITLE}
      </Typography>
      <Typography variant="body2" className={styles.subtitle} sx={{ color: 'var(--color-text-secondary)' }}>
        {t.EMPTY_SUBTITLE}
      </Typography>
      {onClear && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onClear}
          className={styles.button}
          sx={{ mt: 2 }}
        >
          {t.FILTER_CLEAR}
        </Button>
      )}
    </Box>
  );
}
