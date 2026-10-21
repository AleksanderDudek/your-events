import { boundingBox, CITY_AREA_RADIUS_M, isValidLatLng, type LatLng } from '@/lib/geo';
import type { Locale } from '@/i18n';

// Photon — komoot's geocoder over OpenStreetMap data. Chosen over Nominatim
// because it is built for search-as-you-type, which Nominatim's usage policy
// forbids from a browser. Fair use, no key: callers debounce, cache and cancel
// (see useAddressSearch). Its data is OpenStreetMap's (ODbL), credited under
// the search box.
export const PHOTON_URL = 'https://photon.komoot.io/api/';

const SUGGESTION_LIMIT = 5;

// Photon usually answers within two seconds. Past this it is down or swamped,
// and the box should say so instead of "Searching…" for as long as it is open.
export const SEARCH_TIMEOUT_MS = 8000;

// Photon speaks default/de/en/fr. `default` is each place's own name — Polish,
// for Polish places — which is what a Polish interface wants anyway.
const PHOTON_LANG: Record<Locale, string> = { pl: 'default', en: 'en' };

// Street level and finer. A city, county or country would put the point in the
// middle of an area, which is nowhere in particular.
const LAYERS = ['house', 'street', 'locality', 'district', 'other'] as const;

export interface AddressSuggestion {
  /** OSM type + id: stable across searches, so usable as a React key. */
  id: string;
  /** What the point is called: "Świdnicka 12", "Pixel XL, Świdnicka 12", "Rynek". */
  label: string;
  /** Where it is, for telling look-alikes apart: "Stare Miasto, Wrocław". */
  detail: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
  };
}

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

/** The request for `query`: confined to the area around `center`, and biased towards it. */
export function photonUrl(query: string, center: LatLng, locale: Locale): string {
  const box = boundingBox(center, CITY_AREA_RADIUS_M);
  const params = new URLSearchParams({
    q: query,
    limit: String(SUGGESTION_LIMIT),
    lang: PHOTON_LANG[locale] ?? 'default',
    lat: String(center.lat),
    lon: String(center.lng),
    // minLon,minLat,maxLon,maxLat
    bbox: [box.west, box.south, box.east, box.north].map((v) => v.toFixed(4)).join(','),
  });
  for (const layer of LAYERS) params.append('layer', layer);
  return `${PHOTON_URL}?${params.toString()}`;
}

/** One Photon feature as a suggestion, or null when it has no usable point or name. */
export function toSuggestion(feature: PhotonFeature): AddressSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  // GeoJSON order: longitude first.
  const [lng, lat] = coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidLatLng(lat, lng)) return null;

  const p = feature.properties ?? {};
  const address = [p.street, p.housenumber].filter(Boolean).join(' ');
  // A named place leads with its name and keeps its address beside it; a bare
  // building is its address; a street is just its name.
  let label = address;
  if (p.name) label = address && address !== p.name ? `${p.name}, ${address}` : p.name;
  if (!label) return null;

  const detail = Array.from(new Set([p.district ?? p.locality, p.city].filter(Boolean))).join(', ');

  return {
    id: p.osm_type && p.osm_id !== undefined ? `${p.osm_type}${p.osm_id}` : `${lat},${lng}`,
    label,
    detail,
    lat,
    lng,
  };
}

/** Address suggestions for `query` around `center`. Throws GeocodingError on a failed response. */
export async function searchAddresses(
  query: string,
  center: LatLng,
  locale: Locale,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  // One controller for both ways a request ends early: the caller moved on (a
  // newer search superseded this one), or the clock ran out (Photon is not
  // answering). Only the second is a failure worth showing.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new GeocodingError(`Photon did not answer in ${SEARCH_TIMEOUT_MS} ms`)),
    SEARCH_TIMEOUT_MS
  );
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(photonUrl(query, center, locale), { signal: controller.signal });
    if (!response.ok) throw new GeocodingError(`Photon answered ${response.status}`);
    const body = (await response.json()) as { features?: unknown } | null;
    // Something answered, but not Photon (a captive portal, a changed API): a
    // failed search, which must not read as "no such address".
    if (!Array.isArray(body?.features)) {
      throw new GeocodingError('Photon answered without a feature list');
    }

    // OpenStreetMap often maps one place twice (a node and a building
    // outline), and Photon returns both under one name.
    const seen = new Set<string>();
    const suggestions: AddressSuggestion[] = [];
    for (const feature of body.features as PhotonFeature[]) {
      const suggestion = toSuggestion(feature);
      if (!suggestion) continue;
      const key = `${suggestion.label}|${suggestion.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(suggestion);
    }
    return suggestions;
  } catch (error) {
    // A timeout surfaces as the reason the request was aborted with.
    if (controller.signal.reason instanceof GeocodingError) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
