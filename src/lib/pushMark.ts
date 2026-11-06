import type { FilterPreset } from '@/types/preset.types';
import type { PushSettings } from '@/lib/pushSettingsStore';

// Same cut as the worker's NAME_MAX: a lock screen shows about this much.
export const PUSH_NAME_MAX = 60;

/** Marks `preset` (replacing any other mark), or unmarks with null. */
export function markPreset(settings: PushSettings, preset: Pick<FilterPreset, 'id' | 'name'> | null): PushSettings {
  return {
    ...settings,
    preset: preset ? { id: preset.id, name: preset.name.slice(0, PUSH_NAME_MAX) } : null,
  };
}

/**
 * Keeps the stored mark in step with the saved filters: a renamed filter
 * carries its new name into the next reminder, a deleted one stops being
 * the reminder's target. Returns the SAME object when nothing changed, so a
 * caller can skip the write.
 */
export function reconcileMark(settings: PushSettings, presets: readonly FilterPreset[]): PushSettings {
  const marked = settings.preset;
  if (!marked) return settings;
  const current = presets.find((p) => p.id === marked.id);
  if (!current) return { ...settings, preset: null };
  const name = current.name.slice(0, PUSH_NAME_MAX);
  return name === marked.name ? settings : { ...settings, preset: { id: marked.id, name } };
}
