/**
 * Phase 1.2C opt-in workbench sync protocol candidate.
 * Pure functions only: no network calls, credentials or persistence.
 *
 * IMPORTANT: Cloudflare protected Preview is SYNTHETIC_ONLY. This protocol
 * must NOT be connected to it with actual SourceRecords without fresh consent,
 * verified same-origin access and a production-ready import/security design.
 */
import { validateSourceRecord, type SourceRecord } from "./source-inbox.ts";
import { createApprovalSeal } from "./approval-integrity.ts";

export const CLOUD_SYNC_BINDING_VERSION = 1 as const;
export const CLOUD_SYNC_MAX_RECORD_BYTES = 100_000;
const CLOUD_ID = /^src_[0-9a-f]{32}$/;

export type CloudSyncBinding = {
  version: typeof CLOUD_SYNC_BINDING_VERSION;
  material_id: string;
  cloud_source_id: string;
  last_remote_revision: number | null;
  last_remote_fingerprint: string | null;
  last_synced_at: string | null;
};

export type CloudRemoteHead = {
  source_id: string;
  revision: number;
  fingerprint: string;
};

export type CloudSyncDecision = {
  kind: "create_requires_consent" | "push_requires_consent" | "in_sync"
    | "remote_newer_requires_backup" | "conflict_requires_manual_choice"
    | "remote_missing_requires_review" | "identity_conflict" | "blocked";
  can_upload_automatically: false;
  blockers: string[];
  local_fingerprint: string | null;
  remote_revision: number | null;
};

export type CloudConflictChoice = "keep_local_as_new_revision" | "restore_remote_to_new_local_draft"
  | "manual_merge" | "cancel";

/** Identity is generated once per local material, unrelated to source URL/text. */
export function newCloudBinding(materialId: string, id: string): CloudSyncBinding {
  if (!materialId.trim() || !CLOUD_ID.test(id)) {
    throw new Error("Cloud identity and material ID must be valid.");
  }
  return {
    version: CLOUD_SYNC_BINDING_VERSION,
    material_id: materialId,
    cloud_source_id: id,
    last_remote_revision: null,
    last_remote_fingerprint: null,
    last_synced_at: null,
  };
}

export function validCloudBinding(value: unknown): value is CloudSyncBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  return b.version === CLOUD_SYNC_BINDING_VERSION
    && typeof b.material_id === "string" && b.material_id.trim().length > 0 && b.material_id.length <= 256
    && typeof b.cloud_source_id === "string" && CLOUD_ID.test(b.cloud_source_id)
    && (b.last_remote_revision === null || (Number.isSafeInteger(b.last_remote_revision) && (b.last_remote_revision as number) >= 1))
    && (b.last_remote_fingerprint === null || (typeof b.last_remote_fingerprint === "string" && /^[0-9a-f]{64}$/.test(b.last_remote_fingerprint)))
    && ((b.last_remote_revision === null && b.last_remote_fingerprint === null)
      || (b.last_remote_revision !== null && b.last_remote_fingerprint !== null))
    && (b.last_synced_at === null || (typeof b.last_synced_at === "string" && Number.isFinite(Date.parse(b.last_synced_at))));
}

function readOnlyRecord(record: SourceRecord, cloudId: string): SourceRecord {
  // A draft must NEVER import legacy global workbench approval flags.
  // Approval in cloud is scoped to its own immutable human-reviewed event.
  return structuredClone({
    ...record,
    id: cloudId,
    review_status: "needs_review" as const,
    approval_status: "not_approved" as const,
  });
}

export async function prepareWorkbenchSource(
  source: SourceRecord, binding: CloudSyncBinding,
): Promise<{ record: SourceRecord; fingerprint: string; blockers: string[]; approx_bytes: number }> {
  if (!validCloudBinding(binding)) throw new Error("Invalid cloud binding.");
  const record = readOnlyRecord(source, binding.cloud_source_id);
  // Keep unknown/invalid fields out of the production candidate. Structured
  // validation is not a substitute for human evidence / data-governance review.
  const blockers = validateSourceRecord(record);
  if (!record.raw_text?.trim() && !record.transcript?.trim()) blockers.push("source_text_missing");
  if (record.material_status !== "captured") blockers.push("source_not_captured");
  if (record.analysis.status === "processing") blockers.push("analysis_in_progress");
  if (!record.evidence?.length) blockers.push("evidence_missing");
  if (!record.key_claims?.length) blockers.push("reviewed_claims_missing");
  const approx_bytes = new TextEncoder().encode(JSON.stringify(record)).length;
  if (approx_bytes > CLOUD_SYNC_MAX_RECORD_BYTES) blockers.push("source_too_large");
  const { review_status: _reviewStatus, approval_status: _approvalStatus, ...approvalPayload } = record;
  const fingerprint = await createApprovalSeal(approvalPayload);
  return { record, fingerprint, blockers: [...new Set(blockers)], approx_bytes };
}

