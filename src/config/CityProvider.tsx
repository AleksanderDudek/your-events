'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

interface CityContextValue {
  city: CityConfig;
  setCity: (id: CityId) => void;
  cities: readonly CityConfig[]; // all configured cities
  availableCities: readonly CityConfig[]; // cities with a wired-up endpoint
  // True after the first client-side resolution pass completes. The hero
  // headline uses this to know when to animate from the generic word to the
  // city's name.
  isResolved: boolean;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({
  children,
  initialCityId,
}: {
  children: React.ReactNode;
  initialCityId?: CityId;
}) {
  // SSR + first paint use the default city so the static HTML matches.
  // The "real" city is reconciled after hydration from localStorage or
  // geolocation, which flips isResolved=true and lets the hero animate.
  // When initialCityId is supplied (from the URL-aware [city] layout), it
  // wins outright and the resolution effect below is a no-op.
  const [cityId, setCityId] = useState<CityId>(initialCityId ?? DEFAULT_CITY_ID);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (initialCityId) {
      setIsResolved(true);
      return;
    }

    let cancelled = false;

    const finalize = (id: CityId) => {
      if (cancelled) return;
      // Intentional: SSR uses DEFAULT_CITY; reconciled here post-hydration.
      setCityId((prev) => (prev === id ? prev : id));
      setIsResolved(true);
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

    // 2) Silent geolocation → nearest available city. Permission denial or
    //    timeout falls back to the default.
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nearest = findNearestAvailableCity(
            pos.coords.latitude,
            pos.coords.longitude
          );
          finalize(nearest.id as CityId);
        },
        () => finalize(DEFAULT_CITY_ID),
        { timeout: 4000, maximumAge: 1000 * 60 * 60 * 24 }
      );
    } else {
      finalize(DEFAULT_CITY_ID);
    }

    return () => {
      cancelled = true;
    };
  }, [initialCityId]);

  const setCity = useCallback((next: CityId) => {
    setCityId(next);
    setIsResolved(true);
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
    // Tests render components in isolation — fall back to the default city
    // so consumers stay functional without a provider.
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
