"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Query } from "appwrite";
import Header from "./Header";
import { CATEGORIES, config, photoUrl, tablesDB, type Report } from "@/lib/appwrite";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function Home() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    tablesDB
      .listRows({
        databaseId: config.databaseId,
        tableId: config.reportsTableId,
        queries: [Query.orderDesc("$createdAt"), Query.limit(50)],
      })
      .then((res) => setReports(res.rows as unknown as Report[]))
      .catch((e) => setError(e.message ?? "Could not load reports"));
  }, []);

  return (
    <>
      <Header />
      <h1 style={{ margin: "0 0 4px" }}>Issues near you</h1>
      <p className="meta" style={{ marginTop: 0 }}>Seen something broken? Snap it, pin it, make it count.</p>

      {error && <p className="error">{error}</p>}
      {!reports && !error && <p className="meta">Loading…</p>}
      {reports?.length === 0 && (
        <div className="empty">No reports yet. Be the first to report an issue.</div>
      )}

      {reports?.map((r) => {
        const [lng, lat] = r.location;
        const label = CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category;
        return (
          <article key={r.$id} className="card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(r.photo_id)} alt={label} loading="lazy" />
            <div className="body">
              <div className="row">
                <strong>{label}</strong>
                <span className={`pill ${r.status}`}>{r.status}</span>
              </div>
              {r.note && <p style={{ margin: "6px 0" }}>{r.note}</p>}
              <div className="row meta">
                <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
                  📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                </a>
                <span>{timeAgo(r.captured_at)} · 👍 {r.upvote_count}</span>
              </div>
            </div>
          </article>
        );
      })}

      <Link href="/report" className="btn fab">📷 Report an issue</Link>
    </>
  );
}