/**
 * Four-way reconciliation using last ACKED server revision and content
 * fingerprint. No last-write-wins, auto-push or auto-download.
 */
export function decideCloudSync(params: {
  binding: CloudSyncBinding;
  localFingerprint: string;
  localBlockers: string[];
  remote: CloudRemoteHead | null;
}): CloudSyncDecision {
  const { binding, localFingerprint, localBlockers, remote } = params;
  if (!validCloudBinding(binding)) throw new Error("Invalid cloud binding.");
  if (!/^[0-9a-f]{64}$/.test(localFingerprint)) throw new Error("Invalid source fingerprint.");
  const base = {
    can_upload_automatically: false as const,
    blockers: [...localBlockers],
    local_fingerprint: localFingerprint,
    remote_revision: remote?.revision ?? null,
  };
  if (localBlockers.length) return { ...base, kind: "blocked" };
  if (remote && (remote.source_id !== binding.cloud_source_id
    || !Number.isSafeInteger(remote.revision) || remote.revision < 1
    || !/^[0-9a-f]{64}$/.test(remote.fingerprint))) {
    return { ...base, kind: "identity_conflict" };
  }
  if (!binding.last_remote_revision && !remote) return { ...base, kind: "create_requires_consent" };
  if (binding.last_remote_revision && !remote) return { ...base, kind: "remote_missing_requires_review" };
  if (!remote) return { ...base, kind: "identity_conflict" };
  if (!binding.last_remote_revision) return { ...base, kind: "identity_conflict" };
  const remoteChanged = remote.revision !== binding.last_remote_revision
    || remote.fingerprint !== binding.last_remote_fingerprint;
  const localChanged = localFingerprint !== binding.last_remote_fingerprint;
  if (remoteChanged && localChanged) return { ...base, kind: "conflict_requires_manual_choice" };
  if (remoteChanged) return { ...base, kind: "remote_newer_requires_backup" };
  if (localChanged) return { ...base, kind: "push_requires_consent" };
  return { ...base, kind: "in_sync" };
}

/** Persist only after an independently verified successful server acknowledgement. */
export function acknowledgeCloudSync(
  binding: CloudSyncBinding, head: CloudRemoteHead, when: string,
): CloudSyncBinding {
  if (!validCloudBinding(binding) || head.source_id !== binding.cloud_source_id
    || !Number.isSafeInteger(head.revision) || head.revision < 1
    || !/^[0-9a-f]{64}$/.test(head.fingerprint)
    || !Number.isFinite(Date.parse(when))) throw Error("Invalid cloud sync acknowledgement.");
  if (binding.last_remote_revision !== null && head.revision < binding.last_remote_revision) {
    throw Error("Cloud revision cannot move backwards.");
  }
  return { ...binding, last_remote_revision: head.revision, last_remote_fingerprint: head.fingerprint,
    last_synced_at: new Date(when).toISOString() };
}

/**
 * No merge performed here: conflict choice must be human selected and a fresh
 * encrypted/local backup must be taken before applying any remote record.
 */
export function resolveCloudConflict(
  choice: CloudConflictChoice,
  opts: { backupVerified: boolean; remoteFetched: boolean; sameSourceId: boolean },
) {
  if (choice === "cancel") return { action: "no_change" as const };
  if (!opts.backupVerified) throw Error("Verified local backup required before conflict resolution.");
  if (!opts.sameSourceId || !opts.remoteFetched) throw Error("Verified remote record required.");
  if (choice === "manual_merge") return { action: "manual_diff_only" as const };
  if (choice === "restore_remote_to_new_local_draft") return { action: "stage_remote_draft_only" as const };
  // Even keep-local does not issue a remote update, since server revision
  // must be freshly read and the user must reconfirm current evidence.
  return { action: "stage_local_reapproval_only" as const };
}
