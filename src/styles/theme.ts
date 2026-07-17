'use client';

import { createTheme } from '@mui/material/styles';

// Palette values mirror tokens.scss (brief §1). MUI runs in cssVariables mode so
// these emit CSS custom properties that flip on [data-theme="dark"] — the same
// attribute tokens.scss keys on. Keep both files in sync.
const LIGHT = {
  primary: '#f4553b',
  primaryHover: '#d9432f',
  primaryTint: '#fde9e4',
  bg: '#fbf8f3',
  surface: '#ffffff',
  surface2: '#f4efe7',
  ink: '#221c26',
  inkMuted: '#6e6575',
  border: '#e9e2d9',
};
const DARK = {
  primary: '#f86a50',
  primaryHover: '#f4553b',
  primaryTint: '#3a2521',
  bg: '#17131c',
  surface: '#221c29',
  surface2: '#2b2434',
  ink: '#f5f1ea',
  inkMuted: '#9c93a6',
  border: '#332b3d',
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  defaultColorScheme: 'light',
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: LIGHT.primary, dark: LIGHT.primaryHover, contrastText: '#ffffff' },
        secondary: { main: '#1fa8a0' },
        error: { main: '#e0533f' },
        warning: { main: '#c98a1d' },
        success: { main: '#2fa860' },
        background: { default: LIGHT.bg, paper: LIGHT.surface },
        text: { primary: LIGHT.ink, secondary: LIGHT.inkMuted, disabled: '#9c93a6' },
        divider: LIGHT.border,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: DARK.primary, dark: DARK.primaryHover, contrastText: '#17131c' },
        secondary: { main: '#54ccc5' },
        error: { main: '#f48ba8' },
        warning: { main: '#e3ac4e' },
        success: { main: '#5fcb8b' },
        background: { default: DARK.bg, paper: DARK.surface },
        text: { primary: DARK.ink, secondary: DARK.inkMuted, disabled: '#857c90' },
        divider: DARK.border,
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-body), sans-serif',
    h1: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 },
    h2: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 },
    h3: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 },
    h5: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    h6: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { background: 'transparent' } } },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '0.8125rem',
          fontWeight: 600,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          minHeight: 44,
          padding: '12px 22px',
          boxShadow: 'none',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: 'var(--primary-hover)',
            boxShadow: 'none',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          borderColor: 'var(--border)',
          color: 'var(--ink)',
          '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'transparent' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'var(--surface-2)',
            '& fieldset': { borderColor: 'transparent' },
            '&.Mui-focused fieldset': { borderColor: 'var(--primary)', borderWidth: 2 },
          },
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: 'var(--ink-muted)',
            '&.Mui-selected': {
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 600,
              '&:hover': { backgroundColor: 'var(--primary-hover)' },
            },
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          '&:before': { display: 'none' },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: { padding: 0, minHeight: 'auto', '&.Mui-expanded': { minHeight: 'auto' } },
        content: { margin: '8px 0', '&.Mui-expanded': { margin: '8px 0' } },
      },
    },
    MuiAccordionDetails: { styleOverrides: { root: { padding: '0 0 8px 0' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
