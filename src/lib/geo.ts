import { AREA_LIST } from "@/content/areas";

const EARTH_RADIUS_KM = 6371;

/** Maximum distance from an area's coordinates for a GPS point to be considered "in" that area. */
const MAX_MATCH_DISTANCE_KM = 10;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points in kilometers (Haversine). */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Map a GPS coordinate to the nearest known service area slug.
 *
 * Returns the slug of the closest area in AREA_LIST that has coordinates, but only
 * when that area is within MAX_MATCH_DISTANCE_KM (10 km). Returns null when the point
 * is outside the valley / not near any mapped area, or when inputs are not finite.
 *
 * Pure and unit-testable — no I/O.
 */
export function nearestAreaSlug(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let bestSlug: string | null = null;
  let bestDistance = Infinity;

  for (const area of AREA_LIST) {
    if (!area.coordinates) continue;
    const distance = haversineDistanceKm(
      lat,
      lng,
      area.coordinates.lat,
      area.coordinates.lng,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSlug = area.slug;
    }
  }

  return bestDistance <= MAX_MATCH_DISTANCE_KM ? bestSlug : null;
}
