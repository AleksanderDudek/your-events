import { describe, it, expect, vi } from 'vitest';

// cities.ts resolves availability from env at MODULE LOAD time, so each case
// sets the relevant env vars then imports a fresh copy of the module via
// vi.resetModules() + dynamic import. This is the real end-to-end proof of the
// NEXT_PUBLIC_ENABLED_CITIES toggle: everything else in the app reads the
// `available` flag / AVAILABLE_CITIES that this computes.

const TOUCHED_KEYS = [
  'NEXT_PUBLIC_ENABLED_CITIES',
  'NEXT_PUBLIC_SUPABASE_URL_WROCLAW',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW',
  'NEXT_PUBLIC_SUPABASE_URL_SZCZECIN',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY_SZCZECIN',
  'NEXT_PUBLIC_SUPABASE_URL_POZNAN',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY_POZNAN',
] as const;

async function loadCities(overrides: Record<string, string>) {
  vi.resetModules();
  // Clear anything a prior case set so scenarios don't leak into each other.
  for (const k of TOUCHED_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  return import('./cities');
}

const WROCLAW_CREDS = {
  NEXT_PUBLIC_SUPABASE_URL_WROCLAW: 'https://wroclaw.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW: 'wroclaw-key',
};

const idsOf = (cities: readonly { id: string }[]) => cities.map((c) => c.id).sort();

describe('city availability toggle (NEXT_PUBLIC_ENABLED_CITIES)', () => {
  it('unset list: availability falls back to Supabase config (backwards compatible)', async () => {
    const { AVAILABLE_CITIES } = await loadCities({
      NEXT_PUBLIC_ENABLED_CITIES: '',
      ...WROCLAW_CREDS,
    });
    // szczecin (DEFAULT_CITY_ID → shared creds) + wroclaw (dedicated creds).
    expect(idsOf(AVAILABLE_CITIES)).toEqual(['szczecin', 'wroclaw']);
  });

  it('allowlist hides a configured city — even the default one', async () => {
    const { AVAILABLE_CITIES, getCity } = await loadCities({
      NEXT_PUBLIC_ENABLED_CITIES: 'wroclaw',
      ...WROCLAW_CREDS,
    });
    expect(idsOf(AVAILABLE_CITIES)).toEqual(['wroclaw']);
    expect(getCity('szczecin').available).toBe(false);
  });

  it('enabling a city WITHOUT its Supabase creds does not make it live', async () => {
    const { getCity } = await loadCities({
      NEXT_PUBLIC_ENABLED_CITIES: 'wroclaw,poznan',
      ...WROCLAW_CREDS,
      // poznan is enabled but has no data source → must stay unavailable.
    });
    expect(getCity('poznan').available).toBe(false);
    expect(getCity('wroclaw').available).toBe(true);
  });

  it('enabling a city WITH its Supabase creds makes it live', async () => {
    const { getCity } = await loadCities({
      NEXT_PUBLIC_ENABLED_CITIES: 'wroclaw,poznan',
      ...WROCLAW_CREDS,
      NEXT_PUBLIC_SUPABASE_URL_POZNAN: 'https://poznan.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY_POZNAN: 'poznan-key',
    });
    expect(getCity('poznan').available).toBe(true);
    expect(getCity('wroclaw').available).toBe(true);
  });

  it('whitespace and unknown ids in the list are tolerated', async () => {
    const { AVAILABLE_CITIES } = await loadCities({
      NEXT_PUBLIC_ENABLED_CITIES: ' wroclaw , not-a-city ',
      ...WROCLAW_CREDS,
    });
    expect(idsOf(AVAILABLE_CITIES)).toEqual(['wroclaw']);
  });
});
