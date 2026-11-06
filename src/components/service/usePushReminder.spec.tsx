import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterPreset } from '@/types/preset.types';

vi.mock('@/config/site', () => ({ IS_PUSH_ENABLED: true }));
vi.mock('@/lib/pushSupport', () => ({ pushSupport: vi.fn(() => 'ready') }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/pushClient', () => ({
  currentSubscription: vi.fn(),
  sendSubscription: vi.fn(async () => undefined),
  refreshSubscription: vi.fn(async () => undefined),
  subscribeDevice: vi.fn(),
  unsubscribeDevice: vi.fn(async () => undefined),
}));
vi.mock('@/lib/pushSettingsStore', () => ({
  readPushSettings: vi.fn(),
  writePushSettings: vi.fn(async () => undefined),
  clearPushSettings: vi.fn(async () => undefined),
}));
vi.mock('@/components/service/usePresets', () => ({ readStoredPresets: vi.fn(() => []) }));

import { usePushReminder } from './usePushReminder';
import * as client from '@/lib/pushClient';
import * as store from '@/lib/pushSettingsStore';
import { pushSupport } from '@/lib/pushSupport';
import { trackEvent } from '@/lib/analytics';
import { readStoredPresets } from '@/components/service/usePresets';

const preset = (id: string, name = id) => ({ id, name }) as FilterPreset;
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/x' } as PushSubscription;

describe('usePushReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(pushSupport).mockReturnValue('ready');
    vi.mocked(client.currentSubscription).mockResolvedValue(null);
    vi.mocked(store.readPushSettings).mockResolvedValue(null);
    vi.mocked(readStoredPresets).mockReturnValue([]);
  });

  it('starts off and reports support', async () => {
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    expect(result.current.available).toBe(true);
    expect(result.current.enabled).toBe(false);
  });

  it('stays "checking" until the subscription read settles, so the switch never flips', async () => {
    let release!: (v: PushSubscription) => void;
    vi.mocked(client.currentSubscription).mockReturnValue(new Promise((r) => (release = r)));
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: null });
    const { result } = renderHook(() => usePushReminder([]));
    await act(async () => undefined);
    expect(result.current.support).toBe('checking');
    await act(async () => release(SUB));
    expect(result.current.support).toBe('ready');
    expect(result.current.enabled).toBe(true);
  });

  it('is on when the browser has a subscription AND the record exists, and refreshes once per session', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'a', name: 'A' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('a', 'A')]);
    const { result, unmount } = renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.markedId).toBe('a');
    expect(client.refreshSubscription).toHaveBeenCalledTimes(1);
    unmount();

    renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(client.currentSubscription).toHaveBeenCalledTimes(2));
    expect(client.refreshSubscription).toHaveBeenCalledTimes(1);
  });

  it('enable writes the record and counts the event', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('enabled');
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    await act(async () => {
      expect(await result.current.enable()).toBe('enabled');
    });
    expect(store.writePushSettings).toHaveBeenCalledWith({ locale: 'pl', preset: null });
    expect(result.current.enabled).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('push_enable');
  });

  it('a refused permission is counted and re-checks support', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('denied');
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    vi.mocked(pushSupport).mockReturnValue('blocked');
    await act(async () => {
      await result.current.enable();
    });
    expect(trackEvent).toHaveBeenCalledWith('push_denied');
    expect(result.current.support).toBe('blocked');
    expect(result.current.enabled).toBe(false);
  });

  it('marking while off turns reminders on first, then marks', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('enabled');
    // The filter exists in storage, or the reconcile effect would drop the mark.
    vi.mocked(readStoredPresets).mockReturnValue([preset('b', 'B')]);
    const { result } = renderHook(() => usePushReminder([preset('b', 'B')]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    await act(async () => {
      expect(await result.current.toggleMark(preset('b', 'B'))).toBe('marked');
    });
    expect(client.subscribeDevice).toHaveBeenCalled();
    expect(store.writePushSettings).toHaveBeenLastCalledWith({ locale: 'pl', preset: { id: 'b', name: 'B' } });
    expect(result.current.markedId).toBe('b');
    expect(trackEvent).toHaveBeenCalledWith('push_filter_on');
  });

  it('toggling the marked filter unmarks it', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'a', name: 'A' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('a', 'A')]);
    const { result } = renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(result.current.markedId).toBe('a'));
    await act(async () => {
      expect(await result.current.toggleMark(preset('a', 'A'))).toBe('unmarked');
    });
    expect(result.current.markedId).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('push_filter_off');
  });

  it('drops the mark when the marked filter no longer exists in storage', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'gone', name: 'G' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('other')]);
    const { result } = renderHook(() => usePushReminder([preset('other')]));
    await waitFor(() => expect(store.writePushSettings).toHaveBeenCalledWith({ locale: 'pl', preset: null }));
    await waitFor(() => expect(result.current.markedId).toBeNull());
  });

  it('disable unsubscribes, deletes the record and counts the event', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: null });
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.disable();
    });
    expect(client.unsubscribeDevice).toHaveBeenCalled();
    expect(store.clearPushSettings).toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('push_disable');
  });

  it('enable returns failed and undoes the subscription when the record cannot be written', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('enabled');
    vi.mocked(store.writePushSettings).mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    await act(async () => {
      expect(await result.current.enable()).toBe('failed');
    });
    expect(client.unsubscribeDevice).toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
  });

  it('toggleMark returns failed when the record cannot be written', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: null });
    vi.mocked(readStoredPresets).mockReturnValue([preset('b', 'B')]);
    const { result } = renderHook(() => usePushReminder([preset('b', 'B')]));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    vi.mocked(store.writePushSettings).mockRejectedValueOnce(new Error('quota'));
    await act(async () => {
      expect(await result.current.toggleMark(preset('b', 'B'))).toBe('failed');
    });
    expect(result.current.markedId).toBeNull();
  });

  it('a reconcile write that lands after disable does not resurrect the record', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'a', name: 'Old' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('a', 'New')]);
    let release: () => void = () => undefined;
    vi.mocked(store.writePushSettings).mockImplementationOnce(
      () => new Promise<void>((r) => { release = r; })
    );
    const { result } = renderHook(() => usePushReminder([preset('a', 'New')]));
    await waitFor(() => expect(store.writePushSettings).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.disable();
    });
    await act(async () => {
      release();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.markedId).toBeNull();
    expect(store.writePushSettings).toHaveBeenCalledTimes(1);
  });
});
