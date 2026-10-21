'use client';

import { useCallback, useState } from 'react';
import { roundCoord, type LatLng } from '@/lib/geo';

export type GeolocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

// ~110 m. A fix ends up in the address bar — shareable, and part of the page
// address Clarity records when consented — so it is coarsened before it goes
// anywhere: enough to keep a home from being pinpointed, and nothing a radius
// of 500 m and up can notice.
const FIX_DECIMALS = 3;

const LAST_FIX_KEY = 'go-to-city.last-fix';

const POSITION_OPTIONS: PositionOptions = {
  // A cell-tower position can be kilometres out — no use against a 500 m radius.
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000,
};

// GeolocationPositionError codes. The named constants live on the error
// instance, which a test double has no reason to carry.
function errorKind(code: number): GeolocationErrorKind {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

function fixKey(point: LatLng): string {
  return `${point.lat},${point.lng}`;
}

/**
 * Whether `point` is the position this tab last got from the device — what
 * lets an unlabelled point be called "your location". A point that arrived any
 * other way (a map pick, someone else's shared link) never matches.
 */
export function isOwnFix(point: LatLng): boolean {
  try {
    return window.sessionStorage.getItem(LAST_FIX_KEY) === fixKey(point);
  } catch {
    return false;
  }
}

/**
 * The device's position, on request. Never asked for on load: a permission
 * prompt nobody asked for is the fastest way to a permanent "block".
 */
export function useGeolocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<GeolocationErrorKind | null>(null);

  const locate = useCallback((): Promise<LatLng | null> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('unsupported');
      return Promise.resolve(null);
    }
    setIsLocating(true);
    setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = {
            lat: roundCoord(position.coords.latitude, FIX_DECIMALS),
            lng: roundCoord(position.coords.longitude, FIX_DECIMALS),
          };
          try {
            window.sessionStorage.setItem(LAST_FIX_KEY, fixKey(point));
          } catch {
            // Storage blocked: the point still works, it is just called
            // "selected point" instead of "your location".
          }
          setIsLocating(false);
          resolve(point);
        },
        (failure) => {
          setIsLocating(false);
          setError(errorKind(failure.code));
          resolve(null);
        },
        POSITION_OPTIONS
      );
    });
  }, []);

  return { locate, isLocating, error };
}
