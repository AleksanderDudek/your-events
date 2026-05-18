import { env } from './env';

// Per-city configuration. Each Polish voivodeship capital city has its own
// Supabase project (events live in city-specific databases). The Supabase
// schema itself is shared and is NOT modified for multi-city — only the
// project URL/anon key change.
//
// For non-default cities, supply env vars in the form
// NEXT_PUBLIC_SUPABASE_URL_<CITY_ID_UPPER> and
// NEXT_PUBLIC_SUPABASE_ANON_KEY_<CITY_ID_UPPER>. Missing entries fall back to
// the default project so the app keeps working until a city's project is wired
// up. Cities without their own resolved endpoint are marked `available: false`
// in CITIES and hidden from the picker.

type LocalizedString = Record<'pl' | 'en', string>;

interface CityConfigBase {
  readonly id: string;
  readonly displayName: LocalizedString;
  // Polish locative ("w Szczecinie"); English usually matches displayName.
  readonly locativeForm: LocalizedString;
  // Polish accusative ("Idź na Szczecin"); slots into the hero headline.
  readonly accusativeForm: LocalizedString;
  readonly coordinates: { readonly lat: number; readonly lng: number };
}

export interface CityConfig extends CityConfigBase {
  readonly supabase: { readonly url: string; readonly anonKey: string };
  // False when no dedicated Supabase project is configured yet — the city is
  // still listed for completeness but hidden from the picker UI.
  readonly available: boolean;
}

const CITY_DEFS = [
  {
    id: 'szczecin',
    displayName: { pl: 'Szczecin', en: 'Szczecin' },
    locativeForm: { pl: 'Szczecinie', en: 'Szczecin' },
    accusativeForm: { pl: 'Szczecin', en: 'Szczecin' },
    coordinates: { lat: 53.4285, lng: 14.5528 },
  },
  {
    id: 'warszawa',
    displayName: { pl: 'Warszawa', en: 'Warsaw' },
    locativeForm: { pl: 'Warszawie', en: 'Warsaw' },
    accusativeForm: { pl: 'Warszawę', en: 'Warsaw' },
    coordinates: { lat: 52.2297, lng: 21.0122 },
  },
  {
    id: 'krakow',
    displayName: { pl: 'Kraków', en: 'Kraków' },
    locativeForm: { pl: 'Krakowie', en: 'Kraków' },
    accusativeForm: { pl: 'Kraków', en: 'Kraków' },
    coordinates: { lat: 50.0647, lng: 19.945 },
  },
  {
    id: 'lodz',
    displayName: { pl: 'Łódź', en: 'Łódź' },
    locativeForm: { pl: 'Łodzi', en: 'Łódź' },
    accusativeForm: { pl: 'Łódź', en: 'Łódź' },
    coordinates: { lat: 51.7592, lng: 19.4559 },
  },
  {
    id: 'wroclaw',
    displayName: { pl: 'Wrocław', en: 'Wrocław' },
    locativeForm: { pl: 'Wrocławiu', en: 'Wrocław' },
    accusativeForm: { pl: 'Wrocław', en: 'Wrocław' },
    coordinates: { lat: 51.1079, lng: 17.0385 },
  },
  {
    id: 'poznan',
    displayName: { pl: 'Poznań', en: 'Poznań' },
    locativeForm: { pl: 'Poznaniu', en: 'Poznań' },
    accusativeForm: { pl: 'Poznań', en: 'Poznań' },
    coordinates: { lat: 52.4064, lng: 16.9252 },
  },
  {
    id: 'gdansk',
    displayName: { pl: 'Gdańsk', en: 'Gdańsk' },
    locativeForm: { pl: 'Gdańsku', en: 'Gdańsk' },
    accusativeForm: { pl: 'Gdańsk', en: 'Gdańsk' },
    coordinates: { lat: 54.352, lng: 18.6466 },
  },
  {
    id: 'bydgoszcz',
    displayName: { pl: 'Bydgoszcz', en: 'Bydgoszcz' },
    locativeForm: { pl: 'Bydgoszczy', en: 'Bydgoszcz' },
    accusativeForm: { pl: 'Bydgoszcz', en: 'Bydgoszcz' },
    coordinates: { lat: 53.1235, lng: 18.0084 },
  },
  {
    id: 'torun',
    displayName: { pl: 'Toruń', en: 'Toruń' },
    locativeForm: { pl: 'Toruniu', en: 'Toruń' },
    accusativeForm: { pl: 'Toruń', en: 'Toruń' },
    coordinates: { lat: 53.0138, lng: 18.5984 },
  },
  {
    id: 'lublin',
    displayName: { pl: 'Lublin', en: 'Lublin' },
    locativeForm: { pl: 'Lublinie', en: 'Lublin' },
    accusativeForm: { pl: 'Lublin', en: 'Lublin' },
    coordinates: { lat: 51.2465, lng: 22.5684 },
  },
  {
    id: 'katowice',
    displayName: { pl: 'Katowice', en: 'Katowice' },
    locativeForm: { pl: 'Katowicach', en: 'Katowice' },
    accusativeForm: { pl: 'Katowice', en: 'Katowice' },
    coordinates: { lat: 50.2649, lng: 19.0238 },
  },
  {
    id: 'bialystok',
    displayName: { pl: 'Białystok', en: 'Białystok' },
    locativeForm: { pl: 'Białymstoku', en: 'Białystok' },
    accusativeForm: { pl: 'Białystok', en: 'Białystok' },
    coordinates: { lat: 53.1325, lng: 23.1688 },
  },
  {
    id: 'kielce',
    displayName: { pl: 'Kielce', en: 'Kielce' },
    locativeForm: { pl: 'Kielcach', en: 'Kielce' },
    accusativeForm: { pl: 'Kielce', en: 'Kielce' },
    coordinates: { lat: 50.8661, lng: 20.6286 },
  },
  {
    id: 'olsztyn',
    displayName: { pl: 'Olsztyn', en: 'Olsztyn' },
    locativeForm: { pl: 'Olsztynie', en: 'Olsztyn' },
    accusativeForm: { pl: 'Olsztyn', en: 'Olsztyn' },
    coordinates: { lat: 53.7784, lng: 20.4801 },
  },
  {
    id: 'rzeszow',
    displayName: { pl: 'Rzeszów', en: 'Rzeszów' },
    locativeForm: { pl: 'Rzeszowie', en: 'Rzeszów' },
    accusativeForm: { pl: 'Rzeszów', en: 'Rzeszów' },
    coordinates: { lat: 50.0413, lng: 21.999 },
  },
  {
    id: 'opole',
    displayName: { pl: 'Opole', en: 'Opole' },
    locativeForm: { pl: 'Opolu', en: 'Opole' },
    accusativeForm: { pl: 'Opole', en: 'Opole' },
    coordinates: { lat: 50.6751, lng: 17.9213 },
  },
  {
    id: 'gorzow',
    displayName: { pl: 'Gorzów Wielkopolski', en: 'Gorzów Wielkopolski' },
    locativeForm: { pl: 'Gorzowie Wielkopolskim', en: 'Gorzów Wielkopolski' },
    accusativeForm: { pl: 'Gorzów Wielkopolski', en: 'Gorzów Wielkopolski' },
    coordinates: { lat: 52.7368, lng: 15.2288 },
  },
  {
    id: 'zielona-gora',
    displayName: { pl: 'Zielona Góra', en: 'Zielona Góra' },
    locativeForm: { pl: 'Zielonej Górze', en: 'Zielona Góra' },
    accusativeForm: { pl: 'Zieloną Górę', en: 'Zielona Góra' },
    coordinates: { lat: 51.9356, lng: 15.5062 },
  },
] as const satisfies readonly CityConfigBase[];

