'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { AVAILABLE_CITIES } from '@/config/cities';
import { useTranslation } from '@/i18n';

export default function CityPickerView() {
  const { t, locale } = useTranslation();
  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        gap: 4,
      }}
    >
      <Box>
        <Typography variant="h3" component="h1" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t.CITY_PICKER_TITLE}
        </Typography>
        <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mt: 1 }}>
          {t.CITY_PICKER_SUBTITLE}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
        {AVAILABLE_CITIES.map((city) => (
          <Link key={city.id} href={`/${city.id}` as Route} style={{ textDecoration: 'none' }}>
            <Box
              sx={{
                minWidth: 200,
                p: 3,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'var(--color-accent-primary)' },
              }}
            >
              <PlaceIcon sx={{ color: 'var(--color-accent-primary)' }} />
              <Typography variant="h6" sx={{ color: 'var(--color-text-primary)' }}>
                {city.displayName[locale]}
              </Typography>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
