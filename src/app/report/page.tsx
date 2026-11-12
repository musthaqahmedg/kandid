"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ID, Permission, Role } from "appwrite";
import Header from "../Header";
import { CATEGORIES, compressPhoto, config, storage, tablesDB, type Category } from "@/lib/appwrite";
import { canvasToFile, detectPrivateAreas, preloadPrivacyModels, renderBlurred, type Region } from "@/lib/privacy";
import { useUser } from "@/lib/useUser";
import { categoryText, useI18n } from "@/lib/i18n";

type Coords = { lat: number; lng: number; accuracy: number };
type Pin = { lat: number; lng: number };

const BlurEditor = dynamic(() => import("./BlurEditor"), { ssr: false });

const PinPicker = dynamic(() => import("./PinPicker"), {
  ssr: false,
  loading: () => <div className="pin-map map-loading">Loading map…</div>,
});

export default function ReportPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { t } = useI18n();
  const [photo, setPhoto] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [autoRegions, setAutoRegions] = useState<Region[]>([]);
  const [manualRegions, setManualRegions] = useState<Region[]>([]);
  const [scan, setScan] = useState<"idle" | "scanning" | "done" | "failed">("idle");
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinMoved, setPinMoved] = useState(false);
  const [pinWarning, setPinWarning] = useState("");
  const [category, setCategory] = useState<Category>("road");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function locate() {
    setLocError("");
    if (!("geolocation" in navigator)) return setLocError(t("report.noGeo"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setCoords(c);
        setPin({ lat: c.lat, lng: c.lng });
        setPinMoved(false);
        setPinWarning("");
      },
      () => setLocError(t("report.needLocation")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Start downloading the privacy models as soon as the page opens
  useEffect(() => { preloadPrivacyModels(); }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setError("");
    setCapturedAt(new Date().toISOString());
    locate(); // pin location at the moment of capture
    const file = await compressPhoto(raw);
    if (file.size > 5 * 1024 * 1024) return setError(t("report.tooBig"));
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return setError(t("report.unreadable"));
    bitmap?.close();
    setPhoto(file);
    setBitmap(bmp);
    setAutoRegions([]);
    setManualRegions([]);
    setScan("scanning");
    const { regions, ok } = await detectPrivateAreas(bmp);
    setAutoRegions(regions);
    setScan(ok ? "done" : "failed");
  }

  useEffect(() => () => bitmap?.close(), [bitmap]);

  /** The photo that actually gets uploaded: faces and tapped spots pixelated. The original never leaves the phone. */
  async function blurredUpload(): Promise<File> {
    const regions = [...autoRegions, ...manualRegions];
    if (!bitmap || regions.length === 0) return photo!;
    const canvas = document.createElement("canvas");
    renderBlurred(canvas, bitmap, regions);
    return canvasToFile(canvas);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !photo || !coords || !pin || !capturedAt) return;
    setBusy(true); setError("");
    try {
      const file = await storage.createFile({
        bucketId: config.photosBucketId,
        fileId: ID.unique(),
        file: await blurredUpload(),
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(user.$id))],
      });
      const row = await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.reportsTableId,
        rowId: ID.unique(),
        data: {
          photo_id: file.$id,
          category,
          note: note.trim() || null,
          location: [pin.lng, pin.lat], // Appwrite points are [longitude, latitude]
          gps_accuracy: Math.round(coords.accuracy),
          pin_adjusted: pinMoved,
          reporter_id: user.$id,
          captured_at: capturedAt,
        },
        // No update permission: status and counts are only changed by the kandid-sync function
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(user.$id))],
      });
      router.push("/r/" + row.$id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return (<><Header /><p className="meta">{t("common.loading")}</p></>);

  if (!user)
    return (
      <>
        <Header />
        <h1>{t("report.title")}</h1>
        <p>{t("report.loginFirst")}</p>
        <Link href="/login" className="btn">{t("nav.login")}</Link>
      </>
    );

  return (
    <>
      <Header />
      <h1>{t("report.title")}</h1>
      <form onSubmit={submit}>
        <label htmlFor="photo">{t("report.step1")}</label>
        <input id="photo" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
        <p className="hint">{t("report.step1Hint")}</p>
        {bitmap && (
          <>
            <BlurEditor source={bitmap} regions={[...autoRegions, ...manualRegions]} onAdd={(r) => setManualRegions((m) => [...m, r])} />
            <p className="hint">
              {scan === "scanning" && t("report.blurScanning")}
              {scan === "done" && (autoRegions.length > 0 ? t("report.blurFound", { n: autoRegions.length }) : t("report.blurNone"))}
              {scan === "failed" && t("report.blurFailed")}
              {scan !== "scanning" && " " + t("report.blurTap")}
            </p>
            {manualRegions.length > 0 && (
              <div className="blur-actions">
                <button type="button" className="btn ghost" onClick={() => setManualRegions((m) => m.slice(0, -1))}>{t("report.undo")}</button>
                <button type="button" className="btn ghost" onClick={() => setManualRegions([])}>{t("report.clearBlurs")}</button>
              </div>
            )}
          </>
        )}

        <div className="hint" style={{ marginTop: 10 }}>
          {!coords && photo && !locError ? t("report.gettingLocation") : null}
        </div>
        {coords && pin && (
          <>
            <label>{t("report.pinQuestion")}</label>
            <PinPicker
              gps={coords}
              pin={pin}
              onChange={(p, tooFar) => {
                setPin(p);
                if (tooFar) {
                  setPinWarning(t("report.pinTooFar"));
                } else {
                  setPinWarning("");
                  setPinMoved(true);
                }
              }}
            />
            <p className="hint">
              {pinMoved ? t("report.pinMoved") : t("report.pinLive")} {t("report.pinHint")}
              {coords.accuracy > 50 && " " + t("report.gpsRough", { n: Math.round(coords.accuracy) })}
            </p>
            {pinWarning && <p className="error">{pinWarning}</p>}
          </>
        )}
        {locError && (
          <p className="error">
            {locError} <button type="button" className="btn ghost" onClick={locate}>{t("report.retry")}</button>
          </p>
        )}

        <label htmlFor="category">{t("report.step2")}</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{categoryText(t, c.value)}</option>)}
        </select>

        <label htmlFor="note">{t("report.step3")}</label>
        <textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("report.notePlaceholder")} />

        <button className="btn block" style={{ marginTop: 20 }} disabled={busy || !photo || !coords || !pin || scan === "scanning"}>
          {busy ? t("report.posting") : t("report.post")}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
