'use client';

import { useState } from 'react';
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
import {
  REMINDER_TITLE_ID,
  ReminderStep,
  canOfferReminder,
  type OnboardingReminder,
} from './ReminderStep';
import styles from './WelcomeSheet.module.scss';

export type { OnboardingReminder };

interface WelcomeSheetProps {
  /** Locative form of the current city, for the one-line pitch. */
  cityLocative: string;
  onSkip: () => void;
  onStart: () => void;
  /** Push reminders; absent = no reminder offer at all. */
  reminder?: OnboardingReminder;
  /** The notification step was answered, whichever way. */
  onReminderAnswered?: () => void;
}

/**
 * The first thing a new visitor sees: what the site is, three things it can
 * do, and an invitation to be shown around. Then, when this browser can show
 * notifications, a second page asking to turn them on.
 *
 * Deliberately an invitation rather than a tour that has already started — a
 * walkthrough nobody agreed to is the most-skipped pattern in onboarding, and
 * it stands between the visitor and the events they came for.
 */
export default function WelcomeSheet({
  cityLocative,
  onSkip,
  onStart,
  reminder,
  onReminderAnswered,
}: WelcomeSheetProps) {
  const { t } = useTranslation();
  // The welcome button that was pressed, held while the notification page is
  // up. Both buttons lead there: skipping the tour is not declining reminders.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const offer = canOfferReminder(reminder);

  const go = (next: () => void) => () => {
    if (offer) setPending(() => next);
    else next();
  };

  const finishReminder = () => {
    onReminderAnswered?.();
    pending?.();
  };

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
      onClose={pending ? finishReminder : onSkip}
      fullWidth
      maxWidth="xs"
      aria-labelledby={pending ? REMINDER_TITLE_ID : 'onboarding-title'}
      slotProps={{ paper: { className: styles.paper } }}
    >
      {pending && reminder ? (
        <ReminderStep reminder={reminder} onFinish={finishReminder} />
      ) : (
        <>
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
            <Button variant="outlined" onClick={go(onSkip)}>
              {t.ONBOARDING_SKIP}
            </Button>
            <Button variant="contained" onClick={go(onStart)} autoFocus>
              {t.ONBOARDING_START}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
