"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ID, Permission, Query, Role } from "appwrite";
import Header from "../../Header";
import {
  VERIFY_RADIUS_M,
  ageLabel,
  categoryLabel,
  compressPhoto,
  config,
  distanceMetres,
  photoUrl,
  storage,
  tablesDB,
  timeAgo,
  type Report,
  type Verification,
} from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";

type Verdict = Verification["verdict"];

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This device can't share location."));
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location is needed. Allow location access and try again.")), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="stars" role={onChange ? "radiogroup" : undefined} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className={n <= value ? "on" : ""}>★</button>
        ) : (
          <span key={n} className={n <= value ? "on" : ""}>★</span>
        )
      )}
    </span>
  );
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [report, setReport] = useState<Report | null>(null);
  const [mine, setMine] = useState<Verification | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<Verdict | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = (await tablesDB.getRow({ databaseId: config.databaseId, tableId: config.reportsTableId, rowId: id })) as unknown as Report;
      setReport(r);
    } catch {
      setLoadError("This report doesn't exist or was deleted.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return setMine(null);
    tablesDB
      .listRows({
        databaseId: config.databaseId,
        tableId: config.verificationsTableId,
        queries: [Query.equal("report_id", id), Query.equal("user_id", user.$id), Query.limit(1)],
      })
      .then((res) => {
        const v = (res.rows[0] as unknown as Verification) ?? null;
        setMine(v);
        if (v?.rating) setRating(v.rating);
      })
      .catch(() => {});
  }, [id, user]);

  const isReporter = !!user && !!report && user.$id === report.reporter_id;

  async function submit(verdict: Verdict, photo?: File) {
    if (!user || !report) return;
    setBusy(verdict); setError(""); setMessage("");
    try {
      const pos = await getPosition();
      const here: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      const dist = distanceMetres(here, report.location);
      if (dist > VERIFY_RADIUS_M) {
        throw new Error(`You need to be at the spot to confirm this. You're about ${Math.round(dist)} m away (must be within ${VERIFY_RADIUS_M} m).`);
      }

      let photo_id: string | null = null;
      if (verdict === "fixed") {
        if (!photo) throw new Error("Take an after photo to show it's fixed.");
        const file = await storage.createFile({
          bucketId: config.photosBucketId,
          fileId: ID.unique(),
          file: await compressPhoto(photo),
          permissions: [Permission.read(Role.any()), Permission.delete(Role.user(user.$id))],
        });
        photo_id = file.$id;
      }

      const data = {
        report_id: report.$id,
        user_id: user.$id,
        verdict,
        photo_id,
        location: here,
        rating: verdict === "fixed" && isReporter && rating ? rating : null,
      };

      const saved = mine
        ? await tablesDB.updateRow({ databaseId: config.databaseId, tableId: config.verificationsTableId, rowId: mine.$id, data })
        : await tablesDB.createRow({
            databaseId: config.databaseId,
            tableId: config.verificationsTableId,
            rowId: ID.unique(),
            data,
            permissions: [Permission.read(Role.any()), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))],
          });
      setMine(saved as unknown as Verification);
      setMessage(verdict === "fixed" ? "Thanks! Your confirmation is counted." : "Thanks! Marked as still broken.");
      // The server function updates the report a moment later
      setTimeout(load, 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loadError) return (<><Header /><p className="error">{loadError}</p><Link href="/" className="btn ghost">← All issues</Link></>);
  if (!report) return (<><Header /><p className="meta">Loading…</p></>);

  const [lng, lat] = report.location;
  const label = categoryLabel(report.category);
  const fixedVotes = report.fixed_votes ?? 0;
  const brokenVotes = report.broken_votes ?? 0;

  return (
    <>
      <Header />
      <Link href="/" className="meta back">← All issues</Link>

      <article className="card" style={{ marginTop: 10 }}>
        <div className={report.fixed_photo_id ? "before-after" : ""}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(report.photo_id)} alt={`${label}, as reported`} />
            {report.fixed_photo_id && <figcaption>Before</figcaption>}
          </figure>
          {report.fixed_photo_id && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(report.fixed_photo_id)} alt={`${label}, after the fix`} />
              <figcaption>After</figcaption>
            </figure>
          )}
        </div>
        <div className="body">
          <div className="row">
            <h1 style={{ fontSize: "1.3rem", margin: 0 }}>{label}</h1>
            <span className={`pill ${report.status}`}>{report.status}</span>
          </div>
          <p className={`age ${report.status}`}>{ageLabel(report)}</p>
          {report.note && <p style={{ margin: "6px 0" }}>{report.note}</p>}
          <div className="row meta">
            <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
            </a>
            <span>Reported {timeAgo(report.captured_at)}</span>
          </div>
          <div className="row meta" style={{ marginTop: 6 }}>
            <span>👍 {report.upvote_count} · ✅ {fixedVotes} fixed · ❌ {brokenVotes} still broken</span>
            {report.reporter_rating ? <span>Fix rated <Stars value={report.reporter_rating} /></span> : null}
          </div>
        </div>
      </article>

      <section className="card verify">
        <div className="body">
          <h2>Is it fixed?</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            You need to be at the spot (within {VERIFY_RADIUS_M} m). {report.status === "fixed"
              ? "If it's broken again, say so and it will reopen."
              : isReporter
                ? "As the reporter, your confirmation closes it."
                : "It closes when the reporter or 3 people confirm with an after photo."}
          </p>

          {!user ? (
            <Link href="/login" className="btn block">Log in to confirm</Link>
          ) : (
            <>
              {mine && <p className="meta">You said: <strong>{mine.verdict === "fixed" ? "✅ Fixed" : "❌ Still broken"}</strong>. You can change it.</p>}

              {isReporter && (
                <div style={{ margin: "10px 0" }}>
                  <span className="meta">How well was it fixed? (optional) </span>
                  <Stars value={rating} onChange={setRating} />
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) submit("fixed", f); }} />
              <div className="verify-actions">
                <button className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                  {busy === "fixed" ? "Saving…" : "📷 It's fixed"}
                </button>
                <button className="btn ghost" disabled={!!busy} onClick={() => submit("still_broken")}>
                  {busy === "still_broken" ? "Saving…" : "❌ Still broken"}
                </button>
              </div>
              <p className="hint">&quot;It&apos;s fixed&quot; opens your camera for an after photo.</p>
            </>
          )}
          {message && <p className="ok">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    </>
  );
}
