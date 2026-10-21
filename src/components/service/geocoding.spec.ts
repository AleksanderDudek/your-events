import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GeocodingError,
  PHOTON_URL,
  SEARCH_TIMEOUT_MS,
  photonUrl,
  searchAddresses,
  toSuggestion,
} from './geocoding';

const WROCLAW = { lat: 51.1079, lng: 17.0385 };

function feature(properties: Record<string, unknown>, coordinates: unknown = [17.0322, 51.1069]) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties };
}

const answer = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// A fetch that settles only by being aborted: Photon hanging.
const hangingFetch = () =>
  vi.fn(
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      })
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('photonUrl', () => {
  it('asks Photon for a few street-level results around the city', () => {
    const url = new URL(photonUrl('Świdnicka 12', WROCLAW, 'pl'));
    expect(`${url.origin}${url.pathname}`).toBe(PHOTON_URL);
    expect(url.searchParams.get('q')).toBe('Świdnicka 12');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('lat')).toBe('51.1079');
    expect(url.searchParams.get('lon')).toBe('17.0385');
    expect(url.searchParams.getAll('layer')).toEqual(['house', 'street', 'locality', 'district', 'other']);
  });

  it('confines results to a box around the city, ordered west, south, east, north', () => {
    const [west, south, east, north] = new URL(photonUrl('x', WROCLAW, 'pl')).searchParams
      .get('bbox')!
      .split(',')
      .map(Number);
    expect(west).toBeLessThan(WROCLAW.lng);
    expect(east).toBeGreaterThan(WROCLAW.lng);
    expect(south).toBeLessThan(WROCLAW.lat);
    // 25 km is ~0.225° of latitude.
    expect(north - WROCLAW.lat).toBeCloseTo(0.225, 2);
  });

  it('maps the interface language onto the ones Photon speaks', () => {
    expect(new URL(photonUrl('x', WROCLAW, 'pl')).searchParams.get('lang')).toBe('default');
    expect(new URL(photonUrl('x', WROCLAW, 'en')).searchParams.get('lang')).toBe('en');
  });
});

describe('toSuggestion', () => {
  it('names a bare building by its address', () => {
    expect(
      toSuggestion(
        feature({
          osm_type: 'W',
          osm_id: 7,
          street: 'Świdnicka',
          housenumber: '12-16',
          district: 'Stare Miasto',
          city: 'Wrocław',
        })
      )
    ).toEqual({
      id: 'W7',
      label: 'Świdnicka 12-16',
      detail: 'Stare Miasto, Wrocław',
      lat: 51.1069,
      lng: 17.0322,
    });
  });

  it("leads with a place's name and keeps its address beside it", () => {
    expect(toSuggestion(feature({ name: 'Pixel XL', street: 'Świdnicka', housenumber: '12' }))?.label).toBe(
      'Pixel XL, Świdnicka 12'
    );
  });

  it('names a street by its name alone', () => {
    expect(toSuggestion(feature({ name: 'Rynek', city: 'Wrocław' }))).toMatchObject({
      label: 'Rynek',
      detail: 'Wrocław',
    });
  });

  it('falls back to the locality, and does not repeat a district that is the city', () => {
    expect(toSuggestion(feature({ name: 'X', locality: 'Nadodrze', city: 'Wrocław' }))?.detail).toBe(
      'Nadodrze, Wrocław'
    );
    expect(toSuggestion(feature({ name: 'X', district: 'Opole', city: 'Opole' }))?.detail).toBe('Opole');
  });

  it('drops a feature with no name, no address or no usable point', () => {
    expect(toSuggestion(feature({ city: 'Wrocław' }))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, [17.03]))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, ['a', 'b']))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, [200, 51]))).toBeNull();
  });
});

describe('searchAddresses', () => {
  it('returns suggestions, without the duplicates OSM produces', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      answer({
        features: [
          feature({ osm_type: 'N', osm_id: 1, name: 'Rynek', city: 'Wrocław' }),
          feature({ osm_type: 'W', osm_id: 2, name: 'Rynek', city: 'Wrocław' }),
          feature({ osm_type: 'W', osm_id: 3, street: 'Świdnicka', housenumber: '12', city: 'Wrocław' }),
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const suggestions = await searchAddresses('rynek', WROCLAW, 'pl');

    expect(suggestions.map((s) => s.label)).toEqual(['Rynek', 'Świdnicka 12']);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=rynek'), {
      signal: expect.any(AbortSignal),
    });
  });

  it('cancels the request when the caller does, so a superseded search stops', async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);
    const caller = new AbortController();

    const search = searchAddresses('rynek', WROCLAW, 'pl', caller.signal);
    caller.abort();
    const error = await search.catch((e: unknown) => e);

    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    // A cancellation, not a failure: React Query drops it without an error state.
    expect(error).not.toBeInstanceOf(GeocodingError);
  });

  // The spec's "down or slow": a Photon that never answers must end in the
  // error message, not in "Searching…" for as long as the tab is open.
  it('gives up on a Photon that does not answer, as a failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingFetch());

    const outcome = expect(searchAddresses('rynek', WROCLAW, 'pl')).rejects.toBeInstanceOf(
      GeocodingError
    );
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    await outcome;
  });

  it('throws GeocodingError when Photon fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer('nope', 503)));

    await expect(searchAddresses('rynek', WROCLAW, 'pl')).rejects.toBeInstanceOf(GeocodingError);
  });

  // A captive portal or a changed API answering 200 must not read as "no such
  // address": the search failed, it did not come back empty.
  it('treats an answer with no feature list as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer({ message: 'Sign in to the Wi-Fi' })));

    await expect(searchAddresses('rynek', WROCLAW, 'pl')).rejects.toBeInstanceOf(GeocodingError);
  });
});
