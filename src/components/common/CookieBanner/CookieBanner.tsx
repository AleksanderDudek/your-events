'use client';

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { Route } from 'next';
import { useConsent } from '@/components/service/useConsent';
import { useTranslation } from '@/i18n';
import { PRIVACY_PATH } from '@/config/community';
import styles from './CookieBanner.module.scss';

// Clarity's Consent API v2. `ad_Storage` is always denied: the site carries no
// advertising, so granting it would be an inaccurate signal. Session stitching
// comes from the first-party _clck/_clsk cookies, which analytics_Storage
// governs.
function signalClarity(granted: boolean): void {
  window.clarity?.('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  });
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const { choice, isOpen, accept, reject } = useConsent();

  // Runs on every load, not only on the click: a returning visitor who already
  // accepted renders no banner but still needs the signal, because _clsk
  // expires after a day. The call is idempotent, and the Clarity snippet queues
  // it if clarity.js has not finished loading.
  useEffect(() => {
    if (choice === null) return;
    signalClarity(choice === 'accepted');
  }, [choice]);

  if (!isOpen) return null;

  return (
    <Box className={styles.banner} role="region" aria-label={t.COOKIE_REGION_LABEL}>
      <Box className={styles.text}>
        <Typography variant="subtitle2">{t.COOKIE_TITLE}</Typography>
        <Typography variant="body2">
          {t.COOKIE_BODY}{' '}
          <Link href={PRIVACY_PATH as Route}>{t.COOKIE_MORE}</Link>
        </Typography>
      </Box>
      {/* Both buttons are deliberately the same variant/weight: reject must be
          no harder and no less prominent than accept (EU-facing site, no dark
          patterns). Do not make accept `contained` — that reads as the
          recommended action and defeats the point. */}
      <Box className={styles.actions}>
        <Button variant="outlined" onClick={reject}>
          {t.COOKIE_REJECT}
        </Button>
        <Button variant="outlined" onClick={accept}>
          {t.COOKIE_ACCEPT}
        </Button>
      </Box>
    </Box>
  );
}
