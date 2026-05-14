'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import { useTranslation } from '@/i18n';
import { SOURCE_TYPE_LABELS } from '@/lib/constants';
import { SourceType } from '@/types/event.types';
import styles from './AppFooter.module.scss';

const SOURCE_CHIPS: SourceType[] = [
  'dance_studio',
  'fitness_club',
  'culinary_studio',
  'cultural_event',
  'facebook_event',
  'sports_club',
];

export default function AppFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <Box component="footer" role="contentinfo" className={styles.footer}>
      <Box className={styles.inner}>
        <Box className={styles.col}>
          <Typography
            variant="h6"
            sx={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              mb: 0.5,
            }}
          >
            {t.APP_NAME}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
            {t.APP_TAGLINE}
          </Typography>
        </Box>

        <Box className={styles.col}>
          <Typography
            variant="overline"
            sx={{ color: 'var(--color-text-muted)', mb: 1, display: 'block' }}
          >
            {t.FOOTER_SOURCES}
          </Typography>
          <Box className={styles.chips}>
            {SOURCE_CHIPS.map((source) => (
              <Chip
                key={source}
                label={SOURCE_TYPE_LABELS[source]}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.6875rem',
                }}
              />
            ))}
          </Box>
        </Box>

        <Box className={styles.col}>
          <Box className={styles.links}>
            <Link
              href="#"
              underline="hover"
              sx={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}
            >
              {t.FOOTER_PRIVACY}
            </Link>
            <Link
              href="#"
              underline="hover"
              sx={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}
            >
              {t.FOOTER_CONTACT}
            </Link>
          </Box>
        </Box>
      </Box>

      <Box className={styles.bottom}>
        <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
          {t.FOOTER_COPYRIGHT(year)}
        </Typography>
      </Box>
    </Box>
  );
}
