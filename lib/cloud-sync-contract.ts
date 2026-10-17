/**
 * Phase 1.2 candidate: pure, immutable per-SourceRecord cloud state.
 * NOT wired to production, browser storage or remote D1 yet.
 * No account identifiers, secrets, Gemini or network operations.
 */
import {
  validateSourceRecord,
  type SourceRecord,
} from "./source-inbox.ts";
import { findAnalysisEvidence, sourceTextForAnalysis } from "./ai-analysis.ts";
import { getDailyCandidateBlockers, type DailyCandidateMetadata } from "./daily-candidate.ts";
import { getReusableSourceBlockers, sourceRecordFingerprint } from "./source-library.ts";

export type CloudApprovalKind = "daily_candidate" | "source_reuse";
export type CloudReviewEventKind = "captured" | "edited" | "reviewed" | "rejected" | "approved_for_daily" | "approved_for_reuse";

export type CloudSourceRevision = {
  revision: number;
  fingerprint: string;
  record: SourceRecord;
  changed_at: string;
};

export type CloudSourceEvent = {
  kind: CloudReviewEventKind;
  source_revision: number;
  fingerprint: string;
  occurred_at: string;
};

export type CloudApproval = {
  revision: number;
  fingerprint: string;
  approved_at: string;
};

export type CloudSourceState = {
  schema_version: 1;
  source_id: string;
  server_revision: number;
  revisions: CloudSourceRevision[];
  reviewed_fingerprint: string | null;
  approved_for_daily: CloudApproval | null;
  approved_for_reuse: CloudApproval | null;
  events: CloudSourceEvent[];
};

export class CloudRevisionConflict extends Error {
  readonly currentRevision: number;
  constructor(currentRevision: number) {
    super("SourceRecord revision conflict; expectedRevision does not match current server revision.");
    this.name = "CloudRevisionConflict";
    this.currentRevision = currentRevision;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validTimestamp(value: string) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("Cloud event requires a valid timestamp.");
  }
  return new Date(value).toISOString();
}

function assertRecord(record: SourceRecord, sourceId?: string) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("SourceRecord must be an object.");
  }
  if (sourceId && record.id !== sourceId) throw new Error("SourceRecord ID cannot change across revisions.");
  let issues: string[];
  try { issues = validateSourceRecord(record); }
  catch { throw new Error("SourceRecord structure is invalid."); }
  if (issues.length > 0) throw new Error("Invalid SourceRecord: " + issues.join("; "));
  if (!Array.isArray(record.key_claims) || !Array.isArray(record.evidence)) {
    throw new Error("SourceRecord must have evidence and key_claim arrays.");
  }
}

async function fingerprint(record: SourceRecord) {
  // Reuse actual Radar content-fingerprint contract; review/approval fields excluded.
  const sourceContent = sourceRecordFingerprint(record);
  const bytes = new TextEncoder().encode(sourceContent);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function current(state: CloudSourceState): CloudSourceRevision {
  const revision = state.revisions.at(-1);
  if (!revision || revision.revision !== state.server_revision) {
    throw new Error("Corrupt cloud revision state.");
  }
  return revision;
}

function guardRevision(state: CloudSourceState, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("expectedRevision must be a positive integer.");
  }
  if (expectedRevision !== state.server_revision) {
    throw new CloudRevisionConflict(state.server_revision);
  }
  return current(state);
}

function append(
  state: CloudSourceState,
  record: SourceRecord,
  action: CloudReviewEventKind,
  at: string,
  newFingerprint: string,
): CloudSourceState {
  const nextRevision = state.server_revision + 1;
  return {
    ...state,
    server_revision: nextRevision,
    revisions: [...state.revisions, { revision: nextRevision, record: clone(record), fingerprint: newFingerprint, changed_at: at }],
    events: [...state.events, { kind: action, source_revision: nextRevision, fingerprint: newFingerprint, occurred_at: at }],
  };
}

function evidenceIssues(record: SourceRecord) {
  const source = sourceTextForAnalysis(record);
  const issues: string[] = [];
  if (!source.trim()) issues.push("Source body or transcript missing.");
  if (record.material_status !== "captured") issues.push("Source not captured.");
  if (record.key_claims.length === 0) issues.push("At least one claim is required.");
  if (record.evidence.length === 0) issues.push("At least one source evidence reference is required.");
  for (const item of [...record.evidence, ...record.key_claims.flatMap((claim) => claim.evidence)]) {
    if (!item.source || !item.text_reference || !findAnalysisEvidence(source, item.text_reference)) {
      issues.push("Evidence excerpt must appear verbatim in source text.");
    }
  }
  return [...new Set(issues)];
}

