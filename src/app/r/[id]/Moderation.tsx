"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ID, Permission, Query, Role } from "appwrite";
import { config, tablesDB, type Report } from "@/lib/appwrite";
import { useI18n, type Key } from "@/lib/i18n";

const REASONS = [{ value: "fake" }, { value: "offensive" }, { value: "private_info" }, { value: "duplicate" }, { value: "other" }] as const;

/** Reporter: delete own report. Everyone else: flag it for review. */
export default function Moderation({ report, userId }: { report: Report; userId: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
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
            <p className="meta">{t("mod.deleteConfirm")}</p>
            <div className="verify-actions">
              <button className="btn danger" disabled={busy} onClick={remove}>{busy ? t("mod.deleting") : t("mod.yesDelete")}</button>
              <button className="btn ghost" disabled={busy} onClick={() => setStep("idle")}>{t("common.cancel")}</button>
            </div>
          </>
        ) : (
          <button className="linklike muted" onClick={() => setStep("confirm")}>{t("mod.delete")}</button>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="moderation">
      {step === "done" ? (
        <p className="meta">{t("mod.flagged")}</p>
      ) : step === "form" ? (
        <>
          <label htmlFor="reason" style={{ marginTop: 0 }}>{t("mod.flagQuestion")}</label>
          <select id="reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{t(`mod.reason.${r.value}` as Key)}</option>)}
          </select>
          <textarea maxLength={300} placeholder={t("mod.details")} value={details} onChange={(e) => setDetails(e.target.value)} style={{ marginTop: 8, minHeight: 60 }} />
          <div className="verify-actions" style={{ marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={flag}>{busy ? t("mod.sending") : t("mod.send")}</button>
            <button className="btn ghost" disabled={busy} onClick={() => setStep("idle")}>{t("common.cancel")}</button>
          </div>
          <p className="hint">{t("mod.flagHint")}</p>
        </>
      ) : (
        <button className="linklike muted" onClick={() => setStep("form")}>{t("mod.flag")}</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
