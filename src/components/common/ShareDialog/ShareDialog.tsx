'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import XIcon from '@mui/icons-material/X';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import EmailIcon from '@mui/icons-material/Email';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { hideShareStrip, useShareDialog } from '@/components/service/usePromoShare';
import { usePromoMedia } from '@/components/service/usePromoMedia';
import { copyText, hasNativeShare, nativeShare } from '@/components/service/webShare';
import { trackEvent } from '@/lib/analytics';
import {
  PROMO_MEDIA,
  PROMO_URL,
  SHARE_TARGETS,
  promoCaption,
  shareTargetUrl,
  type ShareFormat,
  type ShareTarget,
} from '@/lib/share';
import styles from './ShareDialog.module.scss';

const TARGET_ICONS: Record<ShareTarget, React.ReactNode> = {
  whatsapp: <WhatsAppIcon fontSize="small" />,
  facebook: <FacebookIcon fontSize="small" />,
  x: <XIcon fontSize="small" />,
  linkedin: <LinkedInIcon fontSize="small" />,
  email: <EmailIcon fontSize="small" />,
};

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * "Poleć Idź na miasto". One instance lives in AppLayout and opens from the
 * header, its strip, the home tile, the phone menu, the footer and Rozwijaj z
 * nami.
 *
 * Two parts, quickest first, so both fit a phone screen without scrolling to
 * find them:
 * 1. "Wyślij link": one tap to WhatsApp, Facebook, X, LinkedIn, e-mail, the
 *    system sheet ("Więcej") or the clipboard. Text and link, no file.
 * 2. A post or a story with the video: preview beside the caption, then the
 *    native share sheet (where Instagram and TikTok live) or the downloads.
 */
