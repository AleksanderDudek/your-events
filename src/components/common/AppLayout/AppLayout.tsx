'use client';

import Box from '@mui/material/Box';
import AppHeader from '@/components/common/AppHeader/AppHeader';
import AppFooter from '@/components/common/AppFooter/AppFooter';
import CookieBanner from '@/components/common/CookieBanner/CookieBanner';
import { useConsent } from '@/components/service/useConsent';
import { useTranslation } from '@/i18n';
import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  // The banner is `position: fixed` at the bottom and covers whatever is
  // beneath it (in practice the footer) while it is open. Compensating with
  // bottom padding only while `isOpen` is true keeps every other page byte
  // for byte the same as before - no permanent gap once a choice is made.
  // The values are a deliberately rough estimate of the banner's rendered
  // height (taller on narrow viewports, where its text and actions wrap),
  // not a pixel-exact measurement - good enough to keep the footer's links
  // reachable without wiring up a ResizeObserver for a bar the visitor
  // dismisses with one click.
  const { isOpen: isCookieBannerOpen } = useConsent();
  return (
    <Box className={styles.layout} sx={{ pb: isCookieBannerOpen ? { xs: 18, sm: 10 } : 0 }}>
      <a href="#main-content" className={styles.skipLink}>
        {t.SKIP_TO_CONTENT}
      </a>
      <AppHeader />
      <Box component="main" id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </Box>
      <AppFooter />
      <CookieBanner />
    </Box>
  );
}
