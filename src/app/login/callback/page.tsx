"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../Header";
import { account } from "@/lib/appwrite";
import { useI18n } from "@/lib/i18n";

/**
 * Google sends people back here with a one-time userId + secret.
 * Exchanging them for a session here (instead of relying on cookies from the
 * Appwrite domain) keeps login working on iPhone Safari.
 */
export default function OAuthCallback() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const secret = params.get("secret");
    if (!userId || !secret) return setError(t("login.googleIncomplete"));
    account
      .createSession({ userId, secret })
      .then(() => router.replace("/"))
      .catch((e) => setError((e as Error).message));
  }, [router]);

  return (
    <>
      <Header />
      {error ? (
        <>
          <p className="error">{error}</p>
          <Link href="/login" className="btn ghost">{t("login.back")}</Link>
        </>
      ) : (
        <p className="meta">{t("login.loggingIn")}</p>
      )}
    </>
  );
}
