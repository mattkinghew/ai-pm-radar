export const SOURCE_INBOX_DRAFT_DB_NAME = "ai-pm-radar-source-inbox";
export const SOURCE_INBOX_DRAFT_STORE = "workbench";

export type SourceInboxDraftSummary = {
  total: number;
  withBody: number;
  needsBody: number;
  todayNeedsReview: number;
  needsReview: number;
  reviewedNotApproved: number;
  approved: number;
  rejected: number;
};

export function renderSourceInboxDraftSummary(template: string, summary: SourceInboxDraftSummary): string {
  const values: Record<keyof SourceInboxDraftSummary, number> = summary;
  return (Object.keys(values) as Array<keyof SourceInboxDraftSummary>)
    .reduce((text, key) => text.split(`{${key}}`).join(String(values[key])), template);
}

function hongKongDate(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function summarizeStoredWorkbench(value: unknown, now: Date = new Date()): SourceInboxDraftSummary {
  const workbench = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const materials = Array.isArray(workbench.materials)
    ? workbench.materials
    : [];
  let withBody = 0;
  let todayNeedsReview = 0;
  let needsReview = 0;
  let reviewedNotApproved = 0;
  let approved = 0;
  let rejected = 0;
  const candidateDate = typeof workbench.candidateDate === "string" ? workbench.candidateDate : "";
  const activeMaterialId = typeof workbench.activeMaterialId === "string" ? workbench.activeMaterialId : null;

  for (const material of materials) {
    if (!material || typeof material !== "object") continue;
    const card = material as Record<string, unknown>;
    const form = card.form;
    if (!form || typeof form !== "object"
      || typeof (form as { body?: unknown }).body !== "string"
      || !(form as { body: string }).body.trim()) continue;
    withBody += 1;
    const fingerprint = JSON.stringify({ form, date: candidateDate });
    const isActive = card.id === activeMaterialId;
    const reviewValue = (key: string) => isActive && Object.prototype.hasOwnProperty.call(workbench, key)
      ? workbench[key]
      : card[key];
    const reviewedFingerprint = reviewValue("reviewedFingerprint");
    const approvedFingerprint = reviewValue("approvedFingerprint");
    const rejectedFingerprint = reviewValue("rejectedFingerprint");

    if (rejectedFingerprint === fingerprint) rejected += 1;
    else if (reviewedFingerprint !== fingerprint) {
      needsReview += 1;
      const capturedAt = typeof (form as { capturedAt?: unknown }).capturedAt === "string"
        ? (form as { capturedAt: string }).capturedAt
        : "";
      if (capturedAt && hongKongDate(capturedAt) === hongKongDate(now)) todayNeedsReview += 1;
    } else if (approvedFingerprint === fingerprint) approved += 1;
    else reviewedNotApproved += 1;
  }

  return {
    total: materials.length,
    withBody,
    needsBody: materials.length - withBody,
    todayNeedsReview,
    needsReview,
    reviewedNotApproved,
    approved,
    rejected,
  };
}

export async function readSourceInboxDraftSummary(): Promise<SourceInboxDraftSummary> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable.");

  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SOURCE_INBOX_DRAFT_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local drafts could not be read."));
    request.onblocked = () => reject(new Error("Local draft database is blocked."));
  });

  if (!database.objectStoreNames.contains(SOURCE_INBOX_DRAFT_STORE)) {
    database.close();
    return { total: 0, withBody: 0, needsBody: 0, todayNeedsReview: 0, needsReview: 0, reviewedNotApproved: 0, approved: 0, rejected: 0 };
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SOURCE_INBOX_DRAFT_STORE, "readonly");
    const request = transaction.objectStore(SOURCE_INBOX_DRAFT_STORE).get("current");
    transaction.oncomplete = () => {
      database.close();
      resolve(summarizeStoredWorkbench(request.result));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Local drafts could not be read."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Local draft read was aborted."));
    };
  });
}
