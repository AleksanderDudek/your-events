'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import SmsIcon from '@mui/icons-material/Sms';
import ChatIcon from '@mui/icons-material/Chat';
import EmailIcon from '@mui/icons-material/Email';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useCategories } from '@/components/service/useCategories';
import {
  canShareFiles,
  copyText,
  hasNativeShare,
  mayShareFiles,
  nativeShare,
} from '@/components/service/webShare';
import { trackEvent } from '@/lib/analytics';
import { withBasePath } from '@/lib/constants';
import { eventPath } from '@/lib/slug';
import { PHONE_ONLY_TARGETS, shareTargetUrl, type ShareTarget } from '@/lib/share';
import { planPdfContent, planPdfFileName, planShareText, planShareUrl, sortPlanEvents } from '@/lib/planShare';
import { Event } from '@/types/event.types';
import styles from './PlanShareDialog.module.scss';

// Chats first: a plan goes to the people you are going with.
const PLAN_TARGETS: readonly { target: ShareTarget; icon: React.ReactNode }[] = [
  { target: 'whatsapp', icon: <WhatsAppIcon fontSize="small" /> },
  { target: 'messenger', icon: <ChatIcon fontSize="small" /> },
  { target: 'telegram', icon: <TelegramIcon fontSize="small" /> },
  { target: 'sms', icon: <SmsIcon fontSize="small" /> },
  { target: 'email', icon: <EmailIcon fontSize="small" /> },
];

type PdfState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; file: File; objectUrl: string };

/** What the visitor asked for: the file saved, or made ready to send. */
type PdfIntent = 'download' | 'prepare';

/**
 * The PDF, made when asked for — never just because the dialog opened.
 * pdf-lib with fontkit is ~500 KB gzipped (fontkit's Unicode tables), too much
 * to charge everyone who only wants to send a link.
 */
