'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { AVAILABLE_CITIES } from '@/config/cities';
import { withBasePath } from '@/lib/constants';
import { useTranslation } from '@/i18n';

// Illustrated hero image per city (served from /public). Cities without an
// image fall back to a gradient tile of the same dimensions, so every card
// stays the same size regardless of coverage.
const CITY_IMAGES: Record<string, string> = {
  wroclaw: '/images/cities/wroclaw.jpg',
  szczecin: '/images/cities/szczecin.jpg',
  poznan: '/images/cities/poznan.jpg',
  gdansk: '/images/cities/gdansk.jpg',
  krakow: '/images/cities/krakow.jpg',
  warszawa: '/images/cities/warszawa.jpg',
};

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
        py: 6,
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

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          justifyContent: 'center',
          width: '100%',
          maxWidth: 760,
        }}
      >
        {AVAILABLE_CITIES.map((city) => {
          const name = city.displayName[locale];
          const image = CITY_IMAGES[city.id];
          return (
            <Link key={city.id} href={`/${city.id}` as Route} style={{ textDecoration: 'none' }}>
              <Box
                sx={{
                  // Uniform card: fixed width + fixed aspect ratio → every card
                  // is identical in size; the image is cover-cropped to match.
                  position: 'relative',
                  width: { xs: '86vw', sm: 340 },
                  maxWidth: 360,
                  aspectRatio: '3 / 2',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card, 0 2px 12px rgba(0, 0, 0, 0.08))',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'var(--color-accent-primary)',
                    boxShadow: 'var(--shadow-card-hover, 0 12px 32px rgba(0, 0, 0, 0.2))',
                  },
                  '&:hover img': { transform: 'scale(1.06)' },
                }}
              >
                {image ? (
                  // Plain <img> (not next/image): images are unoptimized in the
                  // static export anyway, and next/image drops the basePath from
                  // the src. withBasePath applies the real base path so it works
                  // under /your-events and at the root alike.
                  <Box
                    component="img"
                    src={withBasePath(image)}
                    alt=""
                    loading="eager"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, #ec4899 0%, #f97316 50%, #8b5cf6 100%)',
                    }}
                  />
                )}

                {/* Scrim keeps the label legible over any image. */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0.18) 38%, rgba(0, 0, 0, 0) 62%)',
                  }}
                />

                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <PlaceIcon sx={{ color: '#fff', fontSize: 20 }} />
                  <Typography
                    variant="h6"
                    component="span"
                    sx={{
                      color: '#fff',
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      textShadow: '0 1px 6px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {name}
                  </Typography>
                </Box>
              </Box>
            </Link>
          );
        })}
      </Box>
    </Box>
  );
}
