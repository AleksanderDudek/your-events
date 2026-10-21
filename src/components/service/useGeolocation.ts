'use client';

import { useCallback, useRef, useState } from 'react';
import { roundCoord, type LatLng } from '@/lib/geo';

export type GeolocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

// ~110 m. A fix ends up in the address bar — shareable, and part of the page
// address Clarity records when consented — so it is coarsened before it goes
// anywhere: enough to keep a home from being pinpointed, and nothing a radius
// of 500 m and up can notice.
const FIX_DECIMALS = 3;

const LAST_FIX_KEY = 'go-to-city.last-fix';

const FIX_TIMEOUT_MS = 12_000;

const POSITION_OPTIONS: PositionOptions = {
  // A cell-tower position can be kilometres out — no use against a 500 m radius.
  enableHighAccuracy: true,
  timeout: FIX_TIMEOUT_MS,
  maximumAge: 60_000,
};

// The browser's own timeout does not count time spent on the permission
// prompt, and a prompt dismissed without an answer (Firefox's, closed with
// Escape) calls neither callback. This deadline is ours: long enough for
// someone to make up their mind, short enough that the button never reads
// "Finding your location…" for good.
const GIVE_UP_MS = FIX_TIMEOUT_MS + 30_000;

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
  // Every request is numbered and only the newest may answer, so pressing the
  // button again re-asks (and re-prompts) instead of waiting on a lost one.
  const latest = useRef(0);

  const locate = useCallback((): Promise<LatLng | null> => {
    const request = ++latest.current;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('unsupported');
      return Promise.resolve(null);
    }
    setIsLocating(true);
    setError(null);
    return new Promise((resolve) => {
      let settled = false;
      const settle = (point: LatLng | null, failure: GeolocationErrorKind | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        // Superseded: the newer request owns the state, and its answer the point.
        if (request !== latest.current) {
          resolve(null);
          return;
        }
        if (point) {
          try {
            window.sessionStorage.setItem(LAST_FIX_KEY, fixKey(point));
          } catch {
            // Storage blocked: the point still works, it is just called
            // "selected point" instead of "your location".
          }
        }
        setIsLocating(false);
        setError(failure);
        resolve(point);
      };
      const deadline = setTimeout(() => settle(null, 'timeout'), GIVE_UP_MS);
      try {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            settle(
              {
                lat: roundCoord(position.coords.latitude, FIX_DECIMALS),
                lng: roundCoord(position.coords.longitude, FIX_DECIMALS),
              },
              null
            ),
          (failure) => settle(null, errorKind(failure.code)),
          POSITION_OPTIONS
        );
      } catch {
        settle(null, 'unavailable');
      }
    });
  }, []);

  return { locate, isLocating, error };
}
