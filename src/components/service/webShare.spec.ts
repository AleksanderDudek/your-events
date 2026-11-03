import { describe, it, expect, vi, afterEach } from 'vitest';
import { canShareFiles, copyText, hasNativeShare, mayShareFiles, nativeShare, prefersReducedData } from './webShare';

type Nav = Record<string, unknown>;
const nav = navigator as unknown as Nav;

function stub(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

afterEach(() => {
  for (const key of ['share', 'canShare', 'clipboard', 'connection']) delete nav[key];
  vi.restoreAllMocks();
});

describe('nativeShare', () => {
  it('is unsupported without navigator.share', async () => {
    expect(hasNativeShare()).toBe(false);
    expect(await nativeShare({ text: 'x' })).toBe('unsupported');
  });

  it('reports a completed share', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);
    expect(await nativeShare({ text: 'x' })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'x' });
  });

  it('treats closing the sheet as cancelled, anything else as failed', async () => {
    stub('share', vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')));
    expect(await nativeShare({ text: 'x' })).toBe('cancelled');
    stub('share', vi.fn().mockRejectedValue(new DOMException('no gesture', 'NotAllowedError')));
    expect(await nativeShare({ text: 'x' })).toBe('failed');
  });
});

describe('canShareFiles', () => {
  const file = new File(['x'], 'a.mp4', { type: 'video/mp4' });

  it('is false without canShare', () => {
    stub('share', vi.fn());
    expect(mayShareFiles()).toBe(false);
    expect(canShareFiles([file])).toBe(false);
  });

  it('asks canShare, and survives it throwing', () => {
    stub('share', vi.fn());
    stub('canShare', vi.fn().mockReturnValue(true));
    expect(canShareFiles([file])).toBe(true);
    stub('canShare', vi.fn(() => {
      throw new TypeError('bad');
    }));
    expect(canShareFiles([file])).toBe(false);
  });
});

describe('copyText', () => {
  it('uses the Clipboard API when it is there', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('falls back to execCommand when the Clipboard API refuses', async () => {
    stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyText('abc')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('prefersReducedData', () => {
  it('reads Data Saver where the browser reports it', () => {
    expect(prefersReducedData()).toBe(false);
    stub('connection', { saveData: true });
    expect(prefersReducedData()).toBe(true);
  });
});
