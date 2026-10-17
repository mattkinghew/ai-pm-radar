import type { Locale } from "./i18n";

export function formatDate(value: string, locale: Locale = "zh-Hant") {
  return new Intl.DateTimeFormat(locale === "zh-en" ? "en-CA" : "zh-Hant", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string, locale: Locale = "zh-Hant") {
  return new Intl.DateTimeFormat(locale === "zh-en" ? "en-CA" : "zh-Hant", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
