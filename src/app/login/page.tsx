"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ID } from "appwrite";
import Header from "../Header";
import { account } from "@/lib/appwrite";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const token = await account.createEmailToken({ userId: ID.unique(), email });
      setUserId(token.userId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true); setError("");
    try {
      await account.createSession({ userId, secret: code.trim() });
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <h1>Log in</h1>
      {!userId ? (
        <form onSubmit={sendCode}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <p className="hint">We&apos;ll email you a 6-digit code. No password needed.</p>
          <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label htmlFor="code">Enter the code sent to {email}</label>
          <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          <button className="btn block" style={{ marginTop: 16 }} disabled={busy || code.trim().length < 6}>
            {busy ? "Checking…" : "Log in"}
          </button>
          <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={() => { setUserId(null); setCode(""); }}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}
