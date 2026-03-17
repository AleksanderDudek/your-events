'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

export default function SkeletonCard() {
  return (
    <Card
      sx={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <Skeleton
        variant="rectangular"
        height={180}
        animation="wave"
        sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
      />
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton
          variant="text"
          width="80%"
          height={28}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Skeleton
          variant="text"
          width="50%"
          height={20}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Skeleton
          variant="text"
          width="60%"
          height={20}
          animation="wave"
          sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Skeleton
            variant="rounded"
            width={60}
            height={24}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
          <Skeleton
            variant="rounded"
            width={50}
            height={24}
            animation="wave"
            sx={{ borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-bg-elevated)' }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Skeleton
            variant="text"
            width={70}
            height={20}
            animation="wave"
            sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
          />
          <Skeleton
            variant="text"
            width={90}
            height={20}
            animation="wave"
            sx={{ backgroundColor: 'var(--color-bg-elevated)' }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
