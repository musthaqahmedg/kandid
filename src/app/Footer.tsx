"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <Link href="/privacy">{t("footer.privacy")}</Link> · <Link href="/terms">{t("footer.terms")}</Link> · <Link href="/account">{t("footer.myData")}</Link>
      <p>{t("footer.note")}</p>
    </footer>
  );
}
