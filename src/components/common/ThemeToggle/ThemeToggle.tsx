'use client';

import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import { useColorScheme } from '@mui/material/styles';

// Cycles light ⇄ dark, persisted by MUI (writes data-theme). MUI leaves `mode`
// undefined on the server and until mount, so we render a placeholder until it
// resolves — this avoids an SSR/CSR hydration mismatch on the icon without a
// setState-in-effect (which React's lint rules flag).
export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  if (!mode) return <IconButton aria-hidden tabIndex={-1} sx={{ width: 40, height: 40 }} />;

  const resolved = mode === 'system' ? systemMode : mode;
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <IconButton
      onClick={() => setMode(next)}
      aria-label={next === 'dark' ? 'Włącz tryb ciemny' : 'Włącz tryb jasny'}
      sx={{ color: 'var(--ink)' }}
    >
      {resolved === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
}
