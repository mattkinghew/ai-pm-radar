"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLanguage,
  isLanguage,
  translations,
  type Language,
} from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof (typeof translations)["en"]) => string;
};

const STORAGE_KEY = "ai-pm-radar-language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isLanguage(stored)) {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      setLanguage(nextLanguage) {
        setLanguageState(nextLanguage);
        window.localStorage.setItem(STORAGE_KEY, nextLanguage);
      },
      t(key) {
        return translations[language][key];
      },
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
