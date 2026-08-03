'use client';

// Surfaces the translation layer's status to the visitor, and — where the
// on-device Translator API does not exist at all — offers Google's page
// widget as an explicit, opt-in fallback.
//
// Hydration is the trap: during the static export there is no `Translator`,
// so the engine reports `unsupported` and the prerendered HTML has nothing in
// it. A Chrome visitor's first client render would disagree (a different
// status) the instant `useTranslationStatus` is wired to a live store, and
// every non-Chrome visitor would see the Google offer flash before anything
// is actually known. Rendering `null` until a mount effect has run keeps the
// first client paint identical to the server, in every browser.

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '@/i18n';
import { useTranslationStatus } from '@/i18n/translation';
import styles from './TranslationNotice.module.scss';

// English is the only translation target today (see the spec's "out of
// scope"); the source locale is where nothing is ever offered.
const SOURCE_LOCALE = 'pl';

const GOOGLE_CONTAINER_ID = 'go-to-city-google-translate-target';
const GOOGLE_SCRIPT_SELECTOR = 'script[data-go-to-city-google-translate]';
// Fixed, not generated: only one `TranslationNotice` is ever mounted (in
// `AppLayout`), so there is nothing to disambiguate between instances.
const GOOGLE_TRANSLATE_CALLBACK = 'goToCityGoogleTranslateInit';

// The widget's <select> is inserted asynchronously by Google's script; there
// is no event to await, so it is polled for a bounded number of attempts and
// then given up on quietly.
const COMBO_POLL_ATTEMPTS = 20;
const COMBO_POLL_INTERVAL_MS = 250;

declare global {
  interface Window {
    // Matches GOOGLE_TRANSLATE_CALLBACK above — TS interface members cannot
    // be computed, so the literal is repeated rather than referenced.
    goToCityGoogleTranslateInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay: boolean },
          containerId: string
        ) => unknown;
      };
    };
  }
}

/** Polls for the widget's language <select> and drives it to `target`. Gives up quietly if it never appears. */
function driveGoogleTranslateTo(target: string): void {
  let attempts = 0;

  const tick = () => {
    const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (combo) {
      combo.value = target;
      combo.dispatchEvent(new Event('change'));
      return;
    }
    attempts += 1;
    if (attempts >= COMBO_POLL_ATTEMPTS) return;
    window.setTimeout(tick, COMBO_POLL_INTERVAL_MS);
  };

  tick();
}

export default function TranslationNotice() {
  const [mounted, setMounted] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const { locale, t } = useTranslation();
  const status = useTranslationStatus();

  const scriptInjectedRef = useRef(false);

  useEffect(() => {
    // Intentional: this is the mount gate itself, so the state update can
    // only ever happen after the first (server-matching) paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // A previous `error` notice that was dismissed should not stay hidden
  // forever if the user primes again later and it fails a second time.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status !== 'error') setErrorDismissed(false);
  }, [status]);

  const handleActivateGoogleTranslate = () => {
    // The ref covers this mount; the selector covers a remount finding a
    // script a previous mount already injected (AppLayout normally persists,
    // but nothing here depends on that).
    if (scriptInjectedRef.current || document.querySelector(GOOGLE_SCRIPT_SELECTOR)) {
      driveGoogleTranslateTo(locale);
      return;
    }
    scriptInjectedRef.current = true;

    window[GOOGLE_TRANSLATE_CALLBACK] = () => {
      try {
        const TranslateElement = window.google?.translate?.TranslateElement;
        if (!TranslateElement) return;
        // The widget attaches itself to the container by ID; there is
        // nothing on the constructed instance worth holding onto.
        new TranslateElement({ pageLanguage: SOURCE_LOCALE, autoDisplay: false }, GOOGLE_CONTAINER_ID);
        driveGoogleTranslateTo(locale);
      } catch {
        // Widget failed to initialise from a loaded script — the page is
        // left exactly as it was.
      }
    };

    const script = document.createElement('script');
    script.src = `https://translate.google.com/translate_a/element.js?cb=${GOOGLE_TRANSLATE_CALLBACK}`;
    script.async = true;
    script.dataset.goToCityGoogleTranslate = 'true';
    script.onerror = () => {
      // Network failure, ad-blocker, CSP — nothing third-party ever loaded,
      // so there is nothing to unwind.
    };
    document.body.appendChild(script);
  };

  if (!mounted) return null;
  if (locale === SOURCE_LOCALE) return null;

  if (status === 'downloading') {
    return (
      <Box className={styles.wrapper}>
        <Box
          className={styles.loadingPill}
          role="status"
          aria-live="polite"
          aria-label={t.TRANSLATION_DOWNLOADING}
        >
          <CircularProgress size={12} thickness={5} sx={{ color: 'var(--color-accent-primary)' }} />
          <Typography variant="caption" sx={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>
            {t.TRANSLATION_DOWNLOADING}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (status === 'error' && !errorDismissed) {
    return (
      <Box className={styles.wrapper}>
        <Box className={styles.banner} role="alert">
          <Typography variant="body2">{t.TRANSLATION_ERROR}</Typography>
          <IconButton
            size="small"
            aria-label={t.TRANSLATION_ERROR_DISMISS}
            onClick={() => setErrorDismissed(true)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  if (status === 'unsupported') {
    return (
      <Box className={styles.wrapper}>
        <Box className={styles.banner}>
          <Typography variant="body2">{t.TRANSLATION_OFFER_BODY}</Typography>
          <Button size="small" variant="outlined" onClick={handleActivateGoogleTranslate}>
            {t.TRANSLATION_OFFER_CTA}
          </Button>
        </Box>
        {/* Where the widget mounts once activated — invisible by design, see
            the module stylesheet; the visible surface is the copy above. */}
        <div id={GOOGLE_CONTAINER_ID} className={styles.hiddenContainer} />
      </Box>
    );
  }

  // 'ready' / 'idle' — nothing to say.
  return null;
}
