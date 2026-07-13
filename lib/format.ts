import { defaultLanguage, type Language } from "./i18n";

function getLocale(language: Language) {
  return language === "zh-HK" ? "zh-HK" : "en-CA";
}

export function formatDate(value: string, language: Language = defaultLanguage) {
  return new Intl.DateTimeFormat(getLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string, language: Language = defaultLanguage) {
  return new Intl.DateTimeFormat(getLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
