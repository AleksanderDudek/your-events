import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CityId, DEFAULT_CITY_ID, getCity } from '@/config/cities';
import { env } from '@/config/env';

// One Supabase client per city. createClient is cheap-ish but holds its own
// fetch state and pending requests, so we memoize to avoid leaks on rerenders.
const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseForCity(cityId: CityId | string = DEFAULT_CITY_ID): SupabaseClient {
  const city = getCity(cityId);
  const cached = clientCache.get(city.id);
  if (cached) return cached;
  // The schema name is a runtime string (from env), not a literal, so its
  // inferred type doesn't match the "public"-defaulted SupabaseClient generic.
  // Database is untyped (any) here anyway, so the schema-name generic carries
  // no real type safety to lose; the cast just realigns the declared type.
  const client = createClient(city.supabase.url, city.supabase.anonKey, {
    db: { schema: env.NEXT_PUBLIC_SUPABASE_SCHEMA },
  }) as SupabaseClient;
  clientCache.set(city.id, client);
  return client;
}
