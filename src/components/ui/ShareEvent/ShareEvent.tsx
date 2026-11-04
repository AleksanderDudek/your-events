'use client';

import { useCallback, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import IosShareIcon from '@mui/icons-material/IosShare';
import LinkIcon from '@mui/icons-material/Link';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import XIcon from '@mui/icons-material/X';
import EmailIcon from '@mui/icons-material/Email';
import { Event } from '@/types/event.types';
import { useTranslation } from '@/i18n';
import { formatDate, formatEventTime } from '@/lib/utils';
import { eventShareUrl, shareTargetUrl, type ShareTarget } from '@/lib/share';
import { copyText, hasNativeShare, nativeShare } from '@/components/service/webShare';
import { trackEvent } from '@/lib/analytics';
import styles from './ShareEvent.module.scss';

interface ShareEventProps {
  event: Event;
}

const MENU_TARGETS: readonly { target: ShareTarget; icon: React.ReactNode }[] = [
  { target: 'whatsapp', icon: <WhatsAppIcon fontSize="small" /> },
  { target: 'facebook', icon: <FacebookIcon fontSize="small" /> },
  { target: 'x', icon: <XIcon fontSize="small" /> },
  { target: 'email', icon: <EmailIcon fontSize="small" /> },
];

/**
 * "Udostępnij wydarzenie" on an event page: this one event, by its permalink —
 * not the app (that is the header's "Poleć znajomym").
 *
 * With a native share sheet (phones, Safari, Chrome on Windows) one tap opens
 * it; the link carries the event's own og: card, poster included. Without one,
 * the same button opens a menu: copy the link, or a web share link. Filled with
 * the share gradient, like the header's "Poleć znajomym".
 */
export default function ShareEvent({ event }: Readonly<ShareEventProps>) {
  const { t, locale } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const close = useCallback(() => setAnchorEl(null), []);

  // Built on click, from the address bar: correct on dev, production and the
  // client-side fallback route alike, with no base-path arithmetic.
  const payload = () => {
    const url = eventShareUrl(window.location.href);
    const time = formatEventTime(event.startTime, event.endTime, event.durationMin);
    const when = [event.date ? formatDate(event.date, locale) : '', time].filter(Boolean).join(', ');
    const text = t.SHARE_EVENT_TEXT(event.name, when, event.location.name);
    return { url, text };
  };

  const handleClick = async (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const { url, text } = payload();
    if (hasNativeShare()) {
      const outcome = await nativeShare({ title: event.name, text, url });
      if (outcome === 'shared') {
        trackEvent('share_event_native');
        return;
      }
      if (outcome === 'cancelled') return;
      // 'failed' (e.g. a desktop sheet that refused): offer the menu instead.
    }
    setAnchorEl(target);
  };

  const handleCopy = async () => {
    close();
    const ok = await copyText(payload().url);
    setToast(ok ? t.SHARE_EVENT_LINK_COPIED : t.SHARE_TOAST_COPY_FAILED);
    if (ok) trackEvent('share_event_copy');
  };

  const label: Record<ShareTarget, string> = {
    whatsapp: t.SHARE_TARGET_WHATSAPP,
    facebook: t.SHARE_TARGET_FACEBOOK,
    x: t.SHARE_TARGET_X,
    linkedin: t.SHARE_TARGET_LINKEDIN,
    email: t.SHARE_TARGET_EMAIL,
  };

  const menuOpen = Boolean(anchorEl);
  // Only computed while the menu is open, i.e. in the browser.
  const links = menuOpen ? payload() : null;

  return (
    <>
      <Button
        variant="contained"
        disableElevation
        onClick={handleClick}
        startIcon={<IosShareIcon />}
        // No aria-haspopup: on most phones this opens the system share sheet,
        // not the menu. aria-expanded still reports the menu when it is shown.
        aria-expanded={menuOpen || undefined}
        className={styles.button}
      >
        {t.SHARE_EVENT}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={close}
        slotProps={{ list: { 'aria-label': t.SHARE_EVENT } }}
      >
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.SHARE_EVENT_COPY_LINK} />
        </MenuItem>
        {links &&
          MENU_TARGETS.map(({ target, icon }) => (
            <MenuItem
              key={target}
              component="a"
              href={shareTargetUrl(target, {
                // The link goes in the text for apps that take only text.
                text: `${links.text}\n${links.url}`,
                url: links.url,
                subject: event.name,
                utm: false,
              })}
              target={target === 'email' ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent(`share_event_link_${target}`);
                close();
              }}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label[target]} />
            </MenuItem>
          ))}
      </Menu>

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </>
  );
}

