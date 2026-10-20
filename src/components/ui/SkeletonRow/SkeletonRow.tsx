'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

// Shape-matched to EventRow — fixed 88px (mobile) / 84px (md+) height with the
// date column, square icon tile, title + meta line, and a right-aligned price.
// Keeping the dimensions in lockstep with EventRow prevents the list reflowing
// when real data hydrates.
export default function SkeletonRow() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, md: 2 },
        padding: { xs: '10px 12px', md: '12px 20px' },
        height: { xs: 88, md: 84 },
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 36,
          flexShrink: 0,
          gap: 0.5,
        }}
      >
        <Skeleton
          variant="text"
          width={26}
          height={22}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Skeleton
          variant="text"
          width={24}
          height={12}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
      </Box>

      <Skeleton
        variant="rounded"
        animation="wave"
        sx={{
          width: { xs: 44, md: 48 },
          height: { xs: 44, md: 48 },
          flex: { xs: '0 0 44px', md: '0 0 48px' },
          backgroundColor: 'var(--color-bg-elevated)',
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Skeleton
          variant="text"
          width="75%"
          height={18}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Skeleton
          variant="text"
          width="55%"
          height={14}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
      </Box>

      <Skeleton
        variant="text"
        width={56}
        height={18}
        animation="wave"
        sx={{ flexShrink: 0, backgroundColor: 'var(--color-bg-elevated)' }}
      />

      <Skeleton
        variant="circular"
        width={18}
        height={18}
        animation="wave"
        sx={{ flexShrink: 0, backgroundColor: 'var(--color-bg-elevated)' }}
      />
    </Box>
  );
}
