'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import styles from './AppFooter.module.scss';

export default function AppFooter() {
  const { t, locale } = useTranslation();
  const { city } = useCity();
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
            {t.APP_TAGLINE(city.locativeForm[locale])}
          </Typography>
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
