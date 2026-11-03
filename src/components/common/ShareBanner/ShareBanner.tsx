'use client';

import Image from 'next/image';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useTranslation } from '@/i18n';
import { openShareDialog, useShareBanner } from '@/components/service/usePromoShare';
import { PROMO_MEDIA } from '@/lib/share';
import styles from './ShareBanner.module.scss';

/**
 * The home page's "Poleć znajomym" card, between the tiles and the map.
 *
 * In the page flow, not floating: the cookie banner and the welcome sheet
 * already take turns over the content on a first visit, and a third overlay
 * would bury the tiles people came for. Hidden for good with its ×.
 */
export default function ShareBanner() {
  const { t } = useTranslation();
  const { isVisible, dismiss } = useShareBanner();
  if (!isVisible) return null;

  return (
    <section className={styles.banner} aria-labelledby="share-banner-title">
      {/* The thumbnail is a second way into the same dialog, so it is hidden
          from assistive tech and the keyboard: the CTA is the one control. */}
      <button
        type="button"
        className={styles.thumb}
        onClick={() => openShareDialog('banner')}
        aria-hidden="true"
        tabIndex={-1}
      >
        <Image src={PROMO_MEDIA.story.poster} alt="" fill unoptimized sizes="104px" />
        <span className={styles.play}>
          <PlayArrowRoundedIcon />
        </span>
      </button>

      <div className={styles.text}>
        <p className={styles.eyebrow}>{t.SHARE_BANNER_EYEBROW}</p>
        <h2 id="share-banner-title" className={styles.title}>
          {t.SHARE_BANNER_TITLE}
        </h2>
        <p className={styles.body}>{t.SHARE_BANNER_BODY}</p>
        <Button
          variant="contained"
          startIcon={<IosShareIcon />}
          onClick={() => openShareDialog('banner')}
          className={styles.cta}
        >
          {t.SHARE_BANNER_CTA}
        </Button>
      </div>

      <IconButton onClick={dismiss} aria-label={t.SHARE_BANNER_DISMISS} className={styles.dismiss} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </section>
  );
}
