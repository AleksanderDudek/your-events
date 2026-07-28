'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { CONSENT_STORAGE_KEY, ConsentChoice, parseConsent } from '@/lib/consent';

// localStorage is an external store, so it is read through useSyncExternalStore
// rather than copied into state inside an effect: the server snapshot is
// explicit (no hydration mismatch on the static export), and the `storage`
// event keeps a second tab in step.

type Listener = () => void;
const listeners = new Set<Listener>();

// Whether the visitor asked to see the banner again via the footer link. Kept
// in memory on purpose — persisting it would reopen the banner on every reload.
let reopened = false;

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

// The snapshot is the raw string plus the reopen flag, joined into one scalar:
// useSyncExternalStore compares snapshots by identity, so returning a fresh
// object each read would loop forever. The flag is a fixed-width prefix
// ("open:" / "closed:") so the split below only ever consumes the FIRST
// colon — a hand-edited localStorage value containing its own colon still
// round-trips intact into `raw` instead of being truncated at it.
function getSnapshot(): string {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    // localStorage throws in private mode / sandboxed iframes — treat as unset.
  }
  return `${reopened ? 'open' : 'closed'}:${raw ?? ''}`;
}

// Nothing is known during the prerender, so the server snapshot is a constant.
// The banner therefore renders only after mount and never ships in the static
// HTML of all 1000+ prerendered pages.
function getServerSnapshot(): string {
  return 'closed:';
}

function write(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore: a visitor who cannot persist the choice simply sees the banner
    // again next time, which is the safe direction to fail in.
  }
  reopened = false;
  emit();
}

export interface UseConsentResult {
  choice: ConsentChoice | null;
  isOpen: boolean;
  accept: () => void;
  reject: () => void;
  reopen: () => void;
}

export function useConsent(): UseConsentResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Split at the FIRST colon only (not String#split, which would cut a raw
  // value that itself contains a colon into pieces and silently drop the
  // rest — see the getSnapshot comment above).
  const separatorIndex = snapshot.indexOf(':');
  const openFlag = snapshot.slice(0, separatorIndex);
  const raw = snapshot.slice(separatorIndex + 1);
  const choice = parseConsent(raw === '' ? null : raw);

  const accept = useCallback(() => write('accepted'), []);
  const reject = useCallback(() => write('rejected'), []);
  const reopen = useCallback(() => {
    reopened = true;
    emit();
  }, []);

  return {
    choice,
    isOpen: choice === null || openFlag === 'open',
    accept,
    reject,
    reopen,
  };
}

// Test seam: module state outlives a single test file otherwise.
export function resetConsentStoreForTests(): void {
  reopened = false;
}
