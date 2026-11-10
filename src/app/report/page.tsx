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
    if (!("geolocation" in navigator)) return setLocError("This device can't share location.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setCoords(c);
        setPin({ lat: c.lat, lng: c.lng });
        setPinMoved(false);
        setPinWarning("");
      },
      () => setLocError("Location is needed. Allow location access and try again."),
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
    if (file.size > 5 * 1024 * 1024) return setError("Photo is over 5 MB. Try again.");
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return setError("Couldn't read that photo. Try again.");
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

  if (loading) return (<><Header /><p className="meta">Loading…</p></>);

  if (!user)
    return (
      <>
        <Header />
        <h1>Report an issue</h1>
        <p>Please log in first so your report counts.</p>
        <Link href="/login" className="btn">Log in</Link>
      </>
    );

  return (
    <>
      <Header />
      <h1>Report an issue</h1>
      <form onSubmit={submit}>
        <label htmlFor="photo">1. Take a photo</label>
        <input id="photo" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
        <p className="hint">Opens your camera. Location and time are added automatically.</p>
        {bitmap && (
          <>
            <BlurEditor source={bitmap} regions={[...autoRegions, ...manualRegions]} onAdd={(r) => setManualRegions((m) => [...m, r])} />
            <p className="hint">
              {scan === "scanning" && "🔒 Checking for faces…"}
              {scan === "done" && (autoRegions.length > 0
                ? `🔒 ${autoRegions.length} face${autoRegions.length > 1 ? "s" : ""} blurred automatically. `
                : "🔒 No faces found. ")}
              {scan === "failed" && "🔒 Auto-blur isn't available right now. "}
              {scan !== "scanning" && "Tap the photo to blur anything else, like a number plate."}
            </p>
            {manualRegions.length > 0 && (
              <div className="blur-actions">
                <button type="button" className="btn ghost" onClick={() => setManualRegions((m) => m.slice(0, -1))}>↶ Undo</button>
                <button type="button" className="btn ghost" onClick={() => setManualRegions([])}>Clear my blurs</button>
              </div>
            )}
          </>
        )}

        <div className="hint" style={{ marginTop: 10 }}>
          {!coords && photo && !locError ? "📍 Getting your location…" : null}
        </div>
        {coords && pin && (
          <>
            <label>Is the pin on the exact spot?</label>
            <PinPicker
              gps={coords}
              pin={pin}
              onChange={(p, tooFar) => {
                setPin(p);
                if (tooFar) {
                  setPinWarning("The pin can only move 200 m from where you are, so reports always come from people who were there.");
                } else {
                  setPinWarning("");
                  setPinMoved(true);
                }
              }}
            />
            <p className="hint">
              {pinMoved ? "📍 Pin moved to the exact spot. " : "📍 Pinned at your live location. "}
              Drag the red pin or tap the map to adjust (within 200 m).
              {coords.accuracy > 50 && ` GPS is rough right now (±${Math.round(coords.accuracy)} m), so check the pin.`}
            </p>
            {pinWarning && <p className="error">{pinWarning}</p>}
          </>
        )}
        {locError && (
          <p className="error">
            {locError} <button type="button" className="btn ghost" onClick={locate}>Retry</button>
          </p>
        )}

        <label htmlFor="category">2. What&apos;s the problem?</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <label htmlFor="note">3. Add a note (optional)</label>
        <textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Big pothole near the bus stop, been here 2 weeks" />

        <button className="btn block" style={{ marginTop: 20 }} disabled={busy || !photo || !coords || !pin || scan === "scanning"}>
          {busy ? "Posting…" : "Post report"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
