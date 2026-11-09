"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ID, OAuthProvider } from "appwrite";
import Header from "../Header";
import { account } from "@/lib/appwrite";

// Turn on once the Google provider is configured in Appwrite
const GOOGLE_LOGIN_ENABLED = true;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Shown when Google sends people back after a failed or cancelled login
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "google") setError("Google login was cancelled or failed. Try again, or use your email.");
  }, []);

  function google() {
    account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success: `${window.location.origin}/login/callback`,
      failure: `${window.location.origin}/login?error=google`,
    });
  }

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
      {GOOGLE_LOGIN_ENABLED && !userId && (
        <>
          <button type="button" className="btn ghost block google" onClick={google}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <div className="or"><span>or use your email</span></div>
        </>
      )}
      {!userId ? (
        <form onSubmit={sendCode}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <p className="hint">We&apos;ll email you a 6-digit code. No password needed.</p>
          <p className="hint">By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>. Your email is never shown publicly.</p>
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
