import { describe, it, expect, vi } from 'vitest';

// supabase.ts reads the schema from env at module load and hands it to
// createClient, so each case needs a fresh module graph. createClient is mocked
// because the assertion is about the options we pass, not about reaching a
// server.
//
// vi.hoisted, because vi.mock is lifted above every const in the file — a plain
// `const createClient = vi.fn()` referenced from the factory throws on the
// temporal dead zone.
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ mock: true })),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

async function loadSupabase(schema?: string) {
  vi.resetModules();
  createClient.mockClear();
  if (schema === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_SCHEMA;
  else process.env.NEXT_PUBLIC_SUPABASE_SCHEMA = schema;
  return import('./supabase');
}

describe('getSupabaseForCity', () => {
  it('reads the public schema when nothing is configured', async () => {
    const { getSupabaseForCity } = await loadSupabase();
    getSupabaseForCity('szczecin');
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { db: { schema: 'public' } }
    );
  });

  it('reads the configured schema instead', async () => {
    const { getSupabaseForCity } = await loadSupabase('dev');
    getSupabaseForCity('szczecin');
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { db: { schema: 'dev' } }
    );
  });

  it('still returns one memoized client per city', async () => {
    const { getSupabaseForCity } = await loadSupabase();
    const first = getSupabaseForCity('szczecin');
    const second = getSupabaseForCity('szczecin');
    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
