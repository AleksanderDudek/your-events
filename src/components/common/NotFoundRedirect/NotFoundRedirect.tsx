'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { isCityId } from '@/config/cities';
import { useTranslation } from '@/i18n';

const SECONDS = 6;

// redirectTo === '/' means "decide from the path": if it starts with a valid
// city, send to that city's search; otherwise to the picker.
export default function NotFoundRedirect({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [left, setLeft] = useState(SECONDS);

  const firstSeg = pathname.split('/').filter(Boolean)[0];
  const target = redirectTo === '/' && isCityId(firstSeg) ? `/${firstSeg}/wydarzenia` : redirectTo;

  useEffect(() => {
    const tick = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const go = window.setTimeout(() => router.push(target as Route), SECONDS * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(go);
    };
  }, [router, target]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', px: 3 }}>
      <Typography variant="h1" sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '4rem', md: '6rem' }, color: 'var(--color-accent-primary)', mb: 2 }}>
        404
      </Typography>
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        {t.NOTFOUND_TITLE}
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
        {t.NOTFOUND_BODY}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-muted)', mb: 3 }} role="status" aria-live="polite">
        {t.NOTFOUND_REDIRECT(left)}
      </Typography>
      <Button component="a" href={target} variant="contained" color="primary" sx={{ minHeight: 44 }}>
        {t.NOTFOUND_CTA}
      </Button>
    </Box>
  );
}
