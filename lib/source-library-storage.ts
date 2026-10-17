import {
  appendDownstreamHandoff,
  appendResearchBriefHandoff,
  mergeSourceLibraryEntry,
  migrateSourceLibraryEntry,
  sourceLibraryEntryKey,
  validateSourceLibraryEntry,
  type SourceLibraryEntry,
} from "./source-library.ts";
import type { ResearchBriefDraft } from "./research-runtime.ts";
import type { BaseHandoff } from "./downstream-handoff.ts";
import { appendDeliveryPackage, updateDeliveryPackageRecord } from "./source-library.ts";
import type { DeliveryPackageRecord } from "./delivery-package.ts";
import { upsertIntelligenceAssessment } from "./source-library.ts";
import type { IntelligenceAssessment } from "./intelligence-routing.ts";

export { sourceLibraryEntryKey };

const DATABASE_NAME = "ai-pm-radar-source-inbox";
const DATABASE_VERSION = 3;
const LIBRARY_STORE = "source-library";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of ["workbench", "subscriptions", "feed-items", LIBRARY_STORE]) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Source library storage could not be opened."));
    request.onblocked = () => reject(new Error("Close another Radar tab to finish local storage upgrade."));
  });
}

export async function listSourceLibraryEntries() {
  const database = await openDatabase();
  return new Promise<SourceLibraryEntry[]>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const request = transaction.objectStore(LIBRARY_STORE).getAll();
    request.onsuccess = () => {
      const store = transaction.objectStore(LIBRARY_STORE);
      const entries = (request.result as unknown[]).flatMap((value) => {
        const migrated = migrateSourceLibraryEntry(value);
        if (!migrated || !validateSourceLibraryEntry(migrated)) return [];
        if ((value as { version?: number }).version !== migrated.version) {
          store.put(migrated, sourceLibraryEntryKey(migrated));
        }
        return [migrated];
      });
      resolve(entries);
    };
    request.onerror = () => reject(request.error ?? new Error("Source library could not be read."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function importSourceLibraryEntries(incoming: SourceLibraryEntry[]) {
  const existing = await listSourceLibraryEntries();
  const saved: SourceLibraryEntry[] = [];
  for (const entry of incoming) {
    const current = existing.find((candidate) => sourceLibraryEntryKey(candidate) === sourceLibraryEntryKey(entry));
    saved.push(await saveSourceLibraryEntry(current ? mergeSourceLibraryEntry(current, entry) : entry));
  }
  return saved;
}

export async function saveSourceLibraryEntry(entry: SourceLibraryEntry) {
  if (!validateSourceLibraryEntry(entry)) throw new Error("Only a valid, approved SourceRecord can be saved to the library.");
  const database = await openDatabase();
  const key = sourceLibraryEntryKey(entry);
  return new Promise<SourceLibraryEntry>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE);
    const request = store.get(key);
    let savedEntry = entry;
    request.onsuccess = () => {
      const existingEntry = migrateSourceLibraryEntry(request.result);
      if (existingEntry && validateSourceLibraryEntry(existingEntry)) {
        savedEntry = existingEntry;
        if ((request.result as { version?: number }).version !== existingEntry.version) store.put(existingEntry, key);
      }
      else store.put(entry, key);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      resolve(savedEntry);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Source library entry could not be saved."));
    };
    transaction.onerror = () => database.close();
  });
}

export async function saveDownstreamHandoff(key: string, handoff: BaseHandoff) {
  const database = await openDatabase();
  return new Promise<SourceLibraryEntry>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE);
    const request = store.get(key);
    let updatedEntry: SourceLibraryEntry | null = null;
    request.onsuccess = () => {
      const entry = migrateSourceLibraryEntry(request.result);
      if (!entry || !validateSourceLibraryEntry(entry)) {
        transaction.abort();
        return;
      }
      updatedEntry = appendDownstreamHandoff(entry, handoff);
      store.put(updatedEntry, key);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      if (updatedEntry) resolve(updatedEntry);
      else reject(new Error("Downstream handoff could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Downstream handoff could not be saved."));
    };
    transaction.onerror = () => database.close();
  });
}

export async function saveDeliveryPackageRecord(key: string, packageRecord: DeliveryPackageRecord) {
  const database = await openDatabase();
  return new Promise<SourceLibraryEntry>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE);
    const request = store.get(key);
    let updatedEntry: SourceLibraryEntry | null = null;
    request.onsuccess = () => {
      const entry = migrateSourceLibraryEntry(request.result);
      if (!entry || !validateSourceLibraryEntry(entry)) {
        transaction.abort();
        return;
      }
      const existing = entry.delivery_packages.some((item) => item.package.package_id === packageRecord.package.package_id);
      updatedEntry = existing ? updateDeliveryPackageRecord(entry, packageRecord) : appendDeliveryPackage(entry, packageRecord);
      store.put(updatedEntry, key);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      if (updatedEntry) resolve(updatedEntry);
      else reject(new Error("Delivery package could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Delivery package could not be saved."));
    };
    transaction.onerror = () => database.close();
  });
}

export async function saveIntelligenceAssessment(key: string, assessment: IntelligenceAssessment) {
  const database = await openDatabase();
  return new Promise<SourceLibraryEntry>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE);
    const request = store.get(key);
    let updatedEntry: SourceLibraryEntry | null = null;
    request.onsuccess = () => {
      const entry = migrateSourceLibraryEntry(request.result);
      if (!entry || !validateSourceLibraryEntry(entry)) {
        transaction.abort();
        return;
      }
      updatedEntry = upsertIntelligenceAssessment(entry, assessment);
      store.put(updatedEntry, key);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      if (updatedEntry) resolve(updatedEntry);
      else reject(new Error("Intelligence assessment could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Intelligence assessment could not be saved."));
    };
    transaction.onerror = () => database.close();
  });
}

export async function saveResearchBriefHandoff(
  key: string,
  artifactId: string,
  createdAt: string,
  brief: ResearchBriefDraft,
) {
  const database = await openDatabase();
  return new Promise<SourceLibraryEntry>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE, "readwrite");
    const store = transaction.objectStore(LIBRARY_STORE);
    const request = store.get(key);
    let updatedEntry: SourceLibraryEntry | null = null;
    request.onsuccess = () => {
      if (!validateSourceLibraryEntry(request.result)) {
        transaction.abort();
        return;
      }
      updatedEntry = appendResearchBriefHandoff(request.result, artifactId, createdAt, brief);
      store.put(updatedEntry, key);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      if (updatedEntry) resolve(updatedEntry);
      else reject(new Error("Research Brief handoff could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Research Brief handoff could not be saved."));
    };
    transaction.onerror = () => database.close();
  });
}
