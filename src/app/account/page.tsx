"use client";

import Link from "next/link";
import { useState } from "react";
import { ExecutionMethod } from "appwrite";
import Header from "../Header";
import { account, config, functions } from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";
import { useI18n } from "@/lib/i18n";

export default function AccountPage() {
  const { user, loading } = useUser();
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function deleteEverything() {
    setBusy(true); setError("");
    try {
      const exec = await functions.createExecution({
        functionId: config.syncFunctionId,
        xpath: "/delete-account",
        method: ExecutionMethod.POST,
        async: false,
      });
      const body = JSON.parse(exec.responseBody || "{}");
      if (!body.ok) throw new Error(t("common.tryAgain"));
      await account.deleteSession({ sessionId: "current" }).catch(() => {});
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <h1>{t("account.title")}</h1>
      {loading ? (
        <p className="meta">{t("common.loading")}</p>
      ) : done ? (
        <p className="ok">{t("account.deleted")}</p>
      ) : !user ? (
        <>
          <p>{t("account.loginFirst")}</p>
          <Link href="/login" className="btn">{t("nav.login")}</Link>
        </>
      ) : (
        <>
          <p>{t("account.loggedInAs")} <strong>{user.email}</strong>. {t("account.emailPrivate")}</p>
          <p className="meta">{t("account.singleReport")}</p>

          <section className="card verify">
            <div className="body">
              <h2>{t("account.deleteTitle")}</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                {t("account.deleteHint")}
              </p>
              {confirm ? (
                <div className="verify-actions">
                  <button className="btn danger" disabled={busy} onClick={deleteEverything}>{busy ? t("mod.deleting") : t("account.yesDelete")}</button>
                  <button className="btn ghost" disabled={busy} onClick={() => setConfirm(false)}>{t("common.cancel")}</button>
                </div>
              ) : (
                <button className="btn ghost block" onClick={() => setConfirm(true)}>{t("account.deleteButton")}</button>
              )}
              {error && <p className="error">{error}</p>}
            </div>
          </section>
          <p className="meta" style={{ marginTop: 16 }}><Link href="/privacy">{t("account.seePolicy")}</Link></p>
        </>
      )}
    </>
  );
}
