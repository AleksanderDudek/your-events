'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslation } from '@/i18n';

interface IosInstallDialogProps {
  open: boolean;
  onClose: () => void;
}

// iOS delivers web push only to Home Screen web apps, and from iOS 26 every
// Home Screen site opens as one. These are the three taps that get there.
export default function IosInstallDialog({ open, onClose }: IosInstallDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="push-ios-title" fullWidth maxWidth="xs">
      <DialogTitle id="push-ios-title" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {t.PUSH_IOS_TITLE}
      </DialogTitle>
      <DialogContent>
        <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {t.PUSH_IOS_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          {t.PUSH_IOS_CLOSE}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
