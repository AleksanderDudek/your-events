import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePromoMedia, resetPromoMediaForTests } from './usePromoMedia';

type Nav = Record<string, unknown>;

function stub(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

// A string body, not a Blob: jsdom's Blob has no .stream(), which Node's
// Response needs on some versions (CI fails with "object.stream is not a
// function"). The hook sets the File's type itself, so the type is cosmetic.
function okResponse(type: string) {
  return new Response('bytes', { status: 200, headers: { 'content-type': type } });
}

// canShare that accepts only the listed MIME types.
function canShareTypes(...types: string[]) {
  return vi.fn((data: { files?: File[] }) => (data.files ?? []).every((f) => types.includes(f.type)));
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetPromoMediaForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:promo');
  stub('share', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['share', 'canShare', 'connection']) delete (navigator as unknown as Nav)[key];
});

describe('usePromoMedia', () => {
  it('stays idle while the dialog is closed', () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    const { result } = renderHook(() => usePromoMedia('post', false));
    expect(result.current).toEqual({ status: 'idle' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads nothing where files cannot be shared', async () => {
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gets the video ready to share', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    fetchMock.mockResolvedValue(okResponse('video/mp4'));
    const { result } = renderHook(() => usePromoMedia('story', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = result.current;
    if (state.status !== 'ready') throw new Error('not ready');
    expect(state.kind).toBe('video');
    expect(state.fellBack).toBe(false);
    expect(state.file.name).toBe('idznamiasto-story.mp4');
    expect(fetchMock.mock.calls[0][0]).toMatch(/idznamiasto-story\.mp4$/);
  });

  it('falls back to the image when the video fails to download', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('.mp4') ? Promise.reject(new TypeError('offline')) : Promise.resolve(okResponse('image/jpeg'))
    );
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ kind: 'image', fellBack: true });
  });

  it('falls back to the image when the browser will not share the video', async () => {
    stub('canShare', canShareTypes('image/jpeg'));
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(okResponse(url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'))
    );
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ kind: 'image', fellBack: true });
  });

  it('skips the video with Data Saver on, without calling it a failure', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    stub('connection', { saveData: true });
    fetchMock.mockResolvedValue(okResponse('image/jpeg'));
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ kind: 'image', fellBack: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\.jpg$/);
  });

  it('shares text only when neither file can be had', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });

  it('reads a response without a length chunk by chunk', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2]));
        c.enqueue(new Uint8Array([3]));
        c.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }));
    const { result } = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ kind: 'video' });
    if (result.current.status === 'ready') expect(result.current.file.size).toBe(3);
  });

  it('keeps nothing, and makes no object URL, when closed mid-download', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { unmount } = renderHook(() => usePromoMedia('post', true));
    unmount();
    resolve(okResponse('video/mp4'));
    await new Promise((r) => setTimeout(r, 0));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('does not download the same format twice', async () => {
    stub('canShare', canShareTypes('video/mp4', 'image/jpeg'));
    fetchMock.mockResolvedValue(okResponse('video/mp4'));
    const first = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    const second = renderHook(() => usePromoMedia('post', true));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
