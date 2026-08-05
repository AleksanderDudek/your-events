'use client';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import LogoMark from '@/components/common/LogoMark/LogoMark';
import { useTranslation } from '@/i18n';
import styles from './WelcomeSheet.module.scss';

interface WelcomeSheetProps {
  /** Locative form of the current city, for the one-line pitch. */
  cityLocative: string;
  onSkip: () => void;
  onStart: () => void;
}

/**
 * The first thing a new visitor sees (after the cookie banner has been
 * answered): what the site is, three things it can do, and an invitation to be
 * shown around.
 *
 * Deliberately an invitation rather than a tour that has already started — a
 * walkthrough nobody agreed to is the most-skipped pattern in onboarding, and
 * it stands between the visitor and the events they came for.
 */
export default function WelcomeSheet({ cityLocative, onSkip, onStart }: WelcomeSheetProps) {
  const { t } = useTranslation();

  const bullets = [
    { icon: <SearchIcon fontSize="small" />, text: t.ONBOARDING_BULLET_FILTER },
    { icon: <MapIcon fontSize="small" />, text: t.ONBOARDING_BULLET_VIEW },
    { icon: <BookmarkAddOutlinedIcon fontSize="small" />, text: t.ONBOARDING_BULLET_PRESET },
  ];

  return (
    <Dialog
      open
      // Closing by backdrop or Esc is a skip: both are the visitor saying "not
      // now", and leaving the sheet to reappear on the next page load would
      // turn a dismissal into a nag.
      onClose={onSkip}
      fullWidth
      maxWidth="xs"
      aria-labelledby="onboarding-title"
      slotProps={{ paper: { className: styles.paper } }}
    >
      <DialogContent sx={{ pb: 1 }}>
        <Box className={styles.header}>
          <LogoMark size={28} />
          <Typography id="onboarding-title" component="h2" className={styles.title}>
            {t.ONBOARDING_TITLE}
          </Typography>
        </Box>

        <Typography variant="body2" className={styles.body}>
          {t.ONBOARDING_BODY(cityLocative)}
        </Typography>

        <Box component="ul" className={styles.bullets}>
          {bullets.map((bullet) => (
            <Box component="li" key={bullet.text} className={styles.bullet}>
              <span className={styles.bulletIcon} aria-hidden="true">
                {bullet.icon}
              </span>
              <span>{bullet.text}</span>
            </Box>
          ))}
        </Box>
      </DialogContent>

      {/* One coral CTA per view (design brief §7): "show me" is contained,
          "skip" is the quiet outlined pair beside it — equally reachable, but
          not competing for the eye. */}
      <DialogActions className={styles.actions}>
        <Button variant="outlined" onClick={onSkip}>
          {t.ONBOARDING_SKIP}
        </Button>
        <Button variant="contained" onClick={onStart} autoFocus>
          {t.ONBOARDING_START}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
