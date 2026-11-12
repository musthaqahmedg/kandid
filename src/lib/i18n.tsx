"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en, { type Dict } from "@/locales/en";
import ml from "@/locales/ml";
import type { Report } from "@/lib/appwrite";

/** To add a language: create src/locales/<code>.ts with the same keys as en.ts and list it here. */
export const LANGUAGES = { en, ml } as const satisfies Record<string, Dict>;
export type Lang = keyof typeof LANGUAGES;
export type Key = keyof Dict;
export type T = (key: Key, vars?: Record<string, string | number>) => string;

const STORAGE_KEY = "kandid:lang";

function format(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T }>({
  lang: "en",
  setLang: () => {},
  t: (k, v) => format(en[k], v),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
    const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
    const pick = (saved ?? browser) as Lang;
    if (pick in LANGUAGES) setLangState(pick);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback<T>((key, vars) => format(LANGUAGES[lang][key] ?? en[key], vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

// Helpers for values that come from the database
export const categoryText = (t: T, c: string) => t(`cat.${c}` as Key);
export const statusText = (t: T, s: string) => t(`status.${s}` as Key);

export function agoText(t: T, iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t("time.justNow");
  const m = Math.floor(s / 60); if (m < 60) return t("time.minAgo", { n: m });
  const h = Math.floor(m / 60); if (h < 24) return t("time.hAgo", { n: h });
  return t("time.dAgo", { n: Math.floor(h / 24) });
}

export function ageText(t: T, r: Report) {
  const days = (from: string, to: number) => Math.max(0, Math.floor((to - new Date(from).getTime()) / 86400000));
  if (r.status === "fixed" && r.fixed_at) {
    const d = days(r.captured_at, new Date(r.fixed_at).getTime());
    return d === 0 ? t("age.fixedSameDay") : d === 1 ? t("age.fixedDay") : t("age.fixedDays", { n: d });
  }
  const d = days(r.captured_at, Date.now());
  return d === 0 ? t("age.reportedToday") : d === 1 ? t("age.openDay") : t("age.openDays", { n: d });
}
