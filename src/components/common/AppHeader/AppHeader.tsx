'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import LanguageSwitcher from './LanguageSwitcher';
import CitySwitcher from './CitySwitcher';
import styles from './AppHeader.module.scss';

export default function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const muiTheme = useTheme();
  const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));
  const { t } = useTranslation();
  const { city } = useCity();

  const navItems = [
    { label: t.NAV_HOME, href: `/${city.id}` as const },
    { label: t.NAV_EVENTS, href: `/${city.id}/wydarzenia` as const },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <AppBar
      component="header"
      role="banner"
      position="sticky"
      elevation={0}
      className={styles.header}
      sx={{
        backgroundColor: 'var(--color-surface-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 1px 0 rgba(236, 72, 153, 0.05)',
      }}
    >
      <Toolbar
        className={styles.toolbar}
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          width: '100%',
          px: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Link href="/" className={styles.logo}>
          <Typography
            variant="h6"
            component="span"
            sx={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {t.APP_NAME}
          </Typography>
        </Link>

        {isMdUp ? (
          <Box component="nav" aria-label={t.NAV_MAIN} className={styles.nav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <CitySwitcher />
            <LanguageSwitcher />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CitySwitcher />
            <LanguageSwitcher />
            <IconButton
              onClick={() => setDrawerOpen(true)}
              aria-label={t.NAV_OPEN_MENU}
              sx={{ color: 'var(--color-text-primary)' }}
            >
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              PaperProps={{
                sx: { width: 280, pt: 2 },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1 }}>
                <IconButton
                  onClick={() => setDrawerOpen(false)}
                  aria-label={t.NAV_CLOSE_MENU}
                  sx={{ color: 'var(--color-text-primary)' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
              <Box component="nav" aria-label={t.NAV_MAIN}>
                <List>
                  {navItems.map((item) => (
                    <ListItem key={item.href} disablePadding>
                      <ListItemButton
                        component={Link}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        selected={isActive(item.href)}
                        sx={{
                          '&.Mui-selected': {
                            borderRight: '3px solid var(--color-accent-primary)',
                            backgroundColor: 'var(--color-accent-tint)',
                          },
                        }}
                      >
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontFamily: 'var(--font-body)',
                            fontWeight: isActive(item.href) ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Drawer>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
