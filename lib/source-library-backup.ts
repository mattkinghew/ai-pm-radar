import { migrateSourceLibraryEntry, sourceLibraryEntryKey, validateSourceLibraryEntry, type SourceLibraryEntry } from "./source-library.ts";

export const SOURCE_LIBRARY_BACKUP_VERSION = 1 as const;

export type SourceLibraryBackup = {
  version: typeof SOURCE_LIBRARY_BACKUP_VERSION;
  exported_at: string;
  entries: SourceLibraryEntry[];
};

export function serializeSourceLibraryBackup(entries: SourceLibraryEntry[], exportedAt = new Date().toISOString()) {
  if (Number.isNaN(Date.parse(exportedAt)) || entries.some((entry) => !validateSourceLibraryEntry(entry))) {
    throw new Error("Source Library backup contains invalid entries or timestamp.");
  }
  return JSON.stringify({
    version: SOURCE_LIBRARY_BACKUP_VERSION,
    exported_at: new Date(exportedAt).toISOString(),
    entries,
  }, null, 2);
}

export function parseSourceLibraryBackup(value: string): SourceLibraryBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Source Library backup must contain valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Source Library backup must be a JSON object.");
  const backup = parsed as Record<string, unknown>;
  if (backup.version !== SOURCE_LIBRARY_BACKUP_VERSION) throw new Error("Unsupported Source Library backup version.");
  if (typeof backup.exported_at !== "string" || Number.isNaN(Date.parse(backup.exported_at))) {
    throw new Error("Source Library backup timestamp is invalid.");
  }
  if (!Array.isArray(backup.entries)) throw new Error("Source Library backup entries must be an array.");
  const entries = backup.entries.map((value) => migrateSourceLibraryEntry(value));
  if (entries.some((entry) => !entry || !validateSourceLibraryEntry(entry))) {
    throw new Error("Source Library backup contains an unsupported or invalid SourceRecord relationship.");
  }
  const keys = entries.map((entry) => sourceLibraryEntryKey(entry!));
  if (new Set(keys).size !== keys.length) throw new Error("Source Library backup contains duplicate SourceRecord identities.");
  return { version: SOURCE_LIBRARY_BACKUP_VERSION, exported_at: backup.exported_at, entries: entries as SourceLibraryEntry[] };
}
