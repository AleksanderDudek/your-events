'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, Locale, Messages, messages } from './messages';

const STORAGE_KEY = 'go-to-city.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Messages;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Server render + first client paint use the default locale so the static
  // HTML matches. After hydration we read the user's stored preference.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // Intentional: first render uses DEFAULT_LOCALE so SSR/static HTML
      // matches; we sync the stored preference after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isLocale(stored) && stored !== DEFAULT_LOCALE) setLocaleState(stored);
    } catch {
      // localStorage may throw in private mode / sandboxed iframes — ignore.
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: messages[locale] }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback to default locale when used outside provider (e.g. unit tests
    // that render a component in isolation). Components remain functional.
    return { locale: DEFAULT_LOCALE, setLocale: () => undefined, t: messages[DEFAULT_LOCALE] };
  }
  return ctx;
}
