'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  hasSeenCurrent,
} from '@/lib/onboarding';
import { IS_ONBOARDING_ENABLED } from '@/config/site';

// localStorage is an external store, so it is read through useSyncExternalStore
// rather than copied into state inside an effect — the same shape as
// useConsent: an explicit server snapshot (no hydration mismatch across the
// 1000+ prerendered pages) and a `storage` listener that keeps a second tab in
// step.
//
// This hook owns storage and the two transient flags only. Whether the sheet
// may open *here* (route, cookie banner) is the orchestrator's call, because
// those inputs are props of the page rather than of the store.

type Listener = () => void;
const listeners = new Set<Listener>();

// Transient on purpose, both of them — persisting either would make the sheet
// reappear on every reload.
//
// `replayRequested`: the footer's "how does this work?" link was clicked.
// `tourPending`: the visitor pressed "show me" on a page that cannot host the
// tour, so it must start after the navigation to the events list lands.
let replayRequested = false;
let tourPending = false;

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

// One scalar, because useSyncExternalStore compares snapshots by identity and a
// fresh object per read would loop forever. The two flags are single characters
// ahead of a colon, so the split below lands on the real separator even if a
// hand-edited stored value contains a colon of its own.
function getSnapshot(): string {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // localStorage throws in private mode / sandboxed iframes — treat as unset,
    // which offers the sheet again rather than hiding it forever.
  }
  return `${replayRequested ? '1' : '0'}${tourPending ? '1' : '0'}:${raw ?? ''}`;
}

// Nothing is known during the prerender. This constant's only job is to keep
// the server render and the hydration render byte-for-byte identical; the
// `isHydrated` gate below is what actually keeps the overlay out of the static
// HTML.
function getServerSnapshot(): string {
  return '00:';
}

function markSeenInStorage(): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, String(ONBOARDING_VERSION));
  } catch {
    // Ignore: a visitor who cannot persist simply sees the sheet again next
    // time, which is the safe direction to fail in.
  }
}

export interface UseOnboardingResult {
  /** Build-time feature flag — false switches the whole feature off. */
  isEnabled: boolean;
  /** Enabled AND hydrated. Nothing may render before this is true. */
  isReady: boolean;
  /** This browser has already been shown the current tour version. */
  hasSeen: boolean;
  /** The footer link asked to see it again. */
  isReplayRequested: boolean;
  /** "Show me" was pressed and the tour has not started yet. */
  isTourPending: boolean;
  /** Record the current version as seen and drop the replay flag. */
  markSeen: () => void;
  /** Ask for the tour (the orchestrator starts it once it is on the right page). */
  requestTour: () => void;
  /** The tour has started — clear the request so a later render cannot restart it. */
  clearTourRequest: () => void;
  /** Reopen the sheet without clearing the stored version. */
  replay: () => void;
}

export function useOnboarding(): UseOnboardingResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Split at the FIRST colon only — see the getSnapshot comment.
  const separatorIndex = snapshot.indexOf(':');
  const flags = snapshot.slice(0, separatorIndex);
  const raw = snapshot.slice(separatorIndex + 1);

  // React uses getServerSnapshot for the prerender AND the hydration render,
  // then switches. So this reads false until hydration finishes, which is the
  // "have we mounted yet" signal the overlay needs.
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const markSeen = useCallback(() => {
    markSeenInStorage();
    replayRequested = false;
    tourPending = false;
    emit();
  }, []);

  const requestTour = useCallback(() => {
    tourPending = true;
    emit();
  }, []);

  const clearTourRequest = useCallback(() => {
    tourPending = false;
    emit();
  }, []);

  const replay = useCallback(() => {
    replayRequested = true;
    emit();
  }, []);

  return {
    isEnabled: IS_ONBOARDING_ENABLED,
    isReady: IS_ONBOARDING_ENABLED && isHydrated,
    // A replay request has to beat the stored version, or the link would do
    // nothing for the people most likely to click it — those who have seen it.
    hasSeen: hasSeenCurrent(raw === '' ? null : raw) && flags[0] !== '1',
    isReplayRequested: flags[0] === '1',
    isTourPending: flags[1] === '1',
    markSeen,
    requestTour,
    clearTourRequest,
    replay,
  };
}

// Test seam: module state outlives a single test file otherwise.
export function resetOnboardingStoreForTests(): void {
  replayRequested = false;
  tourPending = false;
}
