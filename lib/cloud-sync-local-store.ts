/** Optional local-only IndexedDB binding metadata. No article body, auth token or network. */
import {
  CLOUD_SYNC_BINDING_VERSION, validCloudBinding,
  type CloudSyncBinding,
} from "./cloud-workbench-sync.ts";

export const CLOUD_LOCAL_DB_NAME = "ai-pm-radar-cloud-sync-metadata";
const STORE = "material-bindings";

async function withDb<T>(perform: (db: IDBDatabase) => Promise<T>): Promise<T> {
  if (typeof indexedDB === "undefined") throw Error("IndexedDB unavailable.");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(CLOUD_LOCAL_DB_NAME, CLOUD_SYNC_BINDING_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? Error("Local database unavailable."));
    req.onblocked = () => reject(Error("Close other Radar tabs to upgrade local cloud metadata."));
  });
  try { return await perform(db); }
  finally { db.close(); }
}

export function readCloudBinding(materialId: string): Promise<CloudSyncBinding | null> {
  return withDb((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(materialId);
    request.onsuccess = () => {
      const entry: unknown = request.result;
      if (entry == null) resolve(null);
      else if (validCloudBinding(entry) && entry.material_id === materialId) resolve(entry);
      else reject(Error("Cloud metadata malformed. Stop and restore from backup."));
    };
    request.onerror = () => reject(request.error ?? Error("Cloud binding read failed."));
  }));
}

export function storeCloudBinding(binding: CloudSyncBinding): Promise<void> {
  if (!validCloudBinding(binding)) return Promise.reject(Error("Invalid cloud binding."));
  return withDb((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let conflict = false;
    const existing = store.get(binding.material_id);
    existing.onsuccess = () => {
      if (existing.result !== undefined) {
        // Never allow another tab to replace this material's stable Cloud ID.
        // The future revision-ACK update API will require explicit CAS.
        conflict = true;
        tx.abort();
        return;
      }
      store.add(structuredClone(binding), binding.material_id);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(conflict
      ? Error("Cloud ID already reserved. Reload existing binding; do not overwrite it.")
      : tx.error ?? Error("Cloud binding transaction aborted."));
    tx.onerror = () => reject(tx.error ?? Error("Cloud binding storage failed."));
  }));
}

/** Update only the acknowledgement for the exact mapping previously read. */
export function acknowledgeCloudBinding(
  expected: CloudSyncBinding,
  updated: CloudSyncBinding,
): Promise<void> {
  if (!validCloudBinding(expected) || !validCloudBinding(updated)
    || expected.material_id !== updated.material_id
    || expected.cloud_source_id !== updated.cloud_source_id
    || updated.last_remote_revision === null || updated.last_remote_fingerprint === null
    || updated.last_synced_at === null
    || (expected.last_remote_revision !== null
      && (updated.last_remote_revision < expected.last_remote_revision
        || updated.last_remote_fingerprint === expected.last_remote_fingerprint))) {
    return Promise.reject(Error("Invalid cloud acknowledgement update."));
  }
  return withDb((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let conflict = false;
    const request = store.get(expected.material_id);
    request.onsuccess = () => {
      const current: unknown = request.result;
      if (!validCloudBinding(current)
        || current.cloud_source_id !== expected.cloud_source_id
        || current.last_remote_revision !== expected.last_remote_revision
        || current.last_remote_fingerprint !== expected.last_remote_fingerprint) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(structuredClone(updated), updated.material_id);
    };
    request.onerror = () => {
      tx.abort();
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(conflict
      ? Error("Cloud acknowledgement changed in another tab; reload before continuing.")
      : tx.error ?? Error("Cloud acknowledgement update failed."));
    tx.onerror = () => reject(tx.error ?? Error("Cloud acknowledgement update failed."));
  }));
}

export function listCloudBindings(): Promise<CloudSyncBinding[]> {
  return withDb((db) => new Promise<CloudSyncBinding[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => {
      if (!Array.isArray(request.result) || !request.result.every(validCloudBinding)) {
        reject(Error("Cloud metadata malformed. Stop and review backup.")); return;
      }
      resolve(request.result as CloudSyncBinding[]);
    };
    request.onerror = () => reject(request.error ?? Error("Cloud bindings read failed."));
  }));
}
