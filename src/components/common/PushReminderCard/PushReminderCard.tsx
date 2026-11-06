'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/lib/analytics';
import type { PushReminder } from '@/components/service/usePushReminder';
import IosInstallDialog from './IosInstallDialog';

interface PushReminderCardProps {
  reminder: PushReminder;
  /** A failure raised outside the card (a tile bell), shown like the switch's own. */
  failed?: boolean;
}

/** The on/off switch for push reminders, at the top of /moje-filtry. */
export default function PushReminderCard({ reminder, failed: failedElsewhere = false }: PushReminderCardProps) {
  const { t } = useTranslation();
  const [iosOpen, setIosOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!reminder.available || reminder.support === 'unsupported') {
    return null;
  }

  const toggle = async (on: boolean) => {
    if (reminder.busy) return;
    setFailed(false);
    if (on) {
      if ((await reminder.enable()) === 'failed') setFailed(true);
    } else {
      await reminder.disable();
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="push-card-title"
      sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 2, mb: 3 }}
    >
      <Typography
        id="push-card-title"
        variant="h2"
        sx={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <NotificationsActiveOutlinedIcon fontSize="small" aria-hidden="true" />
        {t.PUSH_CARD_TITLE}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5, mb: 1 }}>
        {t.PUSH_CARD_BODY}
      </Typography>

      {reminder.support === 'ready' && (
        <FormControlLabel
          control={
            <Switch
              checked={reminder.enabled}
              onChange={(e) => void toggle(e.target.checked)}
              slotProps={{ input: { role: 'switch', 'aria-disabled': reminder.busy } }}
            />
          }
          label={t.PUSH_SWITCH}
        />
      )}

      {reminder.support === 'blocked' && (
        <Typography variant="body2" role="status">
          {t.PUSH_BLOCKED}
        </Typography>
      )}

      {reminder.support === 'ios-install-first' && (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            trackEvent('push_ios_install_shown');
            setIosOpen(true);
          }}
        >
          {t.PUSH_IOS_BUTTON}
        </Button>
      )}

      {(failed || failedElsewhere) && (
        <Typography variant="body2" role="alert" sx={{ color: 'error.main', mt: 1 }}>
          {t.PUSH_FAILED}
        </Typography>
      )}

      <IosInstallDialog open={iosOpen} onClose={() => setIosOpen(false)} />
    </Box>
  );
}
