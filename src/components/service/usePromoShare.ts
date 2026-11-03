'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { trackEvent } from '@/lib/analytics';

// Two small external stores behind "Poleć Idź na miasto":
//
// - whether the share dialog is open. One dialog is mounted in AppLayout and
//   opened from anywhere (header, home banner, footer, Rozwijaj z nami), so the
//   state lives outside any one component — the same module-store pattern as
//   useConsent's `reopened` flag.
// - whether the visitor hid the home banner, persisted in localStorage.

export const SHARE_BANNER_STORAGE_KEY = 'go-to-city.share-banner';

export type ShareEntry = 'header' | 'banner' | 'footer' | 'grow';

type Listener = () => void;
const listeners = new Set<Listener>();
let dialogOpen = false;
// Also kept in memory, so hiding works for the visit even where localStorage
// throws (private mode, sandboxed iframes).
let bannerDismissed = false;

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

function readBannerDismissed(): boolean {
  if (bannerDismissed) return true;
  try {
    return window.localStorage.getItem(SHARE_BANNER_STORAGE_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/**
 * The home banner's visibility. Reads false until hydration (server snapshot),
 * so the prerendered HTML never carries a banner that a returning visitor has
 * hidden — it appears, if at all, right after hydration, below the tiles.
 */
export function useShareBanner(): { isVisible: boolean; dismiss: () => void } {
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const dismissed = useSyncExternalStore(subscribe, readBannerDismissed, () => true);
  const dismiss = useCallback(() => {
    bannerDismissed = true;
    try {
      window.localStorage.setItem(SHARE_BANNER_STORAGE_KEY, 'dismissed');
    } catch {
      // Unpersistable: it comes back on the next visit, which is harmless.
    }
    trackEvent('share_banner_dismiss');
    emit();
  }, []);
  return { isVisible: isHydrated && !dismissed, dismiss };
}

// Test seam: module state outlives a single test file otherwise.
export function resetShareStoreForTests(): void {
  dialogOpen = false;
  bannerDismissed = false;
}
