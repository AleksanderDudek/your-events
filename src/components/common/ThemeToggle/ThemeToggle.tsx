'use client';

import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import { useColorScheme } from '@mui/material/styles';

// Cycles light ⇄ dark, persisted by MUI (writes data-theme). Renders nothing
// until mounted to avoid an SSR/CSR mismatch on the icon.
export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <IconButton aria-hidden sx={{ width: 40, height: 40 }} />;

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
