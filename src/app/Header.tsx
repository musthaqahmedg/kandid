"use client";

import Link from "next/link";
import { account } from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";
import { useI18n } from "@/lib/i18n";
import LanguageSwitch from "./LanguageSwitch";

export default function Header() {
  const { user, loading, setUser } = useUser();
  const { t } = useI18n();

  async function logout() {
    await account.deleteSession({ sessionId: "current" }).catch(() => {});
    setUser(null);
  }

  return (
    <header className="top">
      <Link href="/" className="logo">
        Kand<span>id</span>
      </Link>
      <div className="top-actions">
        <LanguageSwitch />
        {!loading &&
          (user ? (
            <button className="btn ghost" onClick={logout}>{t("nav.logout")}</button>
          ) : (
            <Link href="/login" className="btn ghost">{t("nav.login")}</Link>
          ))}
      </div>
    </header>
  );
}
