"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ID, Permission, Query, Role } from "appwrite";
import Header from "../../Header";
import UpvoteButton from "../../UpvoteButton";
import MakeItCount from "./MakeItCount";
import Moderation from "./Moderation";
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
import { autoBlurFile } from "@/lib/privacy";
import { ageText, agoText, categoryText, statusText, useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const [report, setReport] = useState<Report | null>(null);
  const [mine, setMine] = useState<Verification | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<Verdict | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [myUpvote, setMyUpvote] = useState<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = (await tablesDB.getRow({ databaseId: config.databaseId, tableId: config.reportsTableId, rowId: id })) as unknown as Report;
      setReport(r);
    } catch {
      setLoadError(t("detail.notFound"));
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

  useEffect(() => {
    if (!user) return setMyUpvote(null);
    tablesDB
      .listRows({ databaseId: config.databaseId, tableId: config.upvotesTableId, queries: [Query.equal("report_id", id), Query.equal("user_id", user.$id), Query.limit(1)] })
      .then((res) => setMyUpvote(res.rows[0]?.$id ?? null))
      .catch(() => setMyUpvote(null));
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
        throw new Error(t("verify.tooFar", { d: Math.round(dist), m: VERIFY_RADIUS_M }));
      }

      let photo_id: string | null = null;
      if (verdict === "fixed") {
        if (!photo) throw new Error(t("verify.needPhoto"));
        const file = await storage.createFile({
          bucketId: config.photosBucketId,
          fileId: ID.unique(),
          file: await autoBlurFile(await compressPhoto(photo)),
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
      setMessage(verdict === "fixed" ? t("verify.thanksFixed") : t("verify.thanksBroken"));
      // The server function updates the report a moment later
      setTimeout(load, 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loadError) return (<><Header /><p className="error">{loadError}</p><Link href="/" className="btn ghost">{t("common.allIssues")}</Link></>);
  if (!report) return (<><Header /><p className="meta">{t("common.loading")}</p></>);

  const [lng, lat] = report.location;
  const label = categoryText(t, report.category);
  const fixedVotes = report.fixed_votes ?? 0;
  const brokenVotes = report.broken_votes ?? 0;

  return (
    <>
      <Header />
      <Link href="/" className="meta back">{t("common.allIssues")}</Link>

      <article className="card" style={{ marginTop: 10 }}>
        <div className={report.fixed_photo_id ? "before-after" : ""}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(report.photo_id)} alt={`${label}, as reported`} />
            {report.fixed_photo_id && <figcaption>{t("detail.before")}</figcaption>}
          </figure>
          {report.fixed_photo_id && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(report.fixed_photo_id)} alt={`${label}, after the fix`} />
              <figcaption>{t("detail.after")}</figcaption>
            </figure>
          )}
        </div>
        <div className="body">
          <div className="row">
            <h1 style={{ fontSize: "1.3rem", margin: 0 }}>{label}</h1>
            <span className={`pill ${report.status}`}>{statusText(t, report.status)}</span>
          </div>
          <p className={`age ${report.status}`}>{ageText(t, report)}</p>
          {report.note && <p style={{ margin: "6px 0" }}>{report.note}</p>}
          <div className="row meta">
            <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
            </a>
            <span>{t("detail.reported", { when: agoText(t, report.captured_at) })}</span>
          </div>
          <div className="row meta" style={{ marginTop: 6 }}>
            <span>{t("detail.votes", { fixed: fixedVotes, broken: brokenVotes })}</span>
            {report.reporter_rating ? <span>{t("detail.rated")} <Stars value={report.reporter_rating} /></span> : null}
          </div>
          {myUpvote !== undefined && (
            <UpvoteButton reportId={report.$id} count={report.upvote_count} userId={user?.$id ?? null} reporterId={report.reporter_id} myUpvoteId={myUpvote} />
          )}
        </div>
      </article>

      {report.hidden && (
        <p className="notice">{t("detail.hidden")}</p>
      )}

      {!report.hidden && report.status !== "fixed" && <MakeItCount report={report} userId={user?.$id ?? null} />}

      {!report.hidden && <section className="card verify">
        <div className="body">
          <h2>{t("verify.title")}</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            {t("verify.mustBeThere", { m: VERIFY_RADIUS_M })} {report.status === "fixed"
              ? t("verify.reopenHint")
              : isReporter
                ? t("verify.reporterHint")
                : t("verify.quorumHint")}
          </p>

          {!user ? (
            <Link href="/login" className="btn block">{t("verify.login")}</Link>
          ) : (
            <>
              {mine && <p className="meta">{t("verify.youSaid")} <strong>{mine.verdict === "fixed" ? t("verify.fixedShort") : t("verify.broken")}</strong>. {t("verify.canChange")}</p>}

              {isReporter && (
                <div style={{ margin: "10px 0" }}>
                  <span className="meta">{t("verify.rateQuestion")} </span>
                  <Stars value={rating} onChange={setRating} />
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) submit("fixed", f); }} />
              <div className="verify-actions">
                <button className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                  {busy === "fixed" ? t("common.saving") : t("verify.fixed")}
                </button>
                <button className="btn ghost" disabled={!!busy} onClick={() => submit("still_broken")}>
                  {busy === "still_broken" ? t("common.saving") : t("verify.broken")}
                </button>
              </div>
              <p className="hint">{t("verify.cameraHint")}</p>
            </>
          )}
          {message && <p className="ok">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>}

      <Moderation report={report} userId={user?.$id ?? null} />
    </>
  );
}