function usePlanPdf(events: readonly Event[], planUrl: string, open: boolean) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const { byDisplayName, displayNameToSlug } = useCategories();
  // What a PDF would be of right now.
  const subject =
    open && events.length > 0
      ? [events.map((e) => e.id).join('.'), planUrl, locale, city.id, byDisplayName.size].join('|')
      : null;
  const [order, setOrder] = useState<{ subject: string; intent: PdfIntent; attempt: number } | null>(null);
  // An order for another plan (or language) is stale: nothing is made for it.
  const request = subject !== null && order?.subject === subject ? `${subject}|${order.attempt}` : null;
  const [result, setResult] = useState<{ request: string; pdf: PdfState } | null>(null);

  useEffect(() => {
    if (request === null || order === null) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const { buildPlanPdf, fetchPlanPdfFonts } = await import('@/lib/planPdf');
        const origin = window.location.origin;
        const content = planPdfContent(events, {
          t,
          locale,
          cityLocative: city.locativeForm[locale],
          planUrl,
          eventUrl: (e) => `${origin}${withBasePath(eventPath(city.id, e, displayNameToSlug))}/`,
          colorOf: (e) => byDisplayName.get(e.categoryMain)?.color,
          today: new Date(),
        });
        const bytes = await buildPlanPdf({ ...content, fonts: await fetchPlanPdfFonts() });
        if (cancelled) return;
        const file = new File([bytes as BlobPart], planPdfFileName(city.id, events), {
          type: 'application/pdf',
        });
        objectUrl = URL.createObjectURL(file);
        setResult({ request, pdf: { status: 'ready', file, objectUrl } });
        if (order.intent === 'download') {
          // Saving a file needs no fresh tap, unlike sharing one.
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = file.name;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }
      } catch {
        if (!cancelled) setResult({ request, pdf: { status: 'error' } });
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `request` stands for everything the PDF is made of, and the order behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const pdf: PdfState =
    request === null ? { status: 'idle' } : result?.request === request ? result.pdf : { status: 'loading' };
  const make = (intent: PdfIntent) => {
    if (subject === null) return;
    setOrder((previous) => ({ subject, intent, attempt: (previous?.attempt ?? 0) + 1 }));
  };
  const reset = () => {
    setOrder(null);
    setResult(null);
  };
  return { pdf, make, reset, intent: order?.intent ?? null };
}

interface PlanShareDialogProps {
  open: boolean;
  onClose: () => void;
  events: readonly Event[];
  /** Analytics prefix: whose plan this is ("plan" — mine, "shared_plan" — passed on). */
  source: 'plan' | 'shared_plan';
}

/**
 * "Udostępnij plan": the link (with the plan written out, for chats), the
 * apps people actually send plans through, and the plan as a PDF.
 */
export default function PlanShareDialog({ open, onClose, events, source }: PlanShareDialogProps) {
  const { t, locale } = useTranslation();
  const { city } = useCity();
  const pathname = usePathname();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isPhone = useMediaQuery('(pointer: coarse)');
  const [toast, setToast] = useState<string | null>(null);
  // Read only while open — the dialog never opens before hydration.
  const canNativeShare = open && hasNativeShare();

  const sorted = useMemo(() => sortPlanEvents(events), [events]);
  // Built in the browser only — the dialog never opens on the server.
  // usePathname() is without the base path (/your-events on GitHub Pages).
  const url = open ? planShareUrl(`${window.location.origin}${withBasePath(pathname)}`, sorted) : '';
  const text = open
    ? planShareText(sorted, { t, locale, cityLocative: city.locativeForm[locale], url })
    : '';
  const { pdf, make: makePdf, reset: resetPdf, intent: pdfIntent } = usePlanPdf(sorted, url, open);

  // A toast cut short by closing must not greet the next open.
  const close = () => {
    setToast(null);
    resetPdf();
    onClose();
  };

  const targetLabel: Record<ShareTarget, string> = {
    whatsapp: t.SHARE_TARGET_WHATSAPP,
    facebook: t.SHARE_TARGET_FACEBOOK,
    x: t.SHARE_TARGET_X,
    linkedin: t.SHARE_TARGET_LINKEDIN,
    email: t.SHARE_TARGET_EMAIL,
    messenger: t.SHARE_TARGET_MESSENGER,
    telegram: t.SHARE_TARGET_TELEGRAM,
    sms: t.SHARE_TARGET_SMS,
  };
  const targets = PLAN_TARGETS.filter(({ target }) => isPhone || !PHONE_ONLY_TARGETS.has(target));

  const copyLink = async () => {
    const ok = await copyText(url);
    setToast(ok ? t.WEEK_LINK_COPIED : t.WEEK_SHARE_COPY_FAILED);
    if (ok) trackEvent(`${source}_share_copy`);
  };

  // The system sheet: Messenger, Signal, Instagram and whatever else is installed.
  const shareNative = async () => {
    const outcome = await nativeShare({ title: t.WEEK_TITLE, text });
    if (outcome === 'shared') trackEvent(`${source}_share_native`);
    else if (outcome === 'failed') setToast(t.WEEK_SHARE_FAILED);
  };

  // Where a file can go to the share sheet (phones), the PDF is made first and
  // sent with a second tap: iOS attaches a file only inside the tap itself.
  const filesLikely = canNativeShare && mayShareFiles();
  const pdfShareable = pdf.status === 'ready' && canNativeShare && canShareFiles([pdf.file]);

  const sharePdf = async () => {
    if (pdf.status !== 'ready') return;
    const outcome = await nativeShare({ files: [pdf.file], title: t.WEEK_TITLE, text: url });
    if (outcome === 'shared') trackEvent(`${source}_pdf_share`);
    else if (outcome === 'failed') setToast(t.WEEK_SHARE_FAILED);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="plan-share-title"
      aria-describedby="plan-share-lead"
      slotProps={{ paper: { className: styles.paper } }}
    >
      <DialogContent className={styles.content}>
        <div className={styles.head}>
          <div>
            <h2 id="plan-share-title" className={styles.title}>
              {t.WEEK_SHARE}
            </h2>
            <p id="plan-share-lead" className={styles.lead}>
              {t.WEEK_SHARE_LEAD}
            </p>
          </div>
          <IconButton onClick={close} aria-label={t.WEEK_CLOSE} className={styles.close}>
            <CloseIcon />
          </IconButton>
        </div>

        <section className={styles.section} aria-labelledby="plan-share-send">
          <h3 id="plan-share-send" className={styles.sectionLabel}>
            {t.WEEK_SHARE_SEND_LABEL}
          </h3>
          <ul className={styles.targets}>
            {canNativeShare && (
              <li>
                <button type="button" className={styles.target} onClick={shareNative}>
                  <span className={styles.targetIcon}>
                    <IosShareIcon fontSize="small" />
                  </span>
                  <span className={styles.targetName}>{t.SHARE_MORE_APPS}</span>
                </button>
              </li>
            )}
            {targets.map(({ target, icon }) => (
              <li key={target}>
                <a
                  className={styles.target}
                  href={
                    open
                      ? shareTargetUrl(target, { text, url, subject: t.WEEK_SHARE_EMAIL_SUBJECT, utm: false })
                      : undefined
                  }
                  target={target === 'whatsapp' || target === 'telegram' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={() => trackEvent(`${source}_share_${target}`)}
                >
                  <span className={`${styles.targetIcon} ${styles[`target-${target}`] ?? ''}`}>{icon}</span>
                  <span className={styles.targetName}>{targetLabel[target]}</span>
                </a>
              </li>
            ))}
          </ul>

          <label className={styles.linkLabel} htmlFor="plan-share-url">
            {t.WEEK_SHARE_LINK_LABEL}
          </label>
          <div className={styles.linkRow}>
            {/* Read-only, so it can still be selected and copied by hand. */}
            <input
              id="plan-share-url"
              className={styles.linkInput}
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="contained" disableElevation startIcon={<ContentCopyIcon />} onClick={copyLink}>
              {t.WEEK_SHARE_COPY}
            </Button>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="plan-share-pdf">
          <h3 id="plan-share-pdf" className={styles.sectionLabel}>
            {t.WEEK_PDF_LABEL}
          </h3>
          <p className={styles.hint}>{t.WEEK_PDF_HINT}</p>
          {pdf.status === 'error' ? (
            <div className={styles.pdfRow} role="alert">
              <span className={styles.pdfError}>{t.WEEK_PDF_FAILED}</span>
              <Button variant="outlined" onClick={() => makePdf(pdfIntent ?? 'prepare')}>
                {t.WEEK_RETRY}
              </Button>
            </div>
          ) : pdf.status === 'ready' ? (
            <div className={styles.pdfRow}>
              {pdfShareable && (
                <Button variant="contained" disableElevation startIcon={<PictureAsPdfIcon />} onClick={sharePdf}>
                  {t.WEEK_PDF_SEND}
                </Button>
              )}
              <Button
                variant={pdfShareable ? 'outlined' : 'contained'}
                disableElevation
                startIcon={<DownloadIcon />}
                href={pdf.objectUrl}
                download={pdf.file.name}
                onClick={() => trackEvent(`${source}_pdf_download`)}
              >
                {t.WEEK_PDF_DOWNLOAD}
              </Button>
            </div>
          ) : (
            <div className={styles.pdfRow}>
              <Button
                variant="contained"
                disableElevation
                startIcon={filesLikely ? <PictureAsPdfIcon /> : <DownloadIcon />}
                disabled={pdf.status === 'loading'}
                onClick={() => {
                  makePdf(filesLikely ? 'prepare' : 'download');
                  if (!filesLikely) trackEvent(`${source}_pdf_download`);
                }}
              >
                {pdf.status === 'loading'
                  ? t.WEEK_PDF_PREPARING
                  : filesLikely
                    ? t.WEEK_PDF_PREPARE
                    : t.WEEK_PDF_DOWNLOAD}
              </Button>
            </div>
          )}
        </section>
      </DialogContent>

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </Dialog>
  );
}
