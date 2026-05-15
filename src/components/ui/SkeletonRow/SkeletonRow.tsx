'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

// Row-shaped skeleton mirroring EventRow's layout: a date column on the left,
// a content column with title + meta + price, and a chevron column. Keeping
// the shape match means the grid doesn't reflow when real data lands.
export default function SkeletonRow() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 2, md: 3 },
        padding: { xs: '16px', md: '20px 24px' },
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 48,
          flexShrink: 0,
          gap: 0.5,
        }}
      >
        <Skeleton
          variant="text"
          width={32}
          height={28}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Skeleton
          variant="text"
          width={28}
          height={14}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Skeleton
            variant="rounded"
            width={48}
            height={48}
            animation="wave"
            sx={{ flex: '0 0 48px', backgroundColor: 'var(--color-bg-elevated)' }}
          />
          <Skeleton
            variant="text"
            width="70%"
            height={22}
            animation="wave"
            sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton
            variant="rounded"
            width={64}
            height={20}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
          <Skeleton
            variant="rounded"
            width={80}
            height={20}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
        </Box>
        <Skeleton
          variant="text"
          width={120}
          height={18}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
      </Box>

      <Skeleton
        variant="circular"
        width={20}
        height={20}
        animation="wave"
        sx={{ flexShrink: 0, backgroundColor: 'var(--color-bg-elevated)' }}
      />
    </Box>
  );
}
