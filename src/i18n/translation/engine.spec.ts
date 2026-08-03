import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SOURCE_LANGUAGE,
  getStatus,
  isTranslationSupported,
  primeTranslator,
  read,
  request,
  resetTranslationEngine,
  subscribe,
} from './engine';

// A stand-in for the on-device model. Chrome exposes `Translator` on the global;
// under vitest there is none, which is also the "unsupported browser" case the
// engine has to survive.
function installTranslator(options: {
  translate?: (text: string) => Promise<string>;
  availability?: string;
  createRejects?: boolean;
} = {}) {
  const translate = options.translate ?? ((text: string) => Promise.resolve(`EN(${text})`));
  const create = vi.fn(async () => {
    if (options.createRejects) throw new Error('no model');
    return { translate: vi.fn(translate), destroy: vi.fn() };
  });
  const availability = vi.fn(async () => options.availability ?? 'available');
  Object.defineProperty(globalThis, 'Translator', {
    value: { create, availability },
    configurable: true,
    writable: true,
  });
  return { create, availability };
}

function uninstallTranslator() {
  Reflect.deleteProperty(globalThis as object, 'Translator');
}

// The queue flushes on a microtask; awaiting an already-resolved promise twice
// is enough to let it run to completion.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  resetTranslationEngine();
  uninstallTranslator();
});

afterEach(() => {
  uninstallTranslator();
  resetTranslationEngine();
});

describe('without the Translator API', () => {
  it('reports itself unsupported', () => {
    expect(isTranslationSupported()).toBe(false);
    expect(getStatus()).toBe('unsupported');
  });

  it('returns the original text and never throws', async () => {
    request('Koncert', 'en');
    await flush();
    expect(read('Koncert', 'en')).toBe('Koncert');
  });
});

describe('with the Translator API', () => {
  it('translates a requested string and notifies subscribers', async () => {
    installTranslator();
    const listener = vi.fn();
    subscribe(listener);

    expect(read('Koncert', 'en')).toBe('Koncert');
    request('Koncert', 'en');
    await flush();

    expect(read('Koncert', 'en')).toBe('EN(Koncert)');
    expect(listener).toHaveBeenCalled();
  });

  // Fifteen cards must not become fifteen round trips.
  it('flushes everything requested in one tick as a single batch', async () => {
    const { create } = installTranslator();
    request('a', 'en');
    request('b', 'en');
    request('c', 'en');
    await flush();

    expect(create).toHaveBeenCalledTimes(1);
    expect(read('a', 'en')).toBe('EN(a)');
    expect(read('b', 'en')).toBe('EN(b)');
    expect(read('c', 'en')).toBe('EN(c)');
  });

  it('does not re-translate what it already has', async () => {
    installTranslator();
    request('Koncert', 'en');
    await flush();
    const before = read('Koncert', 'en');

    request('Koncert', 'en');
    await flush();

    expect(read('Koncert', 'en')).toBe(before);
  });

  it('leaves the source language alone', async () => {
    installTranslator();
    request('Koncert', SOURCE_LANGUAGE);
    await flush();
    expect(read('Koncert', SOURCE_LANGUAGE)).toBe('Koncert');
  });

  it('keeps the original when one string fails, and the rest of the batch survives', async () => {
    installTranslator({
      translate: (text: string) =>
        text === 'bad' ? Promise.reject(new Error('nope')) : Promise.resolve(`EN(${text})`),
    });
    request('bad', 'en');
    request('good', 'en');
    await flush();

    expect(read('bad', 'en')).toBe('bad');
    expect(read('good', 'en')).toBe('EN(good)');
  });

  it('reports an error status when the model cannot be created', async () => {
    installTranslator({ createRejects: true });
    await primeTranslator('en');
    expect(getStatus()).toBe('error');
  });

  it('reaches ready once a translator exists', async () => {
    installTranslator();
    expect(getStatus()).toBe('idle');
    await primeTranslator('en');
    expect(getStatus()).toBe('ready');
  });

  it('ignores empty strings', async () => {
    const { create } = installTranslator();
    request('', 'en');
    request('   ', 'en');
    await flush();
    expect(create).not.toHaveBeenCalled();
  });
});
