"use client";

import Link from "next/link";
import { useState } from "react";
import { ExecutionMethod } from "appwrite";
import Header from "../Header";
import { account, config, functions } from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";

export default function AccountPage() {
  const { user, loading } = useUser();
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
      if (!body.ok) throw new Error(body.reason || "Something went wrong. Please try again.");
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
      <h1>My data</h1>
      {loading ? (
        <p className="meta">Loading…</p>
      ) : done ? (
        <p className="ok">Your account and all your data have been deleted.</p>
      ) : !user ? (
        <>
          <p>Log in to see and delete your data.</p>
          <Link href="/login" className="btn">Log in</Link>
        </>
      ) : (
        <>
          <p>Logged in as <strong>{user.email}</strong>. Your email is never shown publicly.</p>
          <p className="meta">To delete a single report, open it and tap &quot;Delete my report&quot;.</p>

          <section className="card verify">
            <div className="body">
              <h2>Delete my account</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                This permanently deletes your account, all your reports and photos, and your votes, ratings, filings and flags. It can&apos;t be undone.
              </p>
              {confirm ? (
                <div className="verify-actions">
                  <button className="btn danger" disabled={busy} onClick={deleteEverything}>{busy ? "Deleting…" : "Yes, delete everything"}</button>
                  <button className="btn ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn ghost block" onClick={() => setConfirm(true)}>Delete my account and data</button>
              )}
              {error && <p className="error">{error}</p>}
            </div>
          </section>
          <p className="meta" style={{ marginTop: 16 }}>See our <Link href="/privacy">privacy policy</Link>.</p>
        </>
      )}
    </>
  );
}
