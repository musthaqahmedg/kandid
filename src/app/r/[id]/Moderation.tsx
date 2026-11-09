"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ID, Permission, Query, Role } from "appwrite";
import { config, tablesDB, type Report } from "@/lib/appwrite";

const REASONS = [
  { value: "fake", label: "Fake or not a real issue" },
  { value: "offensive", label: "Offensive or abusive" },
  { value: "private_info", label: "Shows private info (face, number plate, home)" },
  { value: "duplicate", label: "Duplicate of another report" },
  { value: "other", label: "Something else" },
] as const;

/** Reporter: delete own report. Everyone else: flag it for review. */
export default function Moderation({ report, userId }: { report: Report; userId: string | null }) {
  const router = useRouter();
  const isReporter = !!userId && userId === report.reporter_id;
  const [step, setStep] = useState<"idle" | "confirm" | "form" | "done">("idle");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("fake");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || isReporter) return;
    tablesDB
      .listRows({ databaseId: config.databaseId, tableId: config.flagsTableId, queries: [Query.equal("report_id", report.$id), Query.equal("user_id", userId), Query.limit(1)] })
      .then((res) => { if (res.total > 0) setStep("done"); })
      .catch(() => {});
  }, [report.$id, userId, isReporter]);

  async function remove() {
    setBusy(true); setError("");
    try {
      // Photos, votes and filings are cleaned up by the kandid-sync function
      await tablesDB.deleteRow({ databaseId: config.databaseId, tableId: config.reportsTableId, rowId: report.$id });
      router.push("/");
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  }

  async function flag() {
    if (!userId) return;
    setBusy(true); setError("");
    try {
      await tablesDB.createRow({
        databaseId: config.databaseId,
        tableId: config.flagsTableId,
        rowId: ID.unique(),
        data: { report_id: report.$id, user_id: userId, reason, details: details.trim() || null },
        // Only the person who flagged can see their flag
        permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
      });
      setStep("done");
    } catch {
      setStep("done"); // already flagged
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return null;

  if (isReporter) {
    return (
      <div className="moderation">
        {step === "confirm" ? (
          <>
            <p className="meta">Delete this report, its photos and all votes? This can&apos;t be undone.</p>
            <div className="verify-actions">
              <button className="btn danger" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Yes, delete"}</button>
              <button className="btn ghost" disabled={busy} onClick={() => setStep("idle")}>Cancel</button>
            </div>
          </>
        ) : (
          <button className="linklike muted" onClick={() => setStep("confirm")}>🗑 Delete my report</button>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="moderation">
      {step === "done" ? (
        <p className="meta">🚩 You flagged this report. Thanks, we&apos;ll review it.</p>
      ) : step === "form" ? (
        <>
          <label htmlFor="reason" style={{ marginTop: 0 }}>What&apos;s wrong with this report?</label>
          <select id="reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <textarea maxLength={300} placeholder="More details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} style={{ marginTop: 8, minHeight: 60 }} />
          <div className="verify-actions" style={{ marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={flag}>{busy ? "Sending…" : "Flag report"}</button>
            <button className="btn ghost" disabled={busy} onClick={() => setStep("idle")}>Cancel</button>
          </div>
          <p className="hint">Reports flagged by 3 people are hidden until reviewed.</p>
        </>
      ) : (
        <button className="linklike muted" onClick={() => setStep("form")}>🚩 Flag this report</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
