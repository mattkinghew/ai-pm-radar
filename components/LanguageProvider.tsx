"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { messages, parseLocale, type Locale, type Messages } from "@/lib/i18n";

const STORAGE_KEY = "ai-pm-radar-locale";

type LanguageContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-Hant");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedLocale = parseLocale(saved);
    if (savedLocale) {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const value = useMemo(
    () => ({ locale, messages: messages[locale], setLocale }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
