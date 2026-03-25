import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export default function NotFound() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: { xs: '4rem', md: '6rem' },
          color: 'var(--color-accent-primary)',
          mb: 2,
        }}
      >
        404
      </Typography>
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        Nie znaleziono strony
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 4 }}>
        Strona, której szukasz, nie istnieje lub została przeniesiona.
      </Typography>
      <Button
        component="a"
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
