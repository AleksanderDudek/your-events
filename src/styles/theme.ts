'use client';

import { createTheme } from '@mui/material/styles';

// Keep raw hex values in sync with tokens.scss — these are the same palette,
// just expressed in JS for MUI's createTheme.
const PALETTE = {
  bgBase: '#fffaf3',
  bgSurface: '#ffffff',
  bgElevated: '#fff5e8',
  accentPrimary: '#ec4899',
  accentPrimaryDark: '#be1a6b',
  accentPrimaryLight: '#f472b6',
  accentWarm: '#f97316',
  accentCool: '#06b6d4',
  textPrimary: '#1a0f2e',
  textSecondary: '#564b6e',
  textMuted: '#9b93a8',
  border: '#f3e2d1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: PALETTE.accentPrimary,
      light: PALETTE.accentPrimaryLight,
      dark: PALETTE.accentPrimaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: PALETTE.accentCool,
      light: '#22d3ee',
      dark: '#0891b2',
    },
    error: {
      main: PALETTE.error,
    },
    warning: {
      main: PALETTE.warning,
    },
    success: {
      main: PALETTE.success,
    },
    background: {
      default: PALETTE.bgBase,
      paper: PALETTE.bgSurface,
    },
    text: {
      primary: PALETTE.textPrimary,
      secondary: PALETTE.textSecondary,
      disabled: PALETTE.textMuted,
    },
    divider: PALETTE.border,
  },
  typography: {
    fontFamily: 'var(--font-body), sans-serif',
    h1: { fontFamily: 'var(--font-display), serif', fontWeight: 700 },
    h2: { fontFamily: 'var(--font-display), serif', fontWeight: 700 },
    h3: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 700 },
    h4: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    h5: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    h6: { fontFamily: 'var(--font-body), sans-serif', fontWeight: 600 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'transparent',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: PALETTE.bgSurface,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(124, 58, 237, 0.07)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        },
        outlined: {
          borderColor: PALETTE.accentPrimary,
          color: PALETTE.accentPrimary,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          fontWeight: 600,
          padding: '8px 20px',
          boxShadow: 'none',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: PALETTE.accentPrimaryDark,
            boxShadow: '0 6px 20px rgba(236, 72, 153, 0.35)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: PALETTE.bgSurface,
          borderColor: PALETTE.border,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: PALETTE.bgSurface,
            '&.Mui-focused fieldset': {
              borderColor: PALETTE.accentPrimary,
              borderWidth: 2,
            },
          },
          '& .MuiInput-underline:after': {
            borderBottomColor: PALETTE.accentPrimary,
          },
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: PALETTE.textSecondary,
            '&.Mui-selected': {
              backgroundColor: PALETTE.accentPrimary,
              color: '#ffffff',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: PALETTE.accentPrimaryDark,
              },
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
        root: {
          padding: 0,
          minHeight: 'auto',
          '&.Mui-expanded': { minHeight: 'auto' },
        },
        content: {
          margin: '8px 0',
          '&.Mui-expanded': { margin: '8px 0' },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: { padding: '0 0 8px 0' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