export default function ShareDialog() {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { isOpen, close } = useShareDialog();
  const muiTheme = useTheme();
  const isPhone = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [format, setFormat] = useState<ShareFormat>('post');
  const [toast, setToast] = useState<string | null>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  // Read once the dialog is open (it only ever opens in the browser).
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // A toast whose timer was cut short by closing would otherwise greet
      // the next open, and one bad load would pin the image-only preview.
      setToast(null);
      setVideoBroken(false);
      return;
    }
    setCanNativeShare(hasNativeShare());
    setAutoPlay(!prefersReducedMotion());
  }, [isOpen]);

  const media = usePromoMedia(format, isOpen);
  const assets = PROMO_MEDIA[format];
  const caption = useMemo(
    () => promoCaption(format, t, city.displayName[locale]),
    [format, t, city, locale]
  );

  // The send-a-link row is not tied to a format: always the post caption,
  // which says what the app is rather than teasing it.
  const linkCaption = useMemo(() => promoCaption('post', t, city.displayName[locale]), [t, city, locale]);

  const chooseFormat = (_: unknown, next: ShareFormat | null) => {
    if (!next) return; // exclusive group: re-pressing the active one is not "none"
    setFormat(next);
    setVideoBroken(false);
  };

  const handleShare = async () => {
    const file = media.status === 'ready' ? media.file : null;
    if (file) {
      // Instagram and TikTok drop text that comes with a file; with the caption
      // already on the clipboard it is one paste away. Started before share()
      // so it runs inside the same tap.
      void copyText(caption);
    }
    const outcome = await nativeShare(
      file ? { files: [file], text: caption, title: t.APP_NAME } : { text: caption, title: t.APP_NAME }
    );
    if (outcome === 'shared') {
      hideShareStrip('shared');
      trackEvent(`share_native_${format}_${file && media.status === 'ready' ? media.kind : 'text'}`);
      if (file) setToast(t.SHARE_TOAST_CAPTION_READY);
    } else if (outcome === 'failed') {
      setToast(t.SHARE_TOAST_FAILED);
    }
  };

  const handleCopy = async () => {
    const ok = await copyText(linkCaption);
    setToast(ok ? t.SHARE_TOAST_COPIED : t.SHARE_TOAST_COPY_FAILED);
    if (ok) trackEvent('share_copy_link');
  };

  // Messenger, Telegram, SMS and the rest: the system sheet, text only.
  const handleMore = async () => {
    const outcome = await nativeShare({ text: linkCaption, title: t.APP_NAME });
    if (outcome === 'shared') {
      hideShareStrip('shared');
      trackEvent('share_native_link');
    } else if (outcome === 'failed') {
      setToast(t.SHARE_TOAST_FAILED);
    }
  };

  const shareLabel =
    media.status === 'loading'
      ? t.SHARE_PREPARING(media.progress)
      : media.status === 'ready'
        ? media.kind === 'video'
          ? t.SHARE_NATIVE_VIDEO
          : t.SHARE_NATIVE_IMAGE
        : t.SHARE_NATIVE_TEXT;

  const targetLabel: Record<ShareTarget, string> = {
    whatsapp: t.SHARE_TARGET_WHATSAPP,
    facebook: t.SHARE_TARGET_FACEBOOK,
    x: t.SHARE_TARGET_X,
    linkedin: t.SHARE_TARGET_LINKEDIN,
    email: t.SHARE_TARGET_EMAIL,
  };

  const showImageOnly =
    videoBroken || (media.status === 'ready' && media.kind === 'image');
  const videoSrc = media.status === 'ready' && media.kind === 'video' ? media.objectUrl : assets.video;

  const renderPreview = () => {
    if (showImageOnly) {
      return (
        <Image src={assets.image} alt={t.SHARE_PREVIEW_IMAGE_ALT} fill unoptimized sizes="420px" className={styles.media} />
      );
    }
    if (media.status === 'loading' || media.status === 'idle') {
      // The poster until the file is in hand: a <video> pointed at the URL now
      // would download it a second time alongside the prefetch. 'idle' too —
      // it is the first render after opening, before the prefetch decides.
      return (
        <>
          <Image src={assets.poster} alt="" fill unoptimized sizes="420px" className={styles.media} />
          {media.status === 'loading' && (
            <LinearProgress
              className={styles.progress}
              variant={media.progress === null ? 'indeterminate' : 'determinate'}
              value={media.progress ?? undefined}
              aria-label={shareLabel}
            />
          )}
        </>
      );
    }
    return (
      <video
        key={`${format}-${videoSrc}`}
        className={styles.media}
        src={videoSrc}
        poster={assets.poster}
        controls
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        aria-label={t.SHARE_PREVIEW_LABEL}
        onError={() => setVideoBroken(true)}
      />
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      fullScreen={isPhone}
      fullWidth
      maxWidth="md"
      aria-labelledby="share-dialog-title"
      aria-describedby="share-dialog-lead"
      slotProps={{ paper: { className: styles.paper } }}
    >
      <DialogContent className={styles.content}>
        <div className={styles.head}>
          <div>
            <h2 id="share-dialog-title" className={styles.title}>
              {t.SHARE_DIALOG_TITLE}
            </h2>
            <p id="share-dialog-lead" className={styles.lead}>
              {t.SHARE_DIALOG_LEAD}
            </p>
          </div>
          <IconButton onClick={close} aria-label={t.SHARE_CLOSE} className={styles.close}>
            <CloseIcon />
          </IconButton>
        </div>

        <section className={styles.section} aria-labelledby="share-quick-label">
          <h3 id="share-quick-label" className={styles.sectionLabel}>
            {t.SHARE_QUICK_LABEL}
          </h3>
          <ul className={styles.targets}>
            {canNativeShare && (
              <li>
                <button type="button" className={styles.target} onClick={handleMore}>
                  <span className={styles.targetIcon}>
                    <IosShareIcon fontSize="small" />
                  </span>
                  <span className={styles.targetName}>{t.SHARE_MORE_APPS}</span>
                </button>
              </li>
            )}
            {SHARE_TARGETS.map((target) => (
              <li key={target}>
                <a
                  className={styles.target}
                  href={shareTargetUrl(target, { text: linkCaption, url: PROMO_URL, subject: t.SHARE_EMAIL_SUBJECT })}
                  target={target === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  onClick={() => {
                    hideShareStrip('shared');
                    trackEvent(`share_link_${target}`);
                  }}
                >
                  <span className={`${styles.targetIcon} ${styles[`target-${target}`]}`}>{TARGET_ICONS[target]}</span>
                  <span className={styles.targetName}>{targetLabel[target]}</span>
                </a>
              </li>
            ))}
            <li>
              <button type="button" className={styles.target} onClick={handleCopy}>
                <span className={styles.targetIcon}>
                  <ContentCopyIcon fontSize="small" />
                </span>
                <span className={styles.targetName}>{t.SHARE_COPY}</span>
              </button>
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="share-media-label">
          <h3 id="share-media-label" className={styles.sectionLabel}>
            {t.SHARE_MEDIA_LABEL}
          </h3>

          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={chooseFormat}
            aria-label={t.SHARE_FORMAT_LABEL}
            className={styles.formats}
            fullWidth
          >
            <ToggleButton value="post" className={styles.format}>
              <span className={styles.formatName}>{t.SHARE_FORMAT_POST}</span>
              <span className={styles.formatHint}>{t.SHARE_FORMAT_POST_HINT}</span>
            </ToggleButton>
            <ToggleButton value="story" className={styles.format}>
              <span className={styles.formatName}>{t.SHARE_FORMAT_STORY}</span>
              <span className={styles.formatHint}>{t.SHARE_FORMAT_STORY_HINT}</span>
            </ToggleButton>
          </ToggleButtonGroup>

          <div className={styles.body}>
            <div className={styles.preview} style={{ aspectRatio: assets.aspect }} data-format={format}>
              {renderPreview()}
            </div>

            <div className={styles.captionBox}>
              <label className={styles.captionLabel} htmlFor="share-caption">
                {t.SHARE_CAPTION_LABEL}
              </label>
              {/* A read-only textarea rather than a <p>: it can be selected and
                  copied by hand when the clipboard is refused. */}
              <textarea id="share-caption" className={styles.caption} value={caption} readOnly />
            </div>

            <div className={styles.actions}>
              {format === 'story' && <p className={styles.tip}>{t.SHARE_STORY_TIP}</p>}
              {media.status === 'ready' && media.fellBack && (
                <p className={styles.notice} role="status">
                  {t.SHARE_FALLBACK_NOTICE}
                </p>
              )}
              {canNativeShare && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<IosShareIcon />}
                  onClick={handleShare}
                  disabled={media.status === 'loading'}
                  className={styles.primary}
                >
                  {shareLabel}
                </Button>
              )}
              {/* Secondary where the sheet can attach the file; the way to get
                  the video at all where it cannot (most desktops). */}
              <div className={styles.downloads}>
                <Button
                  variant={canNativeShare ? 'text' : 'outlined'}
                  size={canNativeShare ? 'small' : 'medium'}
                  startIcon={<DownloadIcon />}
                  component="a"
                  href={assets.video}
                  download={assets.videoName}
                  onClick={() => trackEvent(`share_download_${format}_video`)}
                >
                  {t.SHARE_DOWNLOAD_VIDEO}
                </Button>
                <Button
                  variant={canNativeShare ? 'text' : 'outlined'}
                  size={canNativeShare ? 'small' : 'medium'}
                  startIcon={<DownloadIcon />}
                  component="a"
                  href={assets.image}
                  download={assets.imageName}
                  onClick={() => trackEvent(`share_download_${format}_image`)}
                >
                  {t.SHARE_DOWNLOAD_IMAGE}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </DialogContent>

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Dialog>
  );
}
