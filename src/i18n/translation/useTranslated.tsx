'use client';

// The React face of the translation engine (`./engine`). The engine is
// framework-free and synchronous-read-only; this module is the only place
// that touches `useSyncExternalStore`, effects and the active locale.
//
// The load-bearing constraint: `getSnapshot` must be pure — no scheduling, no
// I/O — so a miss is requested from an effect, never from the snapshot
// itself. The server snapshot is always the original text, so static HTML
// and the first client paint agree and hydration cannot mismatch.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';
import { read, request, subscribe, getStatus, type TranslationStatus } from './engine';

/** The translation of `text` for the active locale, or `text` itself. */
export function useTranslated(text: string | null | undefined): string {
  const { locale } = useTranslation();
  const value = text ?? '';

  const getSnapshot = useCallback(() => read(value, locale), [value, locale]);
  const getServerSnapshot = useCallback(() => value, [value]);

  const translated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    request(value, locale);
  }, [value, locale]);

  return translated;
}

/** Same, rendered. Use in JSX; use the hook for aria-labels and alt text. */
export function Translated({ text }: { text: string | null | undefined }): React.ReactNode {
  return useTranslated(text);
}

export function useTranslationStatus(): TranslationStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}
