"use client";

import Link from "next/link";
import { account } from "@/lib/appwrite";
import { useUser } from "@/lib/useUser";

export default function Header() {
  const { user, loading, setUser } = useUser();

  async function logout() {
    await account.deleteSession({ sessionId: "current" }).catch(() => {});
    setUser(null);
  }

  return (
    <header className="top">
      <Link href="/" className="logo">
        Kand<span>id</span>
      </Link>
      {!loading &&
        (user ? (
          <button className="btn ghost" onClick={logout}>Log out</button>
        ) : (
          <Link href="/login" className="btn ghost">Log in</Link>
        ))}
    </header>
  );
}
