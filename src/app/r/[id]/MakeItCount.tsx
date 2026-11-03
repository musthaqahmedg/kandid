"use client";

import { useEffect, useState } from "react";
import { ID, Permission, Query, Role } from "appwrite";
import { ageLabel, categoryLabel, config, photoUrl, tablesDB, type Report } from "@/lib/appwrite";

type Channel = "pwd4u" | "ksmart" | "cmo";
type Filing = { $id: string; $createdAt: string; channel: Channel | "other"; reference?: string | null; user_id: string };

const CHANNELS: Record<Channel, { name: string; who: string; url: () => string; how: string }> = {
  pwd4u: {
    name: "PWD 4U",
    who: "Kerala PWD (state roads)",
    how: "Use the PWD 4U app: mark the spot on the map, add the photo and paste the text.",
    url: () =>
      /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? "https://apps.apple.com/in/app/pwd4u/id1571504236"
        : "https://play.google.com/store/apps/details?id=com.iroads.pwd.pwd4u",
  },
  ksmart: {
    name: "K-SMART",
    who: "Your panchayat / municipality",
    how: "Log in to K-SMART, go to Apply → PGR & Complaints, and paste the text.",
    url: () => "https://ksmart.lsgkerala.gov.in/",
  },
  cmo: {
    name: "CM's Grievance Cell",
    who: "Chief Minister's Public Grievance Redressal Cell (any department)",
    how: "Use this if the other channels don't act. Paste the text and attach the photo.",
    url: () => "https://complaints.cmo.kerala.gov.in/",
  },
};

/** Which official channels fit this kind of issue, best first. */
function channelsFor(category: Report["category"]): Channel[] {
  if (category === "road") return ["pwd4u", "ksmart", "cmo"]; // PWD roads → PWD 4U; local roads → K-SMART
  return ["ksmart", "cmo"]; // garbage, drainage, streetlights, water, other → local body first
}

export default function MakeItCount({ report, userId }: { report: Report; userId: string | null }) {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [copied, setCopied] = useState("");
  const [open, setOpen] = useState<Channel | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [lng, lat] = report.location;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${report.$id}` : "";
  const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  const label = categoryLabel(report.category);
  const date = new Date(report.captured_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const shareText = `🚧 ${label}: ${ageLabel(report).toLowerCase()}. ${report.upvote_count} people saw it too. Please fix it! #Kandid`;
  const complaintText = [
    `Complaint: ${label}`,
    `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)} (map: ${mapUrl})`,
    `Photo taken on the spot on ${date}.`,
    report.note ? `Details: ${report.note}` : null,
    `${ageLabel(report)}. ${report.upvote_count} other citizens have confirmed seeing it.`,
    `Photo and live status: ${pageUrl}`,
    `Kindly take action at the earliest.`,
  ].filter(Boolean).join("\n");

  useEffect(() => {
    tablesDB
      .listRows({ databaseId: config.databaseId, tableId: "filings", queries: [Query.equal("report_id", report.$id), Query.orderDesc("$createdAt"), Query.limit(20)] })
      .then((res) => setFilings(res.rows as unknown as Filing[]))
      .catch(() => {});
  }, [report.$id]);

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setCopied(""); }
  }

  async function nativeShare() {
    const data: ShareData = { title: `Kandid: ${label}`, text: shareText, url: pageUrl };
    try {
      // Try to include the photo itself (works on most phones)
      const blob = await fetch(photoUrl(report.fixed_photo_id ?? report.photo_id)).then((r) => r.blob());
      const file = new File([blob], "kandid.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
    } catch {}
    try { await navigator.share(data); } catch {}
  }

  async function markFiled(channel: Channel) {
    if (!userId) return;
    setBusy(true); setError("");
    try {
      const row = await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: "filings",
        rowId: ID.unique(),
        data: { report_id: report.$id, user_id: userId, channel, reference: ref.trim() || null },
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(userId))],
      });
      setFilings((f) => [row as unknown as Filing, ...f]);
      setOpen(null); setRef("");
    } catch {
      setError("You've already marked this one as filed.");
    } finally {
      setBusy(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section className="card verify">
      <div className="body">
        <h2>Make it count</h2>

        <p className="meta" style={{ margin: "0 0 8px" }}>1. Share it so more people see it</p>
        <div className="share-row">
          {canShare && <button className="btn" onClick={nativeShare}>📤 Share</button>}
          <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn ghost" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noreferrer">X</a>
          <button className="btn ghost" onClick={() => copy(pageUrl, "link")}>{copied === "link" ? "Copied ✓" : "Copy link"}</button>
        </div>
        <p className="hint">Tip: tag your ward councillor or MLA when you post.</p>

        <p className="meta" style={{ margin: "16px 0 8px" }}>2. File it officially</p>
        <button className="btn ghost block" onClick={() => copy(complaintText, "complaint")}>
          {copied === "complaint" ? "Complaint text copied ✓" : "📋 Copy ready-made complaint text"}
        </button>

        <ul className="channels">
          {channelsFor(report.category).map((c) => {
            const ch = CHANNELS[c];
            const count = filings.filter((f) => f.channel === c).length;
            return (
              <li key={c}>
                <div className="row">
                  <div>
                    <strong>{ch.name}</strong>
                    <div className="meta">{ch.who}</div>
                  </div>
                  <a className="btn ghost" href={ch.url()} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
                <p className="hint" style={{ margin: "6px 0" }}>{ch.how}</p>
                {count > 0 && <p className="ok" style={{ margin: "4px 0" }}>✓ Filed {count} time{count > 1 ? "s" : ""}</p>}
                {userId && (open === c ? (
                  <div className="filed-form">
                    <input type="text" maxLength={100} placeholder="Complaint / reference number (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
                    <button className="btn" disabled={busy} onClick={() => markFiled(c)}>{busy ? "Saving…" : "Save"}</button>
                  </div>
                ) : (
                  <button className="linklike" onClick={() => { setOpen(c); setError(""); }}>I filed it here</button>
                ))}
              </li>
            );
          })}
        </ul>
        {error && <p className="error">{error}</p>}

        {filings.length > 0 && (
          <div className="filings">
            <p className="meta" style={{ margin: "12px 0 4px" }}>Official filings</p>
            {filings.map((f) => (
              <div key={f.$id} className="meta">
                📨 {f.channel === "other" ? "Other" : CHANNELS[f.channel].name} · {new Date(f.$createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {f.reference ? ` · Ref ${f.reference}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
