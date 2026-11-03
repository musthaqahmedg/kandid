"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Query } from "appwrite";
import Header from "./Header";
import { ageLabel, categoryLabel, config, photoUrl, tablesDB, timeAgo, type Report } from "@/lib/appwrite";

// Leaflet needs the browser (window), so load the map on the client only
const ReportsMap = dynamic(() => import("./ReportsMap"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

type View = "list" | "map";

export default function Home() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");

  // Remember the last chosen view on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kandid:view");
      if (saved === "map" || saved === "list") setView(saved);
    } catch {}
  }, []);

  function choose(v: View) {
    setView(v);
    try { localStorage.setItem("kandid:view", v); } catch {}
  }

  useEffect(() => {
    tablesDB
      .listRows({
        databaseId: config.databaseId,
        tableId: config.reportsTableId,
        queries: [Query.orderDesc("$createdAt"), Query.limit(100)],
      })
      .then((res) => setReports(res.rows as unknown as Report[]))
      .catch((e) => setError(e.message ?? "Could not load reports"));
  }, []);

  return (
    <>
      <Header />
      <h1 style={{ margin: "0 0 4px" }}>Issues near you</h1>
      <p className="meta" style={{ marginTop: 0 }}>Seen something broken? Snap it, pin it, make it count.</p>

      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => choose("list")}>☰ List</button>
        <button role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => choose("map")}>🗺 Map</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!reports && !error && <p className="meta">Loading…</p>}

      {reports && view === "map" && <ReportsMap reports={reports} />}

      {reports && view === "list" && reports.length === 0 && (
        <div className="empty">No reports yet. Be the first to report an issue.</div>
      )}

      {reports && view === "list" && reports.map((r) => {
        const [lng, lat] = r.location;
        const label = categoryLabel(r.category);
        return (
          <article key={r.$id} className="card">
            <Link href={`/r/${r.$id}`} aria-label={`${label}: open details`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(r.fixed_photo_id ?? r.photo_id)} alt={label} loading="lazy" />
            </Link>
            <div className="body">
              <div className="row">
                <strong>{label}</strong>
                <span className={`pill ${r.status}`}>{r.status}</span>
              </div>
              <p className={`age ${r.status}`}>{ageLabel(r)}</p>
              {r.note && <p style={{ margin: "6px 0" }}>{r.note}</p>}
              <div className="row meta">
                <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
                  📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                </a>
                <span>{timeAgo(r.captured_at)} · 👍 {r.upvote_count}</span>
              </div>
              <Link href={`/r/${r.$id}`} className="more">Details & “Is it fixed?” →</Link>
            </div>
          </article>
        );
      })}

      <Link href="/report" className="btn fab">📷 Report an issue</Link>
    </>
  );
}
