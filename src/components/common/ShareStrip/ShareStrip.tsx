'use client';

import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from '@/i18n';
import { openShareDialog, useShareStrip } from '@/components/service/usePromoShare';
import styles from './ShareStrip.module.scss';

/**
 * The thin "Poleć znajomym" bar under the toolbar, inside the sticky header so
 * the two scroll as one. The whole bar is one button into the share dialog;
 * the × hides it for good, and so does a completed share.
 *
 * Prerendered for everyone. A visitor who hid it has <html
 * data-share-strip="off"> set before first paint (see @/lib/shareStrip), which
 * hides it in CSS; this component then unmounts it after hydration.
 */
export default function ShareStrip() {
  const { t } = useTranslation();
  const { isVisible, dismiss } = useShareStrip();
  if (!isVisible) return null;

  return (
    <div className={styles.strip}>
      <button type="button" className={styles.open} onClick={() => openShareDialog('strip')}>
        <IosShareIcon className={styles.icon} aria-hidden="true" />
        {/* One of the two is display:none at any width, which also takes it
            out of the button's accessible name. */}
        <span className={styles.short}>{t.SHARE_STRIP_SHORT}</span>
        <span className={styles.long}>{t.SHARE_STRIP_LONG}</span>
        <span className={styles.cta}>
          {t.SHARE_STRIP_CTA}
          <ArrowForwardIcon className={styles.arrow} aria-hidden="true" />
        </span>
      </button>
      <IconButton onClick={dismiss} aria-label={t.SHARE_STRIP_DISMISS} className={styles.dismiss} size="small">
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </div>
  );
}
