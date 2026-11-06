import type { FilterPreset } from '@/types/preset.types';

/**
 * The URL without `src=push`, or null when the visit did not come from a
 * reminder. Stripped after counting so a shared link does not count again.
 */
export function stripPushSource(href: string): string | null {
  const url = new URL(href);
  if (url.searchParams.get('src') !== 'push') return null;
  url.searchParams.delete('src');
  return url.toString();
}

/** The saved filter a reminder asked to open (`?open=<id>`), if it still exists. */
export function presetToOpen(search: string, presets: readonly FilterPreset[]): FilterPreset | null {
  const id = new URLSearchParams(search).get('open');
  if (!id) return null;
  return presets.find((p) => p.id === id) ?? null;
}
