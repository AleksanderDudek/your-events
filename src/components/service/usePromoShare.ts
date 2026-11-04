'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { trackEvent } from '@/lib/analytics';
import { SHARE_STRIP_ATTRIBUTE, SHARE_STRIP_STORAGE_KEY } from '@/lib/shareStrip';

// Two small external stores behind "Poleć Idź na miasto":
//
// - whether the share dialog is open. One dialog is mounted in AppLayout and
//   opened from anywhere (header, strip, home tile, menu, footer, Rozwijaj z
//   nami), so the state lives outside any one component — the same
//   module-store pattern as useConsent's `reopened` flag.
// - whether the thin strip under the header is hidden: by its ×, or for good
//   once the visitor has shared. Persisted in localStorage and mirrored onto
//   <html data-share-strip="off"> — see @/lib/shareStrip.

export type ShareEntry = 'header' | 'strip' | 'tile' | 'menu' | 'footer' | 'grow';

type Listener = () => void;
const listeners = new Set<Listener>();
let dialogOpen = false;
// Also kept in memory, so hiding works for the visit even where localStorage
// throws (private mode, sandboxed iframes).
let stripDismissed = false;

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function openShareDialog(entry: ShareEntry): void {
  dialogOpen = true;
  trackEvent(`share_open_${entry}`);
  emit();
}

export function closeShareDialog(): void {
  dialogOpen = false;
  emit();
}

export function useShareDialog(): { isOpen: boolean; open: (entry: ShareEntry) => void; close: () => void } {
  const isOpen = useSyncExternalStore(subscribe, () => dialogOpen, () => false);
  return { isOpen, open: openShareDialog, close: closeShareDialog };
}

function readStripDismissed(): boolean {
  if (stripDismissed) return true;
  try {
    return window.localStorage.getItem(SHARE_STRIP_STORAGE_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/**
 * Hides the strip for good. `reason` only names the analytics event: the ×,
 * or a completed share (someone who has shared needs no further nudge).
 */
export function hideShareStrip(reason: 'dismiss' | 'shared'): void {
  if (readStripDismissed()) return;
  stripDismissed = true;
  try {
    window.localStorage.setItem(SHARE_STRIP_STORAGE_KEY, 'dismissed');
  } catch {
    // Unpersistable: it comes back on the next visit, which is harmless.
  }
  document.documentElement.setAttribute(SHARE_STRIP_ATTRIBUTE, 'off');
  trackEvent(`share_strip_${reason}`);
  emit();
}

/**
 * The strip's visibility. The server snapshot is "visible", matching the
 * prerendered HTML; for a visitor who hid it, the <head> script has already
 * hidden it with CSS, and this unmounts it right after hydration.
 */
export function useShareStrip(): { isVisible: boolean; dismiss: () => void } {
  const dismissed = useSyncExternalStore(subscribe, readStripDismissed, () => false);
  const dismiss = useCallback(() => hideShareStrip('dismiss'), []);
  return { isVisible: !dismissed, dismiss };
}

// Test seam: module state outlives a single test file otherwise.
export function resetShareStoreForTests(): void {
  dialogOpen = false;
  stripDismissed = false;
}
