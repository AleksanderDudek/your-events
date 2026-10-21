// Distances on the ground, for the "near a point" filter. Pure functions — no
// Leaflet, no DOM — so the rule that decides what counts as "within 1 km" can
// be tested exactly.

/** A point, in WGS84 degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** The edges of a latitude/longitude rectangle, in degrees. */
export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

// Mean Earth radius (IUGG). Treating the Earth as a sphere is off by at most
// ~0.5% against the ellipsoid: under 25 m at the 5 km limit, far below what a
// walking-distance filter can notice.
const EARTH_RADIUS_M = 6_371_008.8;

/** The radius a proximity filter may take, in metres. */
export const MIN_RADIUS_M = 500;
export const MAX_RADIUS_M = 5000;
export const RADIUS_STEP_M = 500;
export const DEFAULT_RADIUS_M = 1000;

/**
 * How far from a city centre still counts as "in or around" the city: the area
 * address suggestions are confined to, and past which a chosen point is called
 * out as far away.
 */
export const CITY_AREA_RADIUS_M = 25_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  // min(1, …) keeps a rounding error from pushing asin past its domain for
  // antipodal points.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The smallest latitude/longitude rectangle holding every point within
 * `radiusM` of `center` — a pre-filter cheap enough for plain column
 * comparisons in the database, with the exact circle applied afterwards.
 *
 * The east-west half-width depends on latitude because meridians converge
 * towards the poles: at 51°N a degree of longitude is ~70 km, not ~111 km. Not
 * meant for boxes spanning a pole or the antimeridian, which no Polish city
 * comes near.
 */
export function boundingBox(center: LatLng, radiusM: number): BoundingBox {
  const angular = radiusM / EARTH_RADIUS_M;
  const dLat = toDeg(angular);
  const dLng = toDeg(Math.asin(Math.min(1, Math.sin(angular) / Math.cos(toRad(center.lat)))));
  return {
    south: center.lat - dLat,
    west: center.lng - dLng,
    north: center.lat + dLat,
    east: center.lng + dLng,
  };
}

/** A radius the filter supports: whole metres, within the allowed range. */
export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(value)));
}

/** True for a finite latitude/longitude pair inside the valid ranges. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/** Round a coordinate to `decimals` places: 3 ≈ 110 m, 4 ≈ 11 m. */
export function roundCoord(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
