"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Query } from "appwrite";
import Header from "./Header";
import UpvoteButton from "./UpvoteButton";
import { useUser } from "@/lib/useUser";
import { ageText, agoText, categoryText, statusText, useI18n } from "@/lib/i18n";
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
  const { user } = useUser();
  const { t } = useI18n();
  const [myUpvotes, setMyUpvotes] = useState<Record<string, string> | null>(null);

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
        queries: [Query.equal("hidden", false), Query.orderDesc("$createdAt"), Query.limit(100)],
      })
      .then((res) => setReports(res.rows as unknown as Report[]))
      .catch((e) => setError(e.message ?? t("home.loadError")));
  }, []);

  // One query for all of this user's upvotes on the loaded reports
  useEffect(() => {
    if (!user || !reports) return setMyUpvotes(user ? null : {});
    if (reports.length === 0) return setMyUpvotes({});
    tablesDB
      .listRows({
        databaseId: config.databaseId,
        tableId: config.upvotesTableId,
        queries: [Query.equal("user_id", user.$id), Query.equal("report_id", reports.map((r) => r.$id)), Query.limit(100)],
      })
      .then((res) => setMyUpvotes(Object.fromEntries(res.rows.map((u) => [(u as unknown as { report_id: string }).report_id, u.$id]))))
      .catch(() => setMyUpvotes({}));
  }, [user, reports]);

  return (
    <>
      <Header />
      <h1 style={{ margin: "0 0 4px" }}>{t("home.title")}</h1>
      <p className="meta" style={{ marginTop: 0 }}>{t("home.tagline")}</p>

      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => choose("list")}>{t("home.list")}</button>
        <button role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => choose("map")}>{t("home.map")}</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!reports && !error && <p className="meta">Loading…</p>}

      {reports && view === "map" && <ReportsMap reports={reports} t={t} />}

      {reports && view === "list" && reports.length === 0 && (
        <div className="empty">{t("home.empty")}</div>
      )}

      {reports && view === "list" && reports.map((r) => {
        const [lng, lat] = r.location;
        const label = categoryText(t, r.category);
        return (
          <article key={r.$id} className="card">
            <Link href={`/r/${r.$id}`} aria-label={`${label}: open details`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(r.fixed_photo_id ?? r.photo_id)} alt={label} loading="lazy" />
            </Link>
            <div className="body">
              <div className="row">
                <strong>{label}</strong>
                <span className={`pill ${r.status}`}>{statusText(t, r.status)}</span>
              </div>
              <p className={`age ${r.status}`}>{ageText(t, r)}</p>
              {r.note && <p style={{ margin: "6px 0" }}>{r.note}</p>}
              <div className="row meta">
                <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
                  📍 {r.address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                </a>
                <span>{agoText(t, r.captured_at)}</span>
              </div>
              {myUpvotes && (
                <UpvoteButton reportId={r.$id} count={r.upvote_count} userId={user?.$id ?? null} reporterId={r.reporter_id} myUpvoteId={myUpvotes[r.$id] ?? null} />
              )}
              <Link href={`/r/${r.$id}`} className="more">{t("home.details")}</Link>
            </div>
          </article>
        );
      })}

      <Link href="/report" className="btn fab">{t("home.report")}</Link>
    </>
  );
}
