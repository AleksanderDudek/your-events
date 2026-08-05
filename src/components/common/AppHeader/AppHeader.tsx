'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
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
import { GROW_WITH_US_PATH, MY_FILTERS_PATH } from '@/config/community';
import LogoMark from '@/components/common/LogoMark/LogoMark';
import ThemeToggle from '@/components/common/ThemeToggle/ThemeToggle';
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
    { label: t.NAV_HOME, href: `/${city.id}` as Route },
    { label: t.NAV_EVENTS, href: `/${city.id}/wydarzenia` as Route },
    // City-agnostic: these live outside the /{city} subtree.
    { label: t.NAV_PRESETS, href: MY_FILTERS_PATH as Route },
    { label: t.NAV_GROW, href: GROW_WITH_US_PATH as Route },
  ];

  const isActive = (href: string) => {
    const current = pathname.replace(/\/$/, '') || '/';
    if (href === `/${city.id}`) return current === href;
    return current.startsWith(href);
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
        borderBottom: '1px solid var(--border)',
        boxShadow: 'none',
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
        <Link
          href="/"
          className={styles.logo}
          // minWidth: 0 lets the wordmark truncate instead of pushing the row
          // wider than the viewport — a header that overflows makes the whole
          // page pan sideways and the fixed filter Fab drift off-screen.
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          <span style={{ color: 'var(--primary)', display: 'inline-flex', flexShrink: 0 }}>
            <LogoMark size={28} />
          </span>
          <Typography
            variant="h6"
            component="span"
            translate="no"
            sx={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
            <ThemeToggle />
          </Box>
        ) : (
          // Everything but the wordmark lives in the drawer on a phone. The bar
          // used to carry the city, language and theme controls alongside the
          // burger, which left the wordmark competing with four controls for a
          // 390px row.
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
                sx: { width: 288, display: 'flex', flexDirection: 'column' },
              }}
            >
              {/* The drawer repeats the wordmark so it reads as the same site
                  once it covers the header. Not a link: the header logo already
                  goes home, and a second one here would be a duplicate target
                  a screen-reader user has to step past. */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--primary)', display: 'inline-flex', flexShrink: 0 }}>
                    <LogoMark size={24} />
                  </span>
                  <Typography
                    variant="h6"
                    component="span"
                    translate="no"
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      color: 'var(--ink)',
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.APP_NAME}
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setDrawerOpen(false)}
                  aria-label={t.NAV_CLOSE_MENU}
                  sx={{ color: 'var(--color-text-primary)', flexShrink: 0 }}
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

              {/* Pushed to the bottom: these are settings, not destinations, so
                  they sit below the navigation rather than above it. */}
              <Box
                sx={{
                  mt: 'auto',
                  px: 2,
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <CitySwitcher onSelected={() => setDrawerOpen(false)} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LanguageSwitcher />
                  <ThemeToggle />
                </Box>
              </Box>
            </Drawer>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
