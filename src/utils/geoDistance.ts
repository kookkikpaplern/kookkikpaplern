export const MAX_DELIVERY_RADIUS_KM = 3;
export const MAX_DELIVERY_RADIUS_METERS = MAX_DELIVERY_RADIUS_KM * 1000;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ShopLocationConfig {
  lat: number;
  lng: number;
  label?: string;
  updatedAt?: string;
}

export function isValidLatLng(point?: Partial<GeoPoint> | null): point is GeoPoint {
  if (!point || typeof point !== 'object') return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Computes straight-line distance in meters on Earth's sphere (Haversine formula).
 * Used as an immediate/fallback distance check alongside google.maps.geometry.spherical.
 */
export function computeHaversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function formatDistanceKm(meters: number, lang: 'th' | 'en' = 'th'): string {
  if (!Number.isFinite(meters) || meters < 0) return lang === 'en' ? '0.00 km' : '0.00 กม.';
  if (meters < 1000) {
    const roundedMeters = Math.round(meters);
    const kmStr = (meters / 1000).toFixed(2);
    return lang === 'en'
      ? `${roundedMeters} m (${kmStr} km)`
      : `${roundedMeters.toLocaleString('th-TH')} ม. (${kmStr} กม.)`;
  }
  const km = (meters / 1000).toFixed(2);
  return lang === 'en' ? `${km} km` : `${km} กม.`;
}

export function buildGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`;
}

export function parseShopLocationJson(raw?: string | null): ShopLocationConfig | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const rawObj = JSON.parse(raw) as Partial<ShopLocationConfig>;
    if (!isValidLatLng(rawObj)) return null;
    const rawMeta = rawObj as Partial<ShopLocationConfig>;
    return {
      lat: Number(Number(rawObj.lat).toFixed(6)),
      lng: Number(Number(rawObj.lng).toFixed(6)),
      ...(typeof rawMeta.label === 'string' && rawMeta.label.trim()
        ? { label: rawMeta.label.trim().slice(0, 120) }
        : {}),
      ...(typeof rawMeta.updatedAt === 'string' && rawMeta.updatedAt.trim()
        ? { updatedAt: rawMeta.updatedAt.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}
