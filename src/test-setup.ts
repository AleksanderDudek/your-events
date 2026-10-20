import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Required so modules that import supabase (via env.ts) can load under vitest.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// jsdom ships no ResizeObserver. ui/MediaFill uses one to pick object-fit from
// the slot's measured ratio — a decision jsdom could not make anyway, since it
// lays nothing out (every getBoundingClientRect is 0×0). The stub lets those
// components render; the fit itself is verified in the browser.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
