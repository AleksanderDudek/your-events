'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import LogoMark from '@/components/common/LogoMark/LogoMark';
import IosInstallDialog from '@/components/common/PushReminderCard/IosInstallDialog';
import type { PushReminder } from '@/components/service/usePushReminder';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/lib/analytics';
import styles from './WelcomeSheet.module.scss';

/** The slice of usePushReminder the sheet needs. */
export type OnboardingReminder = Pick<PushReminder, 'available' | 'support' | 'enabled' | 'enable'>;

interface WelcomeSheetProps {
  /** Locative form of the current city, for the one-line pitch. */
  cityLocative: string;
  onSkip: () => void;
  onStart: () => void;
  /** Push reminders; absent = no reminder offer at all. */
  reminder?: OnboardingReminder;
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
export default function WelcomeSheet({ cityLocative, onSkip, onStart, reminder }: WelcomeSheetProps) {
  const { t } = useTranslation();
  // Ticked by default: a reminder can never be on without a click, because
  // browsers only show the permission prompt in answer to one. Both buttons
  // below are that click, so a ticked box costs the visitor nothing but the
  // browser's own "Allow". Unticking it is the opt-out.
  const [wantsReminders, setWantsReminders] = useState(true);
  const [iosOpen, setIosOpen] = useState(false);

  const live = Boolean(reminder?.available) && !reminder?.enabled;
  const offerBox = live && reminder?.support === 'ready';
  const offerIos = live && reminder?.support === 'ios-install-first';

  // Called from the two buttons only. Escape and the backdrop also close the
  // sheet, but they mean "not now", and a prompt on top of that is a nag.
  // Not awaited: the browser's prompt can sit unanswered, and the sheet must
  // not stand between the visitor and the events while it does.
  const answer = (next: () => void) => () => {
    if (offerBox && wantsReminders && reminder) {
      trackEvent('push_onboarding_enable');
      void reminder.enable();
    }
    next();
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

        {offerBox && (
          <FormControlLabel
            className={styles.reminder}
            control={
              <Checkbox
                checked={wantsReminders}
                onChange={(e) => setWantsReminders(e.target.checked)}
              />
            }
            label={t.ONBOARDING_REMINDER}
          />
        )}

        {offerIos && (
          <Button
            variant="text"
            size="small"
            className={styles.reminder}
            onClick={() => {
              trackEvent('push_ios_install_shown');
              setIosOpen(true);
            }}
          >
            {t.PUSH_IOS_BUTTON}
          </Button>
        )}
      </DialogContent>

      {/* One coral CTA per view (design brief §7): "show me" is contained,
          "skip" is the quiet outlined pair beside it — equally reachable, but
          not competing for the eye. */}
      <DialogActions className={styles.actions}>
        <Button variant="outlined" onClick={answer(onSkip)}>
          {t.ONBOARDING_SKIP}
        </Button>
        <Button variant="contained" onClick={answer(onStart)} autoFocus>
          {t.ONBOARDING_START}
        </Button>
      </DialogActions>

      {offerIos && <IosInstallDialog open={iosOpen} onClose={() => setIosOpen(false)} />}
    </Dialog>
  );
}
