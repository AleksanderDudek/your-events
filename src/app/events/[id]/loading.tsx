import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

export default function EventDetailLoading() {
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      <Skeleton
        variant="rounded"
        width={80}
        height={36}
        sx={{ mb: 2, backgroundColor: 'var(--color-bg-elevated)' }}
      />
      <Skeleton
        variant="rounded"
        height={280}
        sx={{ mb: 3, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-elevated)' }}
      />
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={40} sx={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          <Skeleton variant="text" width="50%" height={24} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 1 }} />
          <Skeleton variant="text" width="60%" height={24} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 1 }} />
          <Skeleton variant="rectangular" height={120} sx={{ backgroundColor: 'var(--color-bg-elevated)', mt: 3, borderRadius: 1 }} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 320 } }}>
          <Skeleton
            variant="rounded"
            height={300}
            sx={{ backgroundColor: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}
          />
        </Box>
      </Box>
    </Box>
  );
}
