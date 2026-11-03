"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ageLabel, categoryLabel, photoUrl, timeAgo, type Report } from "@/lib/appwrite";

// Kerala, shown when there are no reports yet
const DEFAULT_CENTER: L.LatLngTuple = [10.5, 76.3];
const DEFAULT_ZOOM = 8;

const STATUS_COLOR: Record<Report["status"], string> = {
  open: "#b91c1c",
  acknowledged: "#b45309",
  fixed: "#15803d",
};

function pinIcon(status: Report["status"]) {
  return L.divIcon({
    className: "kandid-pin",
    html: `<span style="background:${STATUS_COLOR[status]}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

// Built with DOM nodes + textContent so user-written notes can never inject HTML.
function popupContent(r: Report) {
  const el = document.createElement("div");
  el.className = "kandid-popup";

  const img = document.createElement("img");
  img.src = photoUrl(r.photo_id);
  img.alt = categoryLabel(r.category);
  img.loading = "lazy";
  el.appendChild(img);

  const title = document.createElement("strong");
  title.textContent = categoryLabel(r.category);
  el.appendChild(title);

  const status = document.createElement("span");
  status.className = `pill ${r.status}`;
  status.textContent = r.status;
  el.appendChild(status);

  if (r.note) {
    const note = document.createElement("p");
    note.textContent = r.note;
    el.appendChild(note);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${ageLabel(r)} · ${timeAgo(r.captured_at)} · 👍 ${r.upvote_count}`;
  el.appendChild(meta);

  const link = document.createElement("a");
  link.href = `/r/${encodeURIComponent(r.$id)}`;
  link.className = "more";
  link.textContent = "Details & “Is it fixed?” →";
  el.appendChild(link);

  return el;
}

export default function ReportsMap({ reports }: { reports: Report[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw pins whenever reports change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points: L.LatLngTuple[] = [];
    for (const r of reports) {
      const [lng, lat] = r.location; // stored as [longitude, latitude]
      points.push([lat, lng]);
      L.marker([lat, lng], { icon: pinIcon(r.status), title: categoryLabel(r.category) })
        .bindPopup(() => popupContent(r), { maxWidth: 240, minWidth: 200 })
        .addTo(layer);
    }
    if (points.length === 1) map.setView(points[0], 16);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
  }, [reports]);

  function nearMe() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" role="application" aria-label="Map of reported issues" />
      <div className="map-bar">
        <div className="map-legend">
          <span><i style={{ background: STATUS_COLOR.open }} />Open</span>
          <span><i style={{ background: STATUS_COLOR.acknowledged }} />Acknowledged</span>
          <span><i style={{ background: STATUS_COLOR.fixed }} />Fixed</span>
        </div>
        <button type="button" className="btn ghost map-locate" onClick={nearMe}>📍 Near me</button>
      </div>
    </div>
  );
}
