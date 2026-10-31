export const COLLECTOR_SNAPSHOT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type CollectorSnapshotFreshness = {
  status: "unknown" | "fresh" | "stale";
  updatedAt: string | null;
};

export function getCollectorSnapshotFreshness(
  updatedAt: unknown,
  now: Date | number = Date.now(),
): CollectorSnapshotFreshness {
  if (typeof updatedAt !== "string" || !updatedAt.trim()) {
    return { status: "unknown", updatedAt: null };
  }

  const snapshotTime = Date.parse(updatedAt);
  const currentTime = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(currentTime) || snapshotTime > currentTime + MAX_FUTURE_SKEW_MS) {
    return { status: "unknown", updatedAt: null };
  }

  return {
    status: currentTime - snapshotTime > COLLECTOR_SNAPSHOT_STALE_AFTER_MS ? "stale" : "fresh",
    updatedAt: updatedAt.trim(),
  };
}
