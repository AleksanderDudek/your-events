'use client';

import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';

// Shape-matched to EventCard — heights and grid rows mirror those in
// EventCard.module.scss so the grid doesn't reflow when data hydrates.
// Keep these constants in lockstep with the SCSS file's $card-h-* and
// $title-row / $venue-row / $chips-row / $footer-row values.
const CARD_HEIGHT = { xs: 220, sm: 226, md: 232 };
const BAND_HEIGHT = { xs: 72, md: 80 };

export default function SkeletonCard() {
  return (
    <Card
      sx={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{
          height: BAND_HEIGHT,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-elevated)',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateRows: '36px 18px 26px 1fr 26px',
          rowGap: 4,
          flex: 1,
          minHeight: 0,
          padding: '10px 12px',
        }}
      >
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            width: '85%',
            height: 14,
            borderRadius: 0.5,
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        />
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            width: '60%',
            height: 12,
            borderRadius: 0.5,
            backgroundColor: 'var(--color-bg-elevated)',
            alignSelf: 'center',
          }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Skeleton
            variant="rounded"
            width={56}
            height={20}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
          <Skeleton
            variant="rounded"
            width={48}
            height={20}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
        </div>
        <div />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 6,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              width: 56,
              height: 14,
              borderRadius: 0.5,
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          />
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              width: 70,
              height: 12,
              borderRadius: 0.5,
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          />
        </div>
      </div>
    </Card>
  );
}
