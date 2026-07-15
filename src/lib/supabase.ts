import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CityId, DEFAULT_CITY_ID, getCity } from '@/config/cities';

// One Supabase client per city. createClient is cheap-ish but holds its own
// fetch state and pending requests, so we memoize to avoid leaks on rerenders.
const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseForCity(cityId: CityId | string = DEFAULT_CITY_ID): SupabaseClient {
  const city = getCity(cityId);
  const cached = clientCache.get(city.id);
  if (cached) return cached;
  const client = createClient(city.supabase.url, city.supabase.anonKey);
  clientCache.set(city.id, client);
  return client;
}
