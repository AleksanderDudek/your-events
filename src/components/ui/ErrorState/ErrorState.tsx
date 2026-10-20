'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from '@/i18n';
import styles from './ErrorState.module.scss';

interface ErrorStateProps {
  onRetry?: () => void;
  title?: string;
  subtitle?: string;
}

export default function ErrorState({
  onRetry,
  title,
  subtitle,
}: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <Box className={styles.container} role="alert">
      <ErrorOutlineIcon className={styles.icon} sx={{ fontSize: 64, color: 'var(--color-accent-warm)' }} />
      <Typography variant="h5" className={styles.title} sx={{ color: 'var(--color-text-primary)' }}>
        {title ?? t.ERROR_TITLE}
      </Typography>
      <Typography variant="body2" className={styles.subtitle} sx={{ color: 'var(--color-text-secondary)' }}>
        {subtitle ?? t.ERROR_SUBTITLE}
      </Typography>
      {onRetry && (
        <Button
          variant="contained"
          color="primary"
          onClick={onRetry}
          className={styles.button}
          sx={{ mt: 2 }}
        >
          {t.RETRY}
        </Button>
      )}
    </Box>
  );
}
