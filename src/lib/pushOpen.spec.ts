import { describe, expect, it } from 'vitest';
import { presetToOpen, stripPushSource } from './pushOpen';
import type { FilterPreset } from '@/types/preset.types';

describe('stripPushSource', () => {
  it('returns null when the visit did not come from a push', () => {
    expect(stripPushSource('https://idznamiasto.pl/?a=1')).toBeNull();
  });

  it('removes src=push and keeps everything else', () => {
    expect(stripPushSource('https://idznamiasto.pl/moje-filtry/?open=p1&src=push')).toBe(
      'https://idznamiasto.pl/moje-filtry/?open=p1'
    );
  });
});

describe('presetToOpen', () => {
  const presets = [{ id: 'p1' }, { id: 'p2' }] as FilterPreset[];

  it('finds the filter named by ?open=', () => {
    expect(presetToOpen('?open=p2&src=push', presets)?.id).toBe('p2');
  });

  it('returns null for no ?open= or an unknown id', () => {
    expect(presetToOpen('', presets)).toBeNull();
    expect(presetToOpen('?open=gone', presets)).toBeNull();
  });
});
