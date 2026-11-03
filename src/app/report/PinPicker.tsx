"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const MAX_ADJUST_METRES = 200;

type Props = {
  gps: { lat: number; lng: number; accuracy: number };
  pin: { lat: number; lng: number };
  onChange: (pin: { lat: number; lng: number }, tooFar: boolean) => void;
};

/**
 * Small map with a draggable pin. The pin starts at the live GPS fix and can be
 * nudged to the exact spot, but never more than MAX_ADJUST_METRES away — so a
 * report always comes from someone who was actually there.
 */
export default function PinPicker({ gps, pin, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const center: L.LatLngTuple = [gps.lat, gps.lng];
    const map = L.map(ref.current, { zoomControl: true }).setView(center, 18);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Allowed area
    L.circle(center, { radius: MAX_ADJUST_METRES, color: "#c2410c", weight: 1, fillOpacity: 0.06, interactive: false }).addTo(map);
    // Where the phone says you are
    L.circleMarker(center, { radius: 6, color: "#2563eb", fillColor: "#2563eb", fillOpacity: 1, weight: 2, interactive: false }).addTo(map);

    const marker = L.marker([pin.lat, pin.lng], {
      draggable: true,
      autoPan: true,
      icon: L.divIcon({ className: "kandid-pin", html: '<span style="background:#b91c1c"></span>', iconSize: [26, 26], iconAnchor: [13, 26] }),
    }).addTo(map);

    let lastValid = L.latLng(pin.lat, pin.lng);
    function place(latlng: L.LatLng) {
      if (map.distance(center, latlng) > MAX_ADJUST_METRES) {
        marker.setLatLng(lastValid); // snap back to the last allowed spot
        onChangeRef.current({ lat: lastValid.lat, lng: lastValid.lng }, true);
        return;
      }
      lastValid = latlng;
      marker.setLatLng(latlng);
      onChangeRef.current({ lat: latlng.lat, lng: latlng.lng }, false);
    }

    marker.on("dragend", () => place(marker.getLatLng()));
    map.on("click", (e: L.LeafletMouseEvent) => place(e.latlng));

    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Recreate only when a new GPS fix arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.lat, gps.lng]);

  return <div ref={ref} className="pin-map" aria-label="Drag the pin to the exact spot" />;
}
