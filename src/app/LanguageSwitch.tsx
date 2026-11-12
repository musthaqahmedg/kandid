"use client";

import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";

export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <select className="lang" aria-label={t("nav.language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
      {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
        <option key={l} value={l}>{LANGUAGES[l]["lang.name"]}</option>
      ))}
    </select>
  );
}
