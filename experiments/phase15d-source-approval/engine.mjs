/**
 * Phase1.5D: deterministic shadow approval / onboarding packet.
 * A review CANDIDATE is NOT a legal permission, cryptographic signature,
 * server-persisted Access identity or authority to upload real sources.
 */
import {ATTESTATIONS,evaluateGovernance,HEX64,SOURCE_ID,POLICY_VERSION} from "../phase15c-real-governance/engine.mjs";
export const APPROVAL_POLICY="phase15d-shadow-approval-v1";
export const MAX_PACKET_AGE_MS=24*60*60*1000;
const ISSUE=(code)=>({code});
const safeRef=(text)=>typeof text==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{3,79}$/.test(text);
const concise=(text)=>typeof text==="string"&&text.length<=70&&/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{2,69}$/.test(text);
const uniq=values=>[...new Set(values)];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const CONTROL_KEYS=ATTESTATIONS.map(([k])=>k);
export function assessOnboarding({
 record,source_sha256,backup_sha256,governance_report,governance_report_sha256,
 rights={},privacy={},owner={},now
}={}){
 const blockers=[],unknown=[],pending=[];
 const at=typeof now==="string"&&Number.isFinite(Date.parse(now))?new Date(now):new Date();
 const expires_at=new Date(at.getTime()+MAX_PACKET_AGE_MS).toISOString();
 if(!record||typeof record!=="object"||Array.isArray(record)||!SOURCE_ID.test(record.id??""))
  blockers.push(ISSUE("invalid_source_record"));
 if(!HEX64.test(source_sha256??"")||source_sha256!==backup_sha256)
  blockers.push(ISSUE("source_original_backup_mismatch"));
 if(!HEX64.test(governance_report_sha256??""))blockers.push(ISSUE("governance_report_hash_missing"));
 const report=governance_report&&typeof governance_report==="object"&&!Array.isArray(governance_report)
  ?governance_report:null;
 if(!report||report.policy_version!==POLICY_VERSION||
   report.source_id!==record?.id||report.source_sha256!==source_sha256)
  blockers.push(ISSUE("governance_packet_source_binding_failed"));
 const reportControls=Array.isArray(report?.attested_controls)?report.attested_controls:[];
 if(reportControls.length!==CONTROL_KEYS.length||
   !eq([...reportControls].sort(),[...CONTROL_KEYS].sort()))
  blockers.push(ISSUE("governance_attestations_incomplete"));
 const computed=evaluateGovernance({
  record,file_sha256:source_sha256,backup_sha256,
  attestations:Object.fromEntries(reportControls.map(k=>[k,true]))
 });
 if(computed.decision!=="LOCAL_GOVERNANCE_REVIEWED"||
    report?.decision!=="LOCAL_GOVERNANCE_REVIEWED"||
    report?.cloud_write_authorized!==false||
    report?.real_upload_enabled!==false||
    !eq((report?.blockers??[]).map(x=>x.code).sort(),computed.blockers.map(x=>x.code).sort())||
    !eq((report?.unknown??[]).map(x=>x.code).sort(),computed.unknown.map(x=>x.code).sort())||
    !eq((report?.pending??[]).map(x=>x.code).sort(),computed.pending.map(x=>x.code).sort()))
  blockers.push(ISSUE("governance_revalidation_failed"));
 if(report?.source_sha256!==source_sha256)
  blockers.push(ISSUE("stale_governance_hash"));
 if(rights.basis!=="owner_original"&&rights.basis!=="explicit_license"&&
    rights.basis!=="permission_record"&&rights.basis!=="public_domain_checked")
  pending.push(ISSUE("rights_legal_basis_review"));
 if(!safeRef(rights.evidence_ref))pending.push(ISSUE("rights_evidence_reference"));
 if(!concise(rights.reviewer_ref))pending.push(ISSUE("rights_reviewer_unverified"));
 if(rights.confirmed!==true)pending.push(ISSUE("rights_approval_acknowledgement"));
 if(privacy.classification!=="public_non_sensitive")
  pending.push(ISSUE("privacy_data_classification"));
 if(!safeRef(privacy.evidence_ref))pending.push(ISSUE("privacy_evidence_reference"));
 if(!concise(privacy.reviewer_ref))pending.push(ISSUE("privacy_reviewer_unverified"));
 if(privacy.confirmed!==true)pending.push(ISSUE("privacy_approval_acknowledgement"));
 if(rights.reviewer_ref&&rights.reviewer_ref===privacy.reviewer_ref)
  unknown.push(ISSUE("independent_reviewer_not_established"));
 if(!safeRef(owner.owner_ref))pending.push(ISSUE("owner_reference"));
 if(owner.exact_file_ack!==true||owner.seven_day_scope_ack!==true||
    owner.no_cloud_write_ack!==true||owner.deletion_backup_residual_ack!==true)
  pending.push(ISSUE("owner_scope_consent_missing"));
 if(record?.approval_status==="approved"||record?.review_status==="reviewed")
  unknown.push(ISSUE("existing_local_approval_must_not_transfer"));
 const ready=blockers.length===0&&unknown.length===0&&pending.length===0;
 // Even all local controls do not verify authorization or separate people.
 const result={
  packet_version:1,policy_version:APPROVAL_POLICY,
  decision:ready?"SHADOW_APPROVAL_CANDIDATE":"HOLD",
  cloud_write_authorized:false,real_upload_enabled:false,
  server_approval_recorded:false,identities_verified:false,signature_verified:false,
  signed_at:null,consent_scope:"one-source-one-exact-byte-sha-shadow-review-only",
  source_id:SOURCE_ID.test(record?.id??"")?record.id:null,
  source_sha256:HEX64.test(source_sha256??"")?source_sha256:null,
  governance_report_sha256:HEX64.test(governance_report_sha256??"")?governance_report_sha256:null,
  source_backup_sha256:HEX64.test(backup_sha256??"")?backup_sha256:null,
  reviewed_at:at.toISOString(),review_expires_at:expires_at,
  requested_cloud_retention_days:7,reviewers:{
   rights:concise(rights.reviewer_ref)?rights.reviewer_ref:null,
   privacy:concise(privacy.reviewer_ref)?privacy.reviewer_ref:null,
   owner:safeRef(owner.owner_ref)?owner.owner_ref:null,
  },assessment_evidence:{
   rights_basis:["owner_original","explicit_license","permission_record","public_domain_checked"].includes(rights.basis)?rights.basis:null,
   rights_ref:safeRef(rights.evidence_ref)?rights.evidence_ref:null,
   privacy_classification:privacy.classification==="public_non_sensitive"?privacy.classification:null,
   privacy_ref:safeRef(privacy.evidence_ref)?privacy.evidence_ref:null,
  },
  blockers:uniq(blockers.map(x=>x.code)),unknown:uniq(unknown.map(x=>x.code)),
  pending:uniq(pending.map(x=>x.code)),
  next_action:ready?
   "請求獨立身份／權利核實、版權私隱及備份證據覆核與個別 Owner GO；不允許上傳。":
   "處理所有 HOLD／UNKNOWN／未完成覆核項，再重新產生針對相同 SHA 的審批候選。"
 };
 return result;
}
/**
 * Offline freshness/integrity check for an exported shadow packet.
 * Local, unsigned and mutable file cannot prove who approved it.
 */
