'use client';

import Box from '@mui/material/Box';
import AppHeader from '@/components/common/AppHeader/AppHeader';
import AppFooter from '@/components/common/AppFooter/AppFooter';
import CookieBanner from '@/components/common/CookieBanner/CookieBanner';
import Onboarding from '@/components/common/Onboarding/Onboarding';
import ShareDialog from '@/components/common/ShareDialog/ShareDialog';
import TranslationNotice from '@/components/common/TranslationNotice/TranslationNotice';
import { useTranslation } from '@/i18n';
import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  return (
    <Box className={styles.layout}>
      <a href="#main-content" className={styles.skipLink}>
        {t.SKIP_TO_CONTENT}
      </a>
      <AppHeader />
      <TranslationNotice />
      <Box component="main" id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </Box>
      <AppFooter />
      <CookieBanner />
      {/* After the banner on purpose: Onboarding stays closed while a consent
          choice is outstanding, so the two never stack. */}
      <Onboarding />
      {/* "Poleć Idź na miasto" — one instance, opened from the header, the
          home banner, the footer and Rozwijaj z nami. */}
      <ShareDialog />
    </Box>
  );
}
