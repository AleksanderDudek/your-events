'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { useTranslation } from '@/i18n';
import styles from './AppFooter.module.scss';

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
