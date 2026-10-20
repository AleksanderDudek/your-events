'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useConsent } from '@/components/service/useConsent';
import { useOnboarding } from '@/components/service/useOnboarding';
import {
  DISCORD_INVITE_URL,
  FEEDBACK_FORM_URL,
  GROW_WITH_US_PATH,
} from '@/config/community';
import Spark from '@/components/common/Spark/Spark';
import styles from './AppFooter.module.scss';

export default function AppFooter() {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { reopen } = useConsent();
  const { isEnabled: isOnboardingEnabled, replay: replayOnboarding } = useOnboarding();
  const year = new Date().getFullYear();

  return (
    <Box component="footer" role="contentinfo" className={styles.footer}>
      <Box className={styles.inner}>
        <Box className={styles.col}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
              <Spark size={22} />
            </span>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--ink)' }}
            >
              {t.APP_NAME}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
            {t.APP_TAGLINE(city.locativeForm[locale])}
          </Typography>
        </Box>

        <Box className={styles.col} component="nav" aria-label={t.FOOTER_COMMUNITY}>
          <Typography
            variant="subtitle2"
            component="h2"
            sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', mb: 1 }}
          >
            {t.FOOTER_COMMUNITY}
          </Typography>
          <Box className={styles.links}>
            <Link href={GROW_WITH_US_PATH as Route} className={styles.link}>
              {t.GROW_HEADLINE}
            </Link>
            <a
              href={DISCORD_INVITE_URL}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.GROW_DISCORD_TITLE}
            </a>
            <a
              href={FEEDBACK_FORM_URL}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.GROW_FORM_TITLE}
            </a>
            {/* A <button>, not an anchor: this changes app state (reopens the
                cookie banner) rather than navigating, and an anchor with no
                href isn't keyboard-operable. */}
            <button type="button" className={styles.linkButtonReset} onClick={reopen}>
              {t.COOKIE_FOOTER_LINK}
            </button>
            {/* Replays the welcome sheet without clearing the stored version,
                so this is a "show me again", not a reset. Gone entirely when
                the feature flag is off — a link to nothing is worse than no
                link. */}
            {isOnboardingEnabled && (
              <button
                type="button"
                className={styles.linkButtonReset}
                onClick={replayOnboarding}
              >
                {t.ONBOARDING_FOOTER_LINK}
              </button>
            )}
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
