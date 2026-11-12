"use client";

/**
 * Finds the Kerala assembly constituency for a point, using DataMeet's open
 * boundaries (CC BY 2.5 India) shipped in /public/data. Runs on the device.
 */

export type Constituency = { ac_no: number; ac: string; pc: string };
type Ring = [number, number][];
type Feature = { properties: Constituency; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] } };

let data: Promise<Feature[]> | null = null;

function load() {
  if (!data) {
    data = fetch("/data/kerala-ac.geojson")
      .then((r) => r.json())
      .then((fc) => fc.features as Feature[])
      .catch(() => { data = null; return []; });
  }
  return data;
}

/** Ray-casting point-in-ring test. Points are [lng, lat]. */
export function inRing([x, y]: [number, number], ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygon(pt: [number, number], rings: Ring[]) {
  if (!inRing(pt, rings[0])) return false; // outer ring
  return !rings.slice(1).some((hole) => inRing(pt, hole));
}

export function findIn(features: Feature[], lng: number, lat: number): Constituency | null {
  const pt: [number, number] = [lng, lat];
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates as Ring[]] : (g.coordinates as Ring[][]);
    if (polys.some((rings) => inPolygon(pt, rings))) return f.properties;
  }
  return null;
}

export async function findConstituency(lat: number, lng: number) {
  return findIn(await load(), lng, lat);
}
