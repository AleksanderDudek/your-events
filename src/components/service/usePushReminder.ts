'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { IS_PUSH_ENABLED } from '@/config/site';
import { trackEvent } from '@/lib/analytics';
import { pushSupport, type PushSupport } from '@/lib/pushSupport';
import {
  currentSubscription,
  refreshSubscription,
  subscribeDevice,
  unsubscribeDevice,
  type EnableResult,
} from '@/lib/pushClient';
import {
  clearPushSettings,
  readPushSettings,
  writePushSettings,
  type PushSettings,
} from '@/lib/pushSettingsStore';
import { markPreset, reconcileMark } from '@/lib/pushMark';
import { readStoredPresets } from '@/components/service/usePresets';
import type { FilterPreset } from '@/types/preset.types';

const REFRESHED_KEY = 'idznamiasto.push.refreshed';

export interface PushReminder {
  /** The feature flag. False = render nothing. */
  available: boolean;
  support: PushSupport | 'checking';
  enabled: boolean;
  markedId: string | null;
  busy: boolean;
  enable(): Promise<EnableResult>;
  disable(): Promise<void>;
  /** Marks this filter (turning reminders on first if needed), or unmarks it if it is the marked one. */
  toggleMark(preset: FilterPreset): Promise<EnableResult | 'marked' | 'unmarked'>;
}

function refreshedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(REFRESHED_KEY)) return true;
    window.sessionStorage.setItem(REFRESHED_KEY, '1');
  } catch {
    // Storage blocked: refresh every visit, which is harmless.
  }
  return false;
}

/**
 * Push reminders for one component tree. `presets` is only a trigger: when
 * it changes, the stored mark is reconciled against storage as it is NOW
 * (readStoredPresets), never against a hydration-time empty list.
 */
export function usePushReminder(presets: readonly FilterPreset[]): PushReminder {
  const { locale } = useTranslation();
  const [support, setSupport] = useState<PushSupport | 'checking'>('checking');
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  // Bumped by every user action: an older async write must not land after it.
  const generation = useRef(0);

  useEffect(() => {
    if (!IS_PUSH_ENABLED) return;
    let cancelled = false;
    const load = async () => {
      const found = pushSupport(navigator, window);
      if (found !== 'ready') {
        setSupport(found);
        return;
      }
      const [sub, stored] = await Promise.all([
        currentSubscription().catch(() => null),
        readPushSettings().catch(() => null),
      ]);
      if (cancelled) return;
      const on = Boolean(sub && stored);
      // Together, so the switch never shows off and then flips on.
      setSupport(found);
      setEnabled(on);
      setSettings(on ? stored : null);
      // Keeps tz current and replaces a subscription the browser rotated.
      if (on && sub && !refreshedThisSession()) refreshSubscription().catch(() => undefined);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rename / delete of the marked filter, and a language switch.
  useEffect(() => {
    if (!settings) return;
    let next = reconcileMark(settings, readStoredPresets());
    if (next.locale !== locale) next = { ...next, locale };
    if (next === settings) return;
    const mine = generation.current;
    void writePushSettings(next)
      .then(() => {
        if (generation.current === mine) setSettings(next);
      })
      .catch(() => undefined);
    return () => {
      generation.current += 1;
    };
  }, [settings, presets, locale]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    setBusy(true);
    generation.current += 1;
    try {
      const result = await subscribeDevice();
      if (result === 'denied') {
        trackEvent('push_denied');
        setSupport(pushSupport(navigator, window));
        return result;
      }
      if (result === 'failed') return result;
      const next: PushSettings = { locale, preset: settings?.preset ?? null };
      try {
        await writePushSettings(next);
      } catch {
        // No record means the worker could not name the filter: do not stay subscribed.
        await unsubscribeDevice().catch(() => undefined);
        return 'failed';
      }
      setSettings(next);
      setEnabled(true);
      trackEvent('push_enable');
      return result;
    } finally {
      setBusy(false);
    }
  }, [locale, settings]);

  const disable = useCallback(async () => {
    setBusy(true);
    generation.current += 1;
    try {
      await unsubscribeDevice().catch(() => undefined);
      await clearPushSettings().catch(() => undefined);
      setSettings(null);
      setEnabled(false);
      trackEvent('push_disable');
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleMark = useCallback(
    async (preset: FilterPreset) => {
      const unmarking = settings?.preset?.id === preset.id;
      if (!enabled) {
        const result = await enable();
        if (result !== 'enabled') return result;
      }
      generation.current += 1;
      const next = markPreset({ locale, preset: settings?.preset ?? null }, unmarking ? null : preset);
      try {
        await writePushSettings(next);
      } catch {
        return 'failed' as const;
      }
      setSettings(next);
      trackEvent(unmarking ? 'push_filter_off' : 'push_filter_on');
      return unmarking ? ('unmarked' as const) : ('marked' as const);
    },
    [enabled, enable, locale, settings]
  );

  return {
    available: IS_PUSH_ENABLED,
    support,
    enabled,
    markedId: settings?.preset?.id ?? null,
    busy,
    enable,
    disable,
    toggleMark,
  };
}
