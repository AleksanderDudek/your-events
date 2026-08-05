import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_VERSION,
  hasSeenCurrent,
  isOnboardingRoute,
  isTourRoute,
  parseSeenVersion,
  tourPath,
} from './onboarding';

// The app's real predicate is config/cities#isCityId; these tests only need
// "wroclaw and szczecin are cities, nothing else is".
const isCity = (segment: string) => segment === 'wroclaw' || segment === 'szczecin';

describe('parseSeenVersion', () => {
  it('reads a stored version', () => {
    expect(parseSeenVersion('0')).toBe(0);
    expect(parseSeenVersion('1')).toBe(1);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseSeenVersion(' 1 ')).toBe(1);
  });

  it('treats "never stored" as null', () => {
    expect(parseSeenVersion(null)).toBeNull();
    expect(parseSeenVersion('')).toBeNull();
  });

  // Everything unparseable has to land on "offer the sheet again". The opposite
  // failure — junk read as "already seen" — silently removes the feature.
  it('treats junk as never seen', () => {
    expect(parseSeenVersion('abc')).toBeNull();
    expect(parseSeenVersion('1.5')).toBeNull();
    expect(parseSeenVersion('-1')).toBeNull();
    expect(parseSeenVersion('1e3')).toBeNull();
    expect(parseSeenVersion('{"v":1}')).toBeNull();
  });

  // A value from a future build (the visitor used a newer deploy, then a stale
  // cache served them this one) must not read as "seen version 99 ≥ 1".
  it('treats a version from the future as never seen', () => {
    expect(parseSeenVersion(String(ONBOARDING_VERSION + 1))).toBeNull();
  });
});

describe('hasSeenCurrent', () => {
  it('is true only at or above the current version', () => {
    expect(hasSeenCurrent(String(ONBOARDING_VERSION))).toBe(true);
    // An older stored version re-offers the sheet — the point of storing a
    // number rather than a flag.
    expect(hasSeenCurrent(String(ONBOARDING_VERSION - 1))).toBe(false);
    expect(hasSeenCurrent(null)).toBe(false);
    expect(hasSeenCurrent('junk')).toBe(false);
  });
});

describe('isOnboardingRoute', () => {
  it('allows the city home and the events list', () => {
    expect(isOnboardingRoute('/wroclaw', isCity)).toBe(true);
    expect(isOnboardingRoute('/wroclaw/', isCity)).toBe(true);
    expect(isOnboardingRoute('/wroclaw/wydarzenia/', isCity)).toBe(true);
  });

  it('stays out of the city picker', () => {
    expect(isOnboardingRoute('/', isCity)).toBe(false);
  });

  // The regression this predicate's city check exists for: these are one
  // segment long, exactly like a city home.
  it('stays out of the top-level utility pages', () => {
    expect(isOnboardingRoute('/moje-filtry/', isCity)).toBe(false);
    expect(isOnboardingRoute('/prywatnosc/', isCity)).toBe(false);
    expect(isOnboardingRoute('/rozwijaj-z-nami/', isCity)).toBe(false);
  });

  it('stays out of category hubs and event pages', () => {
    expect(isOnboardingRoute('/wroclaw/muzyka/', isCity)).toBe(false);
    expect(isOnboardingRoute('/wroclaw/muzyka/koncert-abc/', isCity)).toBe(false);
  });
});

describe('isTourRoute', () => {
  it('is the events list only', () => {
    expect(isTourRoute('/wroclaw/wydarzenia/', isCity)).toBe(true);
    expect(isTourRoute('/wroclaw/', isCity)).toBe(false);
    expect(isTourRoute('/moje-filtry/', isCity)).toBe(false);
    expect(isTourRoute('/notacity/wydarzenia/', isCity)).toBe(false);
  });
});

describe('tourPath', () => {
  it('points at the city events list', () => {
    expect(tourPath('wroclaw')).toBe('/wroclaw/wydarzenia');
  });
});
