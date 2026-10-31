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

export function dateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarDayAge(date: string, today: string): number | null {
  const toUtcDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
    return timestamp;
  };
  const source = toUtcDay(date);
  const current = toUtcDay(today);
  if (source === null || current === null || source > current) return null;
  return (current - source) / 86_400_000;
}
