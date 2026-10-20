'use client';

import Box from '@mui/material/Box';
import SkeletonCard from '@/components/ui/SkeletonCard/SkeletonCard';
import styles from './EventGrid.module.scss';

interface EventGridSkeletonProps {
  count: number;
}

export default function EventGridSkeleton({ count }: EventGridSkeletonProps) {
  return (
    <Box className={styles.grid} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </Box>
  );
}
