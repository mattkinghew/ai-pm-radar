/**
 * Phase 1.3 SINGLE-ARTICLE REAL DATA preflight.
 *
 * STRICTLY LOCAL and fail-closed. Imports NO browser, Cloudflare or network
 * implementation. Do not log, transmit, persist or return article contents.
 * This check is necessary but NOT sufficient for real-data deployment.
 */
import type { SourceRecord } from "./source-inbox.ts";
import { validateSourceRecord } from "./source-inbox.ts";
import { sourceRecordFingerprint } from "./source-library.ts";
import { findAnalysisEvidence, sourceTextForAnalysis } from "./ai-analysis.ts";

export const REAL_PILOT_MAX_BYTES = 100_000;
export const REAL_PILOT_MAX_ARTICLES = 1 as const;
export const REAL_PILOT_MAX_RETENTION_DAYS = 7 as const;

export type RealPilotRiskAttestation = {
  owner_has_right_to_cloud_store: boolean;
  public_or_owned_source: boolean;
  no_employer_customer_confidentiality: boolean;
  no_personal_or_sensitive_data: boolean;
  original_local_backup_verified: boolean;
  original_local_backup_restored_in_test: boolean;
  retention_and_deletion_terms_accepted: boolean;
  accepts_cloud_backup_residual_window: boolean;
  source_specific_cloud_upload_authorized: boolean;
};

export const REQUIRED_PILOT_ATTESTATIONS: readonly (keyof RealPilotRiskAttestation)[] = [
  "owner_has_right_to_cloud_store",
  "public_or_owned_source",
  "no_employer_customer_confidentiality",
  "no_personal_or_sensitive_data",
  "original_local_backup_verified",
  "original_local_backup_restored_in_test",
  "retention_and_deletion_terms_accepted",
  "accepts_cloud_backup_residual_window",
  "source_specific_cloud_upload_authorized",
] as const;

export type RealPilotPreflight = {
  schema: "radar-real-pilot-preflight-v1";
  outcome: "BLOCKED" | "READY_FOR_SERVER_GATES";
  // No article/source text, email, URL, title, creator or tokens in output.
  blockers: string[];
  source_bytes: number;
  evidence_references_checked: number;
  claim_count: number;
  record_content_sha256: string | null;
  content_fingerprint_sha256: string | null;
  record_version: number | null;
  // Approvals from legacy local Workbench MUST never be reused.
  proposed_cloud_review_status: "needs_review";
  proposed_cloud_approval_status: "not_approved";
  actual_cloud_upload_occurred: false;
};

/** Canonical JSON byte-for-byte backup payload, offline only. */
export function canonicalRealPilotRecord(record: SourceRecord, cloudId: string): SourceRecord {
  if (!/^src_[a-f0-9]{32}$/.test(cloudId)) throw Error("Invalid independent cloud source ID.");
  // Reset legacy global approvals in copy, preserve ORIGINAL local source.
  return JSON.parse(JSON.stringify({
    ...record,
    id: cloudId,
    review_status: "needs_review",
    approval_status: "not_approved",
  })) as SourceRecord;
}

async function sha(value: string): Promise<string> {
  const raw = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export async function inspectRealPilotCandidate(
  value: unknown,
  consent: Partial<RealPilotRiskAttestation> | null,
  cloudId: string,
):Promise<RealPilotPreflight>{
  const blockers: string[] = [];
  const missingAttestations=REQUIRED_PILOT_ATTESTATIONS.filter(key=>consent?.[key]!==true);
  for(const item of missingAttestations)blockers.push("consent_missing:"+item);
  let source_bytes=0, evidence_references_checked=0, claim_count=0;
  let contentHash: string|null=null,recordHash:string|null=null,version:number|null=null;
  if(!value||typeof value!=="object"||Array.isArray(value))blockers.push("source_record_missing");
  else {
    const record=value as SourceRecord;
    version=typeof record.record_version==="number"?record.record_version:null;
    try{
      const candidate=canonicalRealPilotRecord(record,cloudId);
      source_bytes=new TextEncoder().encode(JSON.stringify(candidate)).byteLength;
      if(source_bytes>REAL_PILOT_MAX_BYTES)blockers.push("source_exceeds_pilot_limit");
      const validation=validateSourceRecord(candidate);
      // Do not reveal source text in the diagnostics.
      if(validation.length)blockers.push("source_schema_validation_failed");
      if(candidate.material_status!=="captured")blockers.push("source_not_captured");
      if(candidate.analysis.status==="processing")blockers.push("analysis_pending");
      if(!sourceTextForAnalysis(candidate).trim())blockers.push("captured_text_missing");
      if(candidate.evidence.length===0)blockers.push("evidence_missing");
      if(candidate.key_claims.length===0)blockers.push("claims_missing");
      claim_count=candidate.key_claims.length;
      const checks=[...candidate.evidence,...candidate.key_claims.flatMap(c=>c.evidence)];
      const sourceText=sourceTextForAnalysis(candidate);
      for(const quote of checks){
        evidence_references_checked++;
        if(!quote?.text_reference||!findAnalysisEvidence(sourceText,quote.text_reference)){
          blockers.push("evidence_not_verbatim");
        }
      }
      // Hash the exact normalized proposed wire payload, never raw source for user-visible report.
      contentHash=await sha(sourceRecordFingerprint(candidate));
      recordHash=await sha(JSON.stringify(candidate));
    }catch {
      blockers.push("source_record_invalid_or_cloud_id_mismatch");
    }
  }
  const distinct=[...new Set(blockers)].sort();
  return {
    schema:"radar-real-pilot-preflight-v1",
    outcome: distinct.length?"BLOCKED":"READY_FOR_SERVER_GATES",
    blockers:distinct,source_bytes,evidence_references_checked,claim_count,
    record_content_sha256:recordHash,content_fingerprint_sha256:contentHash,
    record_version:version,
    proposed_cloud_review_status:"needs_review",
    proposed_cloud_approval_status:"not_approved",
    actual_cloud_upload_occurred:false,
  };
}

/**
 * Backup dry-run is always offline. Return only equality / checksums;
 * raw bytes are the caller's local responsibility (download, verify, retain).
 */
export async function testRealPilotBackupRoundTrip(record: SourceRecord,cloudId:string){
  const snapshot=canonicalRealPilotRecord(record,cloudId);
  const bytes=JSON.stringify({schema:"radar-real-pilot-backup-v1",record:snapshot});
  const digest=await sha(bytes);
  const decoded=JSON.parse(bytes) as {record:SourceRecord;schema:string};
  return {
    ok: decoded.schema==="radar-real-pilot-backup-v1"
      && decoded.record.id===cloudId
      && await sha(JSON.stringify({schema:decoded.schema,record:decoded.record}))===digest,
    backup_sha256:digest,
    backup_bytes:new TextEncoder().encode(bytes).length,
    cloud_candidate_approvals_reset:
      decoded.record.review_status==="needs_review" && decoded.record.approval_status==="not_approved",
  };
}
