import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/i18n';
import { resetTranslationEngine } from './engine';
import { Translated, useTranslated } from './useTranslated';

function installTranslator() {
  Object.defineProperty(globalThis, 'Translator', {
    value: {
      create: vi.fn(async () => ({
        translate: vi.fn(async (text: string) => `EN(${text})`),
        destroy: vi.fn(),
      })),
      availability: vi.fn(async () => 'available'),
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  resetTranslationEngine();
  Reflect.deleteProperty(globalThis as object, 'Translator');
  window.localStorage.setItem('go-to-city.locale', 'en');
});

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'Translator');
  resetTranslationEngine();
  window.localStorage.clear();
});

function Subject({ text }: { text: string }) {
  return <p data-testid="out"><Translated text={text} /></p>;
}

describe('Translated', () => {
  it('renders the original text first, then the translation', async () => {
    installTranslator();
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );

    // The first paint is always the source text — that is what keeps the static
    // HTML and hydration in agreement.
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('EN(Koncert)'));
  });

  it('leaves the text alone when the browser cannot translate', async () => {
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
  });

  it('leaves the text alone in the source locale', async () => {
    installTranslator();
    window.localStorage.setItem('go-to-city.locale', 'pl');
    render(
      <LocaleProvider>
        <Subject text="Koncert" />
      </LocaleProvider>
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('out')).toHaveTextContent('Koncert');
  });

  it('handles null and undefined without rendering "null"', () => {
    function Empty() {
      const value = useTranslated(null);
      return <span data-testid="empty">[{value}]</span>;
    }
    render(
      <LocaleProvider>
        <Empty />
      </LocaleProvider>
    );
    expect(screen.getByTestId('empty')).toHaveTextContent('[]');
  });
});
