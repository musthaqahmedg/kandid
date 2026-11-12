"use client";

import { useEffect, useState } from "react";
import { ID, Permission, Query, Role } from "appwrite";
import { ageLabel, categoryLabel, config, photoUrl, tablesDB, type Report } from "@/lib/appwrite";
import { ageText, categoryText, useI18n, type Key } from "@/lib/i18n";

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
  const { t } = useI18n();
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

  const shareText = t("share.text", { label: categoryText(t, report.category), age: ageText(t, report), n: report.upvote_count });
  const complaintText = [
    `Complaint: ${label}`,
    report.address ? `Place: ${report.address}` : null,
    report.constituency ? `Assembly constituency: ${report.constituency}${report.ac_no ? ` (No. ${report.ac_no})` : ""}` : null,
    `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)} (map: ${mapUrl})`,
    `Photo taken on the spot on ${date}.`,
    report.note ? `Details: ${report.note}` : null,
    `${ageLabel(report)}. ${report.upvote_count} other citizens have confirmed seeing it.`,
    `Photo and live status: ${pageUrl}`,
    `Kindly take action at the earliest.`,
  ].filter(Boolean).join("\n");

  useEffect(() => {
    tablesDB
      .listRows({ databaseId: config.databaseId, tableId: config.filingsTableId, queries: [Query.equal("report_id", report.$id), Query.orderDesc("$createdAt"), Query.limit(20)] })
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
        tableId: config.filingsTableId,
        rowId: ID.unique(),
        data: { report_id: report.$id, user_id: userId, channel, reference: ref.trim() || null },
        permissions: [Permission.read(Role.any()), Permission.delete(Role.user(userId))],
      });
      setFilings((f) => [row as unknown as Filing, ...f]);
      setOpen(null); setRef("");
    } catch {
      setError(t("share.alreadyFiled"));
    } finally {
      setBusy(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section className="card verify">
      <div className="body">
        <h2>{t("share.title")}</h2>

        <p className="meta" style={{ margin: "0 0 8px" }}>{t("share.step1")}</p>
        <div className="share-row">
          {canShare && <button className="btn" onClick={nativeShare}>{t("share.share")}</button>}
          <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn ghost" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noreferrer">X</a>
          <button className="btn ghost" onClick={() => copy(pageUrl, "link")}>{copied === "link" ? t("share.copied") : t("share.copyLink")}</button>
        </div>
        <p className="hint">{t("share.tip")}</p>

        <p className="meta" style={{ margin: "16px 0 8px" }}>{t("share.step2")}</p>
        <button className="btn ghost block" onClick={() => copy(complaintText, "complaint")}>
          {copied === "complaint" ? t("share.complaintCopied") : t("share.copyComplaint")}
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
                    <div className="meta">{t(`ch.${c}.who` as Key)}</div>
                  </div>
                  <a className="btn ghost" href={ch.url()} target="_blank" rel="noreferrer">{t("share.open")}</a>
                </div>
                <p className="hint" style={{ margin: "6px 0" }}>{t(`ch.${c}.how` as Key)}</p>
                {count > 0 && <p className="ok" style={{ margin: "4px 0" }}>{t("share.filedTimes", { n: count })}</p>}
                {userId && (open === c ? (
                  <div className="filed-form">
                    <input type="text" maxLength={100} placeholder={t("share.refPlaceholder")} value={ref} onChange={(e) => setRef(e.target.value)} />
                    <button className="btn" disabled={busy} onClick={() => markFiled(c)}>{busy ? t("common.saving") : t("share.save")}</button>
                  </div>
                ) : (
                  <button className="linklike" onClick={() => { setOpen(c); setError(""); }}>{t("share.iFiled")}</button>
                ))}
              </li>
            );
          })}
        </ul>
        {error && <p className="error">{error}</p>}

        {filings.length > 0 && (
          <div className="filings">
            <p className="meta" style={{ margin: "12px 0 4px" }}>{t("share.filings")}</p>
            {filings.map((f) => (
              <div key={f.$id} className="meta">
                📨 {f.channel === "other" ? "Other" : CHANNELS[f.channel].name} · {new Date(f.$createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {f.reference ? ` · ${t("share.ref")} ${f.reference}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
