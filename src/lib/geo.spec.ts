import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  boundingBox,
  clampRadius,
  distanceMeters,
  isValidLatLng,
  roundCoord,
} from './geo';

// Wrocław: the Rynek and the main station, ~1.35 km apart as the crow flies.
const RYNEK = { lat: 51.11, lng: 17.032 };
const STATION = { lat: 51.0982, lng: 17.0366 };

describe('distanceMeters', () => {
  it('is zero from a point to itself', () => {
    expect(distanceMeters(RYNEK, RYNEK)).toBe(0);
  });

  it('measures a thousandth of a degree of latitude as ~111 m', () => {
    expect(distanceMeters({ lat: 51, lng: 17 }, { lat: 51.001, lng: 17 })).toBeCloseTo(111.2, 0);
  });

  // Meridians converge: at 51°N a degree of longitude is cos(51°) of one of latitude.
  it('shrinks east-west distances with latitude', () => {
    expect(distanceMeters({ lat: 51, lng: 17 }, { lat: 51, lng: 17.001 })).toBeCloseTo(70.0, 0);
  });

  it('is symmetric', () => {
    expect(distanceMeters(RYNEK, STATION)).toBeCloseTo(distanceMeters(STATION, RYNEK), 6);
  });

  it('puts the station 1.3–1.4 km from the Rynek', () => {
    const d = distanceMeters(RYNEK, STATION);
    expect(d).toBeGreaterThan(1300);
    expect(d).toBeLessThan(1400);
  });
});

describe('boundingBox', () => {
  it('reaches exactly the radius north, south, east and west', () => {
    const box = boundingBox(RYNEK, 1000);
    expect(distanceMeters(RYNEK, { lat: box.north, lng: RYNEK.lng })).toBeCloseTo(1000, 3);
    expect(distanceMeters(RYNEK, { lat: box.south, lng: RYNEK.lng })).toBeCloseTo(1000, 3);
    expect(distanceMeters(RYNEK, { lat: RYNEK.lat, lng: box.east })).toBeCloseTo(1000, 1);
    expect(distanceMeters(RYNEK, { lat: RYNEK.lat, lng: box.west })).toBeCloseTo(1000, 1);
  });

  it('is wider in degrees of longitude than of latitude at Polish latitudes', () => {
    const box = boundingBox(RYNEK, 5000);
    expect(box.east - box.west).toBeGreaterThan((box.north - box.south) * 1.5);
  });

  it('lets no point inside the circle fall outside the box', () => {
    const box = boundingBox(RYNEK, 2000);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      // 1999 m out along each bearing, by the small-distance approximation.
      const rad = (bearing * Math.PI) / 180;
      const point = {
        lat: RYNEK.lat + (1999 * Math.cos(rad)) / 111_195,
        lng: RYNEK.lng + (1999 * Math.sin(rad)) / (111_195 * Math.cos((RYNEK.lat * Math.PI) / 180)),
      };
      expect(point.lat).toBeGreaterThanOrEqual(box.south);
      expect(point.lat).toBeLessThanOrEqual(box.north);
      expect(point.lng).toBeGreaterThanOrEqual(box.west);
      expect(point.lng).toBeLessThanOrEqual(box.east);
    }
  });
});

describe('clampRadius', () => {
  it('keeps a radius inside the supported range', () => {
    expect(clampRadius(1500)).toBe(1500);
    expect(clampRadius(100)).toBe(MIN_RADIUS_M);
    expect(clampRadius(50_000)).toBe(MAX_RADIUS_M);
  });

  it('rounds to whole metres', () => {
    expect(clampRadius(1234.6)).toBe(1235);
  });

  it('falls back to the default for something that is not a number', () => {
    expect(clampRadius(Number.NaN)).toBe(DEFAULT_RADIUS_M);
    expect(clampRadius(Number.POSITIVE_INFINITY)).toBe(DEFAULT_RADIUS_M);
  });
});

describe('isValidLatLng', () => {
  it('accepts real coordinates and rejects the rest', () => {
    expect(isValidLatLng(51.1, 17.03)).toBe(true);
    expect(isValidLatLng(-90, 180)).toBe(true);
    expect(isValidLatLng(91, 17)).toBe(false);
    expect(isValidLatLng(51, -181)).toBe(false);
    expect(isValidLatLng(Number.NaN, 17)).toBe(false);
  });
});

describe('roundCoord', () => {
  it('rounds to the given number of decimals', () => {
    expect(roundCoord(51.107_949, 3)).toBe(51.108);
    expect(roundCoord(17.038_549, 4)).toBe(17.0385);
  });
});
