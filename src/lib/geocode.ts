"use client";

/**
 * Turn a GPS point into a readable place name using OpenStreetMap's Nominatim
 * (free; fine for low volume — one call per new report). Never throws.
 */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return shortAddress(data?.address ?? {});
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** "Road, Area, Town, District" — the most useful parts, de-duplicated, max 255 chars. */
export function shortAddress(a: Record<string, string>): string | null {
  const parts = [
    a.road ?? a.pedestrian ?? a.footway,
    a.neighbourhood ?? a.suburb ?? a.quarter ?? a.hamlet,
    a.village ?? a.town ?? a.city ?? a.municipality,
    a.state_district ?? a.county,
  ].filter(Boolean) as string[];
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(", ").slice(0, 255) : null;
}
