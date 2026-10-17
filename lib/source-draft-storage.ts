export const SOURCE_DRAFT_STORAGE_VERSION = 1 as const;

export type PersistedSourceDrafts<T> = {
  version: typeof SOURCE_DRAFT_STORAGE_VERSION;
  saved_at: string;
  items: T[];
};

export function serializeSourceDrafts<T>(items: T[], savedAt = new Date().toISOString()) {
  return JSON.stringify({
    version: SOURCE_DRAFT_STORAGE_VERSION,
    saved_at: savedAt,
    items,
  });
}

export function parseSourceDrafts<T>(value: string): PersistedSourceDrafts<T> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Draft backup must be a JSON object.");
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== SOURCE_DRAFT_STORAGE_VERSION) throw new Error("Unsupported draft backup version.");
  if (!Array.isArray(candidate.items)) throw new Error("Draft backup items must be an array.");
  if (typeof candidate.saved_at !== "string" || Number.isNaN(Date.parse(candidate.saved_at))) {
    throw new Error("Draft backup saved_at must be an ISO date.");
  }
  return candidate as PersistedSourceDrafts<T>;
}
