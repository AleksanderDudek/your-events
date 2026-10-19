import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useIsClient } from '@/components/service/useIsClient';
import { useTranslation } from '@/i18n';

// A tab left open for days should still hear about a new deploy.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and, when a new version of the app has been
 * downloaded, asks before switching to it.
 *
 * Asking rather than reloading on its own (registerType: 'prompt'): someone
 * half-way through setting filters would lose what they were doing. A
 * dismissed prompt is harmless — the new version takes over on the next visit.
 */
export default function PwaUpdatePrompt() {
  // useRegisterSW registers as it initializes. Mounting it only after
  // hydration keeps that out of the prerender and out of the first render.
  return useIsClient() ? <UpdatePrompt /> : null;
}

function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Wait for the page's own `load`: the precache download must not compete
    // with the first paint.
    immediate: false,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (registration.installing || !navigator.onLine) return;
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message={t.PWA_UPDATE_READY}
      action={
        <>
          <Button color="primary" size="small" onClick={() => void updateServiceWorker(true)}>
            {t.PWA_UPDATE_RELOAD}
          </Button>
          <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
            {t.PWA_DISMISS}
          </Button>
        </>
      }
    />
  );
}
