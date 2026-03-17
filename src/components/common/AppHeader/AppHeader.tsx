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
import { S } from '@/lib/strings';
import styles from './AppHeader.module.scss';

const NAV_ITEMS = [
  { label: S.NAV_HOME, href: '/' as const },
  { label: S.NAV_EVENTS, href: '/events' as const },
];

export default function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const muiTheme = useTheme();
  const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));

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
        backgroundColor: 'rgba(15, 15, 19, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
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
            your
            <Box
              component="span"
              sx={{ color: 'var(--color-accent-primary)', mx: '2px' }}
            >
              ·
            </Box>
            events
          </Typography>
        </Link>

        {isMdUp ? (
          <Box component="nav" aria-label="Główna nawigacja" className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </Box>
        ) : (
          <>
            <IconButton
              onClick={() => setDrawerOpen(true)}
              aria-label="Otwórz menu"
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
                  aria-label="Zamknij menu"
                  sx={{ color: 'var(--color-text-primary)' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
              <Box component="nav" aria-label="Główna nawigacja">
                <List>
                  {NAV_ITEMS.map((item) => (
                    <ListItem key={item.href} disablePadding>
                      <ListItemButton
                        component={Link}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        selected={isActive(item.href)}
                        sx={{
                          '&.Mui-selected': {
                            borderRight: '3px solid var(--color-accent-primary)',
                            backgroundColor: 'rgba(244, 162, 40, 0.08)',
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
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
