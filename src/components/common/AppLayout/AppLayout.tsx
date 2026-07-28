'use client';

import Box from '@mui/material/Box';
import AppHeader from '@/components/common/AppHeader/AppHeader';
import AppFooter from '@/components/common/AppFooter/AppFooter';
import CookieBanner from '@/components/common/CookieBanner/CookieBanner';
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
      <Box component="main" id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </Box>
      <AppFooter />
      <CookieBanner />
    </Box>
  );
}
