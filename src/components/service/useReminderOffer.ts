'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { REMINDER_OFFER_STORAGE_KEY } from '@/lib/onboarding';

// Whether this browser has answered the onboarding's "turn on notifications"
// step. Same external-store shape as useOnboarding: localStorage read through
// useSyncExternalStore, an explicit server snapshot, a `storage` listener for a
// second tab.

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(REMINDER_OFFER_STORAGE_KEY) !== null;
  } catch {
    // Storage blocked: report "answered" rather than asking on every page load
    // for an answer that can never be remembered.
    return true;
  }
}

// Unknown during the prerender; reading as answered keeps the step out of the
// static HTML until hydration has read the real value.
function getServerSnapshot(): boolean {
  return true;
}

export interface ReminderOffer {
  answered: boolean;
  markAnswered: () => void;
}

export function useReminderOffer(): ReminderOffer {
  const answered = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const markAnswered = useCallback(() => {
    try {
      window.localStorage.setItem(REMINDER_OFFER_STORAGE_KEY, '1');
    } catch {
      // Nothing to persist into; getSnapshot already reads that as answered.
    }
    listeners.forEach((l) => l());
  }, []);
  return { answered, markAnswered };
}