export function validateShadowPacket(packet,{source_id,source_sha256,now}={}){
 const issues=[];
 if(!packet||typeof packet!=="object"||Array.isArray(packet)||
   packet.policy_version!==APPROVAL_POLICY)issues.push("packet_policy_mismatch");
 if(packet?.cloud_write_authorized!==false||packet?.real_upload_enabled!==false||
   packet?.server_approval_recorded!==false||packet?.signature_verified!==false)
  issues.push("packet_claims_unverified_authority");
 if(packet?.source_id!==source_id||packet?.source_sha256!==source_sha256)
  issues.push("packet_source_sha_mismatch");
 const t=typeof now==="string"?Date.parse(now):Date.now();
 const start=Date.parse(packet?.reviewed_at??"");
 const end=Date.parse(packet?.review_expires_at??"");
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start!==MAX_PACKET_AGE_MS||
  start>t||end<=t)issues.push("packet_expired_or_invalid");
 if(packet?.decision!=="SHADOW_APPROVAL_CANDIDATE")issues.push("packet_not_reviewed");
 return {valid:issues.length===0,cloud_write_authorized:false,issues};
}

/**
 * Only safe public entry for real file-based UI approvals:
 * derive hashes from ACTUAL bytes, not user-claimed fingerprints.
 * Fail closed before ever preparing a shadow candidate.
 */
export async function assessBoundFiles({
 source_bytes,backup_bytes,governance_report_bytes,rights,privacy,owner,now
}={}){
 const view=bytes=>{
  if(bytes instanceof ArrayBuffer)return new Uint8Array(bytes);
  if(ArrayBuffer.isView(bytes))return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return null;
 };
 const original=view(source_bytes),copy=view(backup_bytes),reportBytes=view(governance_report_bytes);
 const fail=code=>({
  packet_version:1,policy_version:APPROVAL_POLICY,decision:"HOLD",
  cloud_write_authorized:false,real_upload_enabled:false,
  server_approval_recorded:false,identities_verified:false,signature_verified:false,
  source_id:null,source_sha256:null,governance_report_sha256:null,
  blockers:[code],unknown:[],pending:[],next_action:"原始檔案／備份／治理報告未能完成位元級驗證，不可產生候選或同步。"
 });
 if(!original||!copy||!reportBytes||
   !original.length||original.length>80_000||
   copy.length!==original.length||reportBytes.length>40_000||!reportBytes.length)
  return fail("invalid_file_bytes_or_size");
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
  .map(x=>x.toString(16).padStart(2,"0")).join("");
 const sourceSha=await digest(original),backupSha=await digest(copy);
 if(sourceSha!==backupSha)return fail("source_original_backup_sha_mismatch");
 let record,report;
 try{
  const decoder=new TextDecoder("utf-8",{fatal:true});
  record=JSON.parse(decoder.decode(original));
  report=JSON.parse(decoder.decode(reportBytes));
 }catch{return fail("unparseable_json_or_encoding")}
 const reportSha=await digest(reportBytes);
 return assessOnboarding({record,source_sha256:sourceSha,backup_sha256:backupSha,
  governance_report:report,governance_report_sha256:reportSha,
  rights,privacy,owner,now});
}
