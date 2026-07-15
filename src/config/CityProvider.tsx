'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  AVAILABLE_CITIES,
  CITIES,
  CityConfig,
  CityId,
  DEFAULT_CITY_ID,
  findNearestAvailableCity,
  getCity,
  isCityId,
} from './cities';

const STORAGE_KEY = 'go-to-city.city';

// First path segment, when it is a valid available city (basePath is already
// stripped from usePathname()).
function cityFromPathname(pathname: string): CityId | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg && isCityId(seg) && getCity(seg).available ? seg : null;
}

interface CityContextValue {
  city: CityConfig;
  setCity: (id: CityId) => void;
  cities: readonly CityConfig[]; // all configured cities
  availableCities: readonly CityConfig[]; // cities with a wired-up endpoint
  // True once the city is known: immediately on /{city}/* routes (URL-driven),
  // or after the localStorage/geolocation fallback resolves on city-less routes.
  isResolved: boolean;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: React.ReactNode }) {
  // The URL is the source of truth for the city. usePathname() is reactive, so
  // header, main and footer all follow client navigation between cities. On
  // city-less routes (the "/" picker) we fall back to a stored/geolocated city.
  const pathname = usePathname();
  const urlCity = cityFromPathname(pathname);

  // Fallback city for city-less routes, reconciled after hydration. Ignored
  // whenever the URL carries a city.
  const [fallbackCity, setFallbackCity] = useState<CityId>(DEFAULT_CITY_ID);
  const [fallbackResolved, setFallbackResolved] = useState(false);

  const cityId = urlCity ?? fallbackCity;
  const isResolved = urlCity != null || fallbackResolved;

  useEffect(() => {
    if (urlCity) return; // URL city needs no async resolution

    let cancelled = false;
    const finalize = (id: CityId) => {
      if (cancelled) return;
      setFallbackCity((prev) => (prev === id ? prev : id));
      setFallbackResolved(true);
    };

    // 1) Explicit stored choice wins.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isCityId(stored)) {
        finalize(stored);
        return () => {
          cancelled = true;
        };
      }
    } catch {
      // localStorage may throw in private mode — fall through to geolocation.
    }

    // 2) Silent geolocation → nearest available city; denial/timeout → default.
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => finalize(findNearestAvailableCity(pos.coords.latitude, pos.coords.longitude).id as CityId),
        () => finalize(DEFAULT_CITY_ID),
        { timeout: 4000, maximumAge: 1000 * 60 * 60 * 24 }
      );
    } else {
      finalize(DEFAULT_CITY_ID);
    }

    return () => {
      cancelled = true;
    };
  }, [urlCity]);

  const setCity = useCallback((next: CityId) => {
    // City state is URL-driven; this only records the choice for city-less
    // routes and persists "last visited" for the picker.
    setFallbackCity(next);
    setFallbackResolved(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({
      city: getCity(cityId),
      setCity,
      cities: CITIES,
      availableCities: AVAILABLE_CITIES,
      isResolved,
    }),
    [cityId, setCity, isResolved]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) {
    // Tests render components in isolation — fall back to the default city.
    return {
      city: getCity(DEFAULT_CITY_ID),
      setCity: () => undefined,
      cities: CITIES,
      availableCities: AVAILABLE_CITIES,
      isResolved: false,
    };
  }
  return ctx;
}
