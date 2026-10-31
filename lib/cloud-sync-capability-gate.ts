/**
 * Phase 1.2C fail-closed handshake contract for a FUTURE same-origin cloud
 * gateway. This module has NO fetch calls or cloud side effects.
 *
 * Current Phase1.2B Worker is SYNTHETIC_ONLY and DOES NOT return these
 * capabilities. Therefore no real SourceRecord can pass this gate.
 */
import type {SourceRecord} from "./source-inbox.ts";
import type {CloudSyncBinding, CloudSyncDecision} from "./cloud-workbench-sync.ts";
import { assertApprovalIntegrity } from "./approval-integrity.ts";

export type CloudSyncCapabilities = {
  api_version: 1;
  source_record_version: 2;
  source_library_version: 4;
  access_enforced: true;
  synthetic_only: false;
  expected_revision_required: true;
  real_sources_opt_in: true;
  human_approval_required: true;
  max_record_bytes: number;
};

export type CloudWriteConsent = {
  granted: true;
  cloud_source_id: string;
  local_fingerprint: string;
  verified_local_backup: true;
  rights_confirmed: true;
  seven_day_retention_accepted: true;
  time_travel_residual_accepted: true;
  requested_at: string;
};

export function requireCloudCapabilities(
  pageOrigin: string, apiUrl: string, raw: unknown,
): CloudSyncCapabilities {
  const page = new URL(pageOrigin);
  const endpoint = new URL(apiUrl,page);
  if(page.protocol!=="https:" && page.hostname!=="127.0.0.1" && page.hostname!=="localhost"){
    throw new Error("Cloud sync requires a secure page origin.");
  }
  if(endpoint.origin!==page.origin){
    throw new Error("Cloud API must be reached through a protected same-origin gateway.");
  }
  if(endpoint.pathname!=="/api/cloud/capabilities"){
    throw new Error("Cloud capabilities must come from the exact authenticated route.");
  }
  if(!raw||typeof raw!=="object"||Array.isArray(raw)){
    throw new Error("Cloud capabilities are missing.");
  }
  const data=raw as Record<string,unknown>;
  for(const [key,value] of Object.entries({
    api_version:1,source_record_version:2,source_library_version:4,
    access_enforced:true,synthetic_only:false,expected_revision_required:true,
    real_sources_opt_in:true,human_approval_required:true,
  })){
    if(data[key]!==value)throw new Error("Cloud API readiness gate blocked: "+key);
  }
  if(!Number.isSafeInteger(data.max_record_bytes)||Number(data.max_record_bytes)<1024
     ||Number(data.max_record_bytes)>1_000_000){
    throw new Error("Cloud max payload policy missing.");
  }
  return data as CloudSyncCapabilities;
}

/**
 * Return a REQUEST PLAN, not execute it. A real upload is separately gated
 * by explicit Owner consent, a verified backup, current server head and
 * a server-enforced Access session. Callers must never auto-send this plan.
 */
export async function planExplicitCloudWrite(params:{
  record:SourceRecord;
  binding:CloudSyncBinding;
  localFingerprint:string;
  approxBytes:number;
  decision:CloudSyncDecision;
  capabilities:CloudSyncCapabilities;
  consent:CloudWriteConsent|null;
  now:string;
}) {
  const {record,binding,localFingerprint,approxBytes,decision,capabilities,consent,now}=params;
  const {review_status: _reviewStatus, approval_status: _approvalStatus, ...approvalPayload} = record;
  await assertApprovalIntegrity(approvalPayload, localFingerprint);
  if(!consent || consent.granted!==true || consent.verified_local_backup!==true
    || consent.rights_confirmed!==true || consent.seven_day_retention_accepted!==true
    || consent.time_travel_residual_accepted!==true
    || consent.cloud_source_id!==binding.cloud_source_id
    || consent.local_fingerprint!==localFingerprint
    || !Number.isFinite(Date.parse(now))
    || !Number.isFinite(Date.parse(consent.requested_at))
    || Math.abs(Date.parse(now)-Date.parse(consent.requested_at))>15*60_000){
    throw new Error("Fresh, source-specific Owner consent and verified backup required.");
  }
  if(capabilities.synthetic_only!==false || capabilities.real_sources_opt_in!==true
    || capabilities.access_enforced!==true || capabilities.expected_revision_required!==true){
    throw new Error("Production cloud data policy is not enabled.");
  }
  if(record.id!==binding.cloud_source_id || !/^[a-f0-9]{64}$/.test(localFingerprint)){
    throw new Error("Record/cloud identity mismatch.");
  }
  if(approxBytes>capabilities.max_record_bytes)throw new Error("Cloud record exceeds server payload cap.");
  if(decision.can_upload_automatically!==false || decision.blockers.length>0){
    throw new Error("Sync decision not eligible.");
  }
  if(decision.kind==="create_requires_consent" && binding.last_remote_revision===null){
    return {method:"POST" as const,path:"/api/cloud/records",body:{
      source_id:binding.cloud_source_id,record,
      authorization:{source_id:binding.cloud_source_id,content_sha256:localFingerprint,
        backup_verified:true,rights_confirmed:true,seven_day_retention_accepted:true,
        time_travel_residual_acknowledged:true},
    }};
  }
  if(decision.kind==="push_requires_consent" && binding.last_remote_revision!==null){
    return {method:"PUT" as const,path:"/api/cloud/records/"+binding.cloud_source_id,
      body:{expectedRevision:binding.last_remote_revision,expectedSha256:binding.last_remote_fingerprint,
        record,authorization:{source_id:binding.cloud_source_id,content_sha256:localFingerprint,
          backup_verified:true,rights_confirmed:true,seven_day_retention_accepted:true,
          time_travel_residual_acknowledged:true}}};
  }
  throw new Error("Conflict or missing remote state requires explicit manual resolution.");
}
