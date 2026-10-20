import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CityId, DEFAULT_CITY_ID, getCity } from '@/config/cities';
import { env } from '@/config/env';

// One Supabase client per city. createClient is cheap-ish but holds its own
// fetch state and pending requests, so we memoize to avoid leaks on rerenders.
// We have no generated Database type, so the first generic stays `any` (its
// own default in @supabase/supabase-js) — each use needs its own disable
// since eslint flags every `any` occurrence individually.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<string, SupabaseClient<any, string>>();

export function getSupabaseForCity(
  cityId: CityId | string = DEFAULT_CITY_ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SupabaseClient<any, string> {
  const city = getCity(cityId);
  const cached = clientCache.get(city.id);
  if (cached) return cached;
  // The schema name is a runtime string (from env), not a literal, so the
  // schema-name generic is widened to `string`. Database is untyped here anyway,
  // so that generic carries no safety to lose — and widening one parameter beats
  // casting the whole return type, which would swallow unrelated type errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createClient<any, string>(city.supabase.url, city.supabase.anonKey, {
    db: { schema: env.NEXT_PUBLIC_SUPABASE_SCHEMA },
  });
  clientCache.set(city.id, client);
  return client;
}
