'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import IosInstallDialog from '@/components/common/PushReminderCard/IosInstallDialog';
import type { PushReminder } from '@/components/service/usePushReminder';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/lib/analytics';
import styles from './WelcomeSheet.module.scss';

/** The slice of usePushReminder the onboarding needs. */
export type OnboardingReminder = Pick<PushReminder, 'available' | 'support' | 'enabled' | 'enable'>;

export const REMINDER_TITLE_ID = 'onboarding-reminder-title';

/**
 * Whether there is anything to ask. Only two states have a next move: a
 * browser that can show the permission prompt right now, and an iPhone tab,
 * which first has to be added to the Home Screen. Blocked, unsupported, still
 * checking or already on: nothing to ask.
 */
export function canOfferReminder(reminder: OnboardingReminder | undefined): boolean {
  if (!reminder?.available || reminder.enabled) return false;
  return reminder.support === 'ready' || reminder.support === 'ios-install-first';
}

interface ReminderStepProps {
  reminder: OnboardingReminder;
  /** The step is answered, whichever way. */
  onFinish: () => void;
}

/**
 * "Turn on notifications", as content for a dialog that is already open.
 *
 * The button IS the click the browser needs before it will show its own
 * permission prompt, so the prompt appears the moment it is pressed. Not
 * awaited: that prompt can sit unanswered, and the onboarding must not stand
 * between the visitor and the events while it does.
 */
export function ReminderStep({ reminder, onFinish }: ReminderStepProps) {
  const { t } = useTranslation();
  const [iosOpen, setIosOpen] = useState(false);
  const isIos = reminder.support === 'ios-install-first';

  const later = () => {
    trackEvent('push_onboarding_later');
    onFinish();
  };

  const enable = () => {
    trackEvent('push_onboarding_enable');
    void reminder.enable();
    onFinish();
  };

  return (
    <>
      <DialogContent sx={{ pb: 1 }}>
        <Box className={styles.header}>
          <NotificationsActiveOutlinedIcon aria-hidden="true" />
          <Typography id={REMINDER_TITLE_ID} component="h2" className={styles.title}>
            {t.ONBOARDING_REMINDER_TITLE}
          </Typography>
        </Box>
        <Typography variant="body2" className={styles.body}>
          {t.ONBOARDING_REMINDER_BODY}
        </Typography>
        <Typography variant="body2" className={styles.hint}>
          {isIos ? t.ONBOARDING_REMINDER_IOS_HINT : t.ONBOARDING_REMINDER_HINT}
        </Typography>
      </DialogContent>

      <DialogActions className={styles.actions}>
        <Button variant="outlined" onClick={later}>
          {t.ONBOARDING_REMINDER_LATER}
        </Button>
        {isIos ? (
          <Button
            variant="contained"
            autoFocus
            onClick={() => {
              trackEvent('push_ios_install_shown');
              setIosOpen(true);
            }}
          >
            {t.PUSH_IOS_BUTTON}
          </Button>
        ) : (
          <Button variant="contained" autoFocus onClick={enable}>
            {t.ONBOARDING_REMINDER_ENABLE}
          </Button>
        )}
      </DialogActions>

      {isIos && <IosInstallDialog open={iosOpen} onClose={onFinish} />}
    </>
  );
}

/**
 * The step on its own, for a visitor who already saw the welcome sheet before
 * reminders existed (or before this browser could offer them).
 */
export function ReminderSheet({ reminder, onFinish }: ReminderStepProps) {
  return (
    <Dialog
      open
      // Escape or the backdrop: "not now", and remembered as an answer, so the
      // step does not come back on the next page as a nag.
      onClose={onFinish}
      fullWidth
      maxWidth="xs"
      aria-labelledby={REMINDER_TITLE_ID}
      slotProps={{ paper: { className: styles.paper } }}
    >
      <ReminderStep reminder={reminder} onFinish={onFinish} />
    </Dialog>
  );
}
