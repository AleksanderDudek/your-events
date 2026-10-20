'use client';

import Box from '@mui/material/Box';
import SkeletonRow from '@/components/ui/SkeletonRow/SkeletonRow';

interface EventListSkeletonProps {
  count: number;
}

export default function EventListSkeleton({ count }: EventListSkeletonProps) {
  return (
    <Box
      aria-busy="true"
      aria-live="polite"
      sx={{
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </Box>
  );
}
