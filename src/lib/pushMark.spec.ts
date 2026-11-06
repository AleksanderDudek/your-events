import { describe, expect, it } from 'vitest';
import { markPreset, reconcileMark } from './pushMark';
import type { FilterPreset } from '@/types/preset.types';

const p = (id: string, name: string) => ({ id, name }) as FilterPreset;

describe('markPreset', () => {
  it('marks one filter, replacing any other', () => {
    const marked = markPreset({ locale: 'pl', preset: { id: 'a', name: 'A' } }, p('b', 'B'));
    expect(marked).toEqual({ locale: 'pl', preset: { id: 'b', name: 'B' } });
  });

  it('unmarks', () => {
    expect(markPreset({ locale: 'en', preset: { id: 'a', name: 'A' } }, null)).toEqual({ locale: 'en', preset: null });
  });

  it('stores at most 60 characters of the name', () => {
    expect(markPreset({ locale: 'pl', preset: null }, p('a', 'x'.repeat(90))).preset?.name).toHaveLength(60);
  });
});

describe('reconcileMark', () => {
  it('returns the same object when nothing changed', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('a', 'A')])).toBe(s);
  });

  it('follows a rename', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('a', 'Nowa')])).toEqual({ locale: 'pl', preset: { id: 'a', name: 'Nowa' } });
  });

  it('drops the mark when the filter was deleted', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('b', 'B')])).toEqual({ locale: 'pl', preset: null });
  });

  it('leaves an unmarked record alone', () => {
    const s = { locale: 'pl' as const, preset: null };
    expect(reconcileMark(s, [])).toBe(s);
  });
});
