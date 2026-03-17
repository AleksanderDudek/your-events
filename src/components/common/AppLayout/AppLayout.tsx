'use client';

import Box from '@mui/material/Box';
import AppHeader from '@/components/common/AppHeader/AppHeader';
import AppFooter from '@/components/common/AppFooter/AppFooter';
import { S } from '@/lib/strings';
import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <Box className={styles.layout}>
      <a href="#main-content" className={styles.skipLink}>
        {S.SKIP_TO_CONTENT}
      </a>
      <AppHeader />
      <Box component="main" id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </Box>
      <AppFooter />
    </Box>
  );
}
