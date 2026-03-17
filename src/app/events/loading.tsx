import Box from '@mui/material/Box';
import SkeletonCard from '@/components/ui/SkeletonCard/SkeletonCard';

export default function EventsListLoading() {
  return (
    <Box
      sx={{
        maxWidth: 1400,
        mx: 'auto',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 3,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </Box>
    </Box>
  );
}
