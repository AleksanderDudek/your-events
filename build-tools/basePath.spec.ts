import { describe, it, expect } from 'vitest';
import { DEFAULT_BASE_PATH, resolveBasePath, toViteBase } from './basePath';

describe('resolveBasePath', () => {
  it('falls back to the GitHub Pages project subpath when the variable is unset', () => {
    expect(resolveBasePath(undefined)).toBe(DEFAULT_BASE_PATH);
    expect(DEFAULT_BASE_PATH).toBe('/your-events');
  });

  // Production deletes the variable in GitHub, which Actions hands over as ''.
  // That has to mean "served at the domain root", never "use the default".
  it('treats an empty value as the domain root', () => {
    expect(resolveBasePath('')).toBe('');
    expect(resolveBasePath('  ')).toBe('');
    expect(resolveBasePath('/')).toBe('');
  });

  it('normalizes slashes', () => {
    expect(resolveBasePath('/your-events-prod/')).toBe('/your-events-prod');
    expect(resolveBasePath('your-events')).toBe('/your-events');
  });
});

describe('toViteBase', () => {
  it('always ends in a slash, as Vite `base` and React Router `basename` expect', () => {
    expect(toViteBase('')).toBe('/');
    expect(toViteBase('/your-events')).toBe('/your-events/');
  });
});
