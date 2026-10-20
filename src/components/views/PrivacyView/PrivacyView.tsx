'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';

export default function PrivacyView() {
  const { t } = useTranslation();

  // A flat list of sections, each rendered as its own h2 — the page carries a
  // single h1 (the title) with no nested subsections, so there is no reason
  // to step down to h3.
  const sections = [
    { key: 'what', heading: t.PRIVACY_WHAT_HEADING, body: t.PRIVACY_WHAT_BODY },
    { key: 'cookies', heading: t.PRIVACY_COOKIES_HEADING, body: t.PRIVACY_COOKIES_BODY },
    { key: 'processor', heading: t.PRIVACY_PROCESSOR_HEADING, body: t.PRIVACY_PROCESSOR_BODY },
    { key: 'withdraw', heading: t.PRIVACY_WITHDRAW_HEADING, body: t.PRIVACY_WITHDRAW_BODY },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h1" gutterBottom>
        {t.PRIVACY_TITLE}
      </Typography>
      <Typography variant="body1">{t.PRIVACY_INTRO}</Typography>
      {sections.map((s) => (
        <Box key={s.key} sx={{ mt: 4 }}>
          <Typography variant="h2" gutterBottom>
            {s.heading}
          </Typography>
          <Typography variant="body1">{s.body}</Typography>
        </Box>
      ))}
    </Container>
  );
}
