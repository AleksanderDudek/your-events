'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { FilterPreset } from '@/types/preset.types';
import {
  duplicatePreset,
  parsePresets,
  removePreset,
  serializePresets,
  upsertPreset,
} from '@/lib/presets';

export const PRESETS_STORAGE_KEY = 'go-to-city.presets';

// localStorage is an external store, so it is read through useSyncExternalStore
// rather than copied into state inside an effect. That buys three things: the
// server snapshot is explicit (no hydration mismatch), a write in one component
// is seen by every other, and the `storage` event keeps a second tab in step
// instead of letting it overwrite changes it never saw.

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

// The snapshot is the RAW string, not the parsed array: useSyncExternalStore
// compares snapshots by identity, and a fresh array every read would loop.
function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(PRESETS_STORAGE_KEY);
  } catch {
    // Private mode / sandboxed iframe. Behaves as "no presets saved".
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function write(presets: FilterPreset[]): void {
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, serializePresets(presets));
  } catch {
    // Quota exceeded or storage blocked — the in-memory list still updated, so
    // the user's action is not lost for this session.
  }
  emit();
}

export interface UsePresetsResult {
  presets: FilterPreset[];
  save: (preset: FilterPreset) => void;
  remove: (id: string) => void;
  duplicate: (id: string, newId: string, name: string, createdAt: string) => void;
}

export function usePresets(): UsePresetsResult {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const presets = useMemo(() => parsePresets(raw), [raw]);

  // Each mutation re-reads storage before writing, so a change made in another
  // component (or tab) between render and click is not clobbered.
  const save = useCallback((preset: FilterPreset) => {
    write(upsertPreset(parsePresets(getSnapshot()), preset));
  }, []);

  const remove = useCallback((id: string) => {
    write(removePreset(parsePresets(getSnapshot()), id));
  }, []);

  const duplicate = useCallback(
    (id: string, newId: string, name: string, createdAt: string) => {
      write(duplicatePreset(parsePresets(getSnapshot()), id, newId, name, createdAt));
    },
    []
  );

  return { presets, save, remove, duplicate };
}