export type CityId = (typeof CITY_DEFS)[number]['id'];

export const DEFAULT_CITY_ID: CityId = 'szczecin';

function envKey(cityId: string): string {
  return cityId.toUpperCase().replace(/-/g, '_');
}

function resolveSupabase(cityId: CityId): {
  url: string;
  anonKey: string;
  available: boolean;
} {
  const k = envKey(cityId);
  const cityUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${k}`];
  const cityKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${k}`];
  if (cityUrl && cityKey) {
    return { url: cityUrl, anonKey: cityKey, available: true };
  }
  // The default city always uses the shared env vars (backwards compatible).
  if (cityId === DEFAULT_CITY_ID) {
    return {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      available: true,
    };
  }
  // No dedicated project yet — fall back to the default so queries don't crash,
  // but mark unavailable so the picker hides it.
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    available: false,
  };
}

export const CITIES: readonly CityConfig[] = CITY_DEFS.map((def) => {
  const { url, anonKey, available } = resolveSupabase(def.id);
  return { ...def, supabase: { url, anonKey }, available };
});

export const AVAILABLE_CITIES: readonly CityConfig[] = CITIES.filter((c) => c.available);

const CITY_INDEX = new Map<string, CityConfig>(CITIES.map((c) => [c.id, c]));

export function getCity(id: string): CityConfig {
  return CITY_INDEX.get(id) ?? CITY_INDEX.get(DEFAULT_CITY_ID)!;
}

export function isCityId(value: unknown): value is CityId {
  return typeof value === 'string' && CITY_INDEX.has(value);
}

// Haversine — kilometres. Good enough for nearest-city snapping.
export function findNearestAvailableCity(lat: number, lng: number): CityConfig {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pool = AVAILABLE_CITIES.length > 0 ? AVAILABLE_CITIES : CITIES;
  let nearest = pool[0];
  let best = Infinity;
  for (const city of pool) {
    const dLat = toRad(city.coordinates.lat - lat);
    const dLng = toRad(city.coordinates.lng - lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) *
        Math.cos(toRad(city.coordinates.lat)) *
        Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance < best) {
      best = distance;
      nearest = city;
    }
  }
  return nearest;
}
