import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from 'next/link';
import EventIcon from '@mui/icons-material/Event';

export default function EventNotFound() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <EventIcon sx={{ fontSize: 64, color: 'var(--color-text-muted)', mb: 2 }} />
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        Nie znaleziono wydarzenia
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 4 }}>
        Wydarzenie mogło zostać usunięte lub link jest nieprawidłowy.
      </Typography>
      <Button
        component={Link}
        href="/events"
        variant="contained"
        color="primary"
        sx={{ minHeight: 44 }}
      >
        Wróć do wydarzeń
      </Button>
    </Box>
  );
}
