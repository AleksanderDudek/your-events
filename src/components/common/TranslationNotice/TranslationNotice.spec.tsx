import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { LocaleProvider } from '@/i18n';
import { primeTranslator } from '@/i18n/translation';
// Test-only bypass: `resetTranslationEngine` is a seam for isolating tests,
// not part of the public contract in `@/i18n/translation`'s index — every
// other translation test reaches for it the same way.
import { resetTranslationEngine } from '@/i18n/translation/engine';
import TranslationNotice from './TranslationNotice';

interface FakeMonitor {
  addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
}

function installStalledDownload() {
  // `create` never resolves, so the engine's status stays `downloading` for
  // as long as the test needs it to.
  Object.defineProperty(globalThis, 'Translator', {
    value: {
      create: vi.fn(
        (options: { monitor?: (monitor: FakeMonitor) => void }) =>
          new Promise(() => {
            options.monitor?.({
              addEventListener: (_type, listener) => listener({ loaded: 0.4 }),
            });
          })
      ),
      availability: vi.fn(async () => 'available'),
    },
    configurable: true,
    writable: true,
  });
}

function setLocale(locale: 'pl' | 'en') {
  window.localStorage.setItem('go-to-city.locale', locale);
}

function removeInjectedGoogleScripts() {
  document.querySelectorAll('script[src*="translate.google"]').forEach((node) => node.remove());
}

function renderNotice() {
  return render(
    <LocaleProvider>
      <TranslationNotice />
    </LocaleProvider>
  );
}

beforeEach(() => {
  resetTranslationEngine();
  Reflect.deleteProperty(globalThis as object, 'Translator');
});

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'Translator');
  Reflect.deleteProperty(window as object, 'goToCityGoogleTranslateInit');
  Reflect.deleteProperty(window as object, 'google');
  removeInjectedGoogleScripts();
  resetTranslationEngine();
  window.localStorage.clear();
});

describe('TranslationNotice', () => {
  it('renders nothing for the pl locale', async () => {
    setLocale('pl');
    const { container } = renderNotice();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the Google offer after mount when there is no Translator', async () => {
    setLocale('en');
    renderNotice();
    expect(await screen.findByRole('button', { name: 'Translate page' })).toBeInTheDocument();
  });

  it('injects no script before the offer is clicked, and one after', async () => {
    setLocale('en');
    renderNotice();
    const button = await screen.findByRole('button', { name: 'Translate page' });

    expect(document.querySelector('script[src*="translate.google"]')).toBeNull();

    fireEvent.click(button);

    await waitFor(() =>
      expect(document.querySelector('script[src*="translate.google"]')).not.toBeNull()
    );
  });

  it('shows the downloading state', async () => {
    setLocale('en');
    installStalledDownload();
    renderNotice();

    void primeTranslator('en');

    expect(await screen.findByRole('status')).toHaveTextContent('Translating content');
  });

  it('has no accessibility violations', async () => {
    setLocale('en');
    const { container } = renderNotice();
    await screen.findByRole('button', { name: 'Translate page' });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
