'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f4a228',
      light: '#f7b955',
      dark: '#c47f1a',
      contrastText: '#0f0f13',
    },
    secondary: {
      main: '#5b8def',
      light: '#83aaf3',
      dark: '#3d6fd4',
    },
    error: {
      main: '#ef5350',
    },
    warning: {
      main: '#f4a228',
    },
    success: {
      main: '#3ecf8e',
    },
    background: {
      default: '#0f0f13',
      paper: '#1a1a24',
    },
    text: {
      primary: '#f0ede8',
      secondary: '#b8b4be',
      disabled: '#7a7585',
    },
    divider: '#2e2e3e',
  },
  typography: {
    fontFamily: 'var(--font-dm-sans), sans-serif',
    h1: {
      fontFamily: 'var(--font-playfair), serif',
      fontWeight: 700,
    },
    h2: {
      fontFamily: 'var(--font-playfair), serif',
      fontWeight: 700,
    },
    h3: {
      fontFamily: 'var(--font-dm-sans), sans-serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: 'var(--font-dm-sans), sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: 'var(--font-dm-sans), sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: 'var(--font-dm-sans), sans-serif',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.9375rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: `radial-gradient(ellipse 80% 40% at 50% -10%, rgba(244,162,40,0.06) 0%, transparent 60%), #0f0f13`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(26, 26, 36, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #2e2e3e',
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 500,
        },
        outlined: {
          borderColor: '#f4a228',
          color: '#f4a228',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
          padding: '8px 20px',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#c47f1a',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a24',
          borderColor: '#2e2e3e',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&.Mui-focused fieldset': {
              borderColor: '#f4a228',
            },
          },
          '& .MuiInput-underline:after': {
            borderBottomColor: '#f4a228',
          },
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: '#b8b4be',
            '&.Mui-selected': {
              backgroundColor: '#f4a228',
              color: '#0f0f13',
              '&:hover': {
                backgroundColor: '#c47f1a',
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
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          padding: 0,
          minHeight: 'auto',
          '&.Mui-expanded': {
            minHeight: 'auto',
          },
        },
        content: {
          margin: '8px 0',
          '&.Mui-expanded': {
            margin: '8px 0',
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '0 0 8px 0',
        },
      },
    },
  },
});
