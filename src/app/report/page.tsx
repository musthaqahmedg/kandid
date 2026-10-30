"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ID, Permission, Role } from "appwrite";
import Header from "../Header";
import { CATEGORIES, compressPhoto, config, storage, tablesDB, type Category } from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";

type Coords = { lat: number; lng: number; accuracy: number };

export default function ReportPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState("");
  const [category, setCategory] = useState<Category>("road");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function locate() {
    setLocError("");
    if (!("geolocation" in navigator)) return setLocError("This device can't share location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setLocError("Location is needed. Allow location access and try again."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setError("");
    setCapturedAt(new Date().toISOString());
    locate(); // pin location at the moment of capture
    const file = await compressPhoto(raw);
    if (file.size > 5 * 1024 * 1024) return setError("Photo is over 5 MB. Try again.");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !photo || !coords || !capturedAt) return;
    setBusy(true); setError("");
    try {
      const file = await storage.createFile({
        bucketId: config.photosBucketId,
        fileId: ID.unique(),
        file: photo,
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(user.$id))],
      });
      await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.reportsTableId,
        rowId: ID.unique(),
        data: {
          photo_id: file.$id,
          category,
          note: note.trim() || null,
          location: [coords.lng, coords.lat], // Appwrite points are [longitude, latitude]
          reporter_id: user.$id,
          captured_at: capturedAt,
        },
        permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id)),
        ],
      });
      router.push("/");
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
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your photo" className="preview" />
        )}

        <div className="hint" style={{ marginTop: 10 }}>
          {coords
            ? `📍 Pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${Math.round(coords.accuracy)} m)`
            : photo && !locError ? "📍 Getting your location…" : null}
        </div>
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

        <button className="btn block" style={{ marginTop: 20 }} disabled={busy || !photo || !coords}>
          {busy ? "Posting…" : "Post report"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