export async function createCloudSourceState(record: SourceRecord, at: string): Promise<CloudSourceState> {
  assertRecord(record);
  const when = validTimestamp(at);
  const draft = clone({
    ...record,
    review_status: "needs_review" as const,
    approval_status: "not_approved" as const,
  });
  const digest = await fingerprint(draft);
  return {
    schema_version: 1,
    source_id: draft.id,
    server_revision: 1,
    revisions: [{ revision: 1, fingerprint: digest, record: draft, changed_at: when }],
    reviewed_fingerprint: null,
    approved_for_daily: null,
    approved_for_reuse: null,
    events: [{ kind: "captured", source_revision: 1, fingerprint: digest, occurred_at: when }],
  };
}

export function getCloudSourceRevision(state: CloudSourceState): CloudSourceRevision {
  return clone(current(state));
}

export function cloudApprovals(state: CloudSourceState) {
  const digest = current(state).fingerprint;
  return {
    reviewed: state.reviewed_fingerprint === digest,
    daily: state.approved_for_daily?.fingerprint === digest,
    reuse: state.approved_for_reuse?.fingerprint === digest,
  };
}

export async function editCloudSourceState(
  state: CloudSourceState, expectedRevision: number, record: SourceRecord, at: string,
): Promise<CloudSourceState> {
  guardRevision(state, expectedRevision);
  const when = validTimestamp(at);
  assertRecord(record, state.source_id);
  const draft = clone({ ...record, review_status: "needs_review" as const, approval_status: "not_approved" as const });
  const digest = await fingerprint(draft);
  const updated = append(state, draft, "edited", when, digest);
  return { ...updated, reviewed_fingerprint: null, approved_for_daily: null, approved_for_reuse: null };
}

export function reviewCloudSourceState(
  state: CloudSourceState, expectedRevision: number, at: string,
): CloudSourceState {
  const latest = guardRevision(state, expectedRevision);
  const when = validTimestamp(at);
  const issues = evidenceIssues(latest.record);
  if (issues.length > 0) throw new Error("Cannot review: " + issues.join(" "));
  const record = clone({ ...latest.record, review_status: "reviewed" as const, approval_status: "not_approved" as const });
  const updated = append(state, record, "reviewed", when, latest.fingerprint);
  return { ...updated, reviewed_fingerprint: latest.fingerprint, approved_for_daily: null, approved_for_reuse: null };
}

export function rejectCloudSourceState(
  state: CloudSourceState, expectedRevision: number, at: string,
): CloudSourceState {
  const latest = guardRevision(state, expectedRevision);
  const when = validTimestamp(at);
  const record = clone({ ...latest.record, review_status: "rejected" as const, approval_status: "not_approved" as const });
  const updated = append(state, record, "rejected", when, latest.fingerprint);
  return { ...updated, reviewed_fingerprint: null, approved_for_daily: null, approved_for_reuse: null };
}

export function approveCloudSourceState(
  state: CloudSourceState, expectedRevision: number, kind: CloudApprovalKind, at: string,
  dailyMetadata?: DailyCandidateMetadata,
): CloudSourceState {
  const latest = guardRevision(state, expectedRevision);
  const when = validTimestamp(at);
  if (state.reviewed_fingerprint !== latest.fingerprint || latest.record.review_status !== "reviewed") {
    throw new Error("Cloud approval requires explicit current-version human review.");
  }
  if (latest.record.evidence_grade === "ungraded") {
    throw new Error("Evidence Grade must be assessed by a human.");
  }
  const issues = evidenceIssues(latest.record);
  if (issues.length > 0) throw new Error("Evidence is incomplete: " + issues.join(" "));
  const approvedRecord = clone({ ...latest.record, approval_status: "approved" as const });
  const blockers = kind === "source_reuse"
    ? getReusableSourceBlockers(approvedRecord)
    : getDailyCandidateBlockers(approvedRecord, dailyMetadata);
  if (blockers.length > 0) throw new Error("Approval blocked: " + blockers.join("; "));
  const action = kind === "source_reuse" ? "approved_for_reuse" : "approved_for_daily";
  // Approval exists only in the matching typed event. Never set the shared
  // SourceRecord approval_status here: daily approval must not authorize reuse.
  const updated = append(state, latest.record, action, when, latest.fingerprint);
  const approval = { revision: updated.server_revision, fingerprint: latest.fingerprint, approved_at: when };
  return kind === "source_reuse"
    ? { ...updated, approved_for_reuse: approval }
    : { ...updated, approved_for_daily: approval };
}

/** Build an explicitly scoped approved snapshot; never infer the other approval kind. */
export function getApprovedCloudSourceRecord(state: CloudSourceState, kind: CloudApprovalKind): SourceRecord {
  const currentRecord = current(state);
  const approvals = cloudApprovals(state);
  if (state.reviewed_fingerprint !== currentRecord.fingerprint
    || currentRecord.record.review_status !== "reviewed"
    || !(kind === "source_reuse" ? approvals.reuse : approvals.daily)) {
    throw new Error("Explicit current-version approval for requested downstream scope is required.");
  }
  return clone({ ...currentRecord.record, approval_status: "approved" as const });
}
