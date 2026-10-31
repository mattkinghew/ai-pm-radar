import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {FIXTURE_RECORDS} from "../phase15-source-sync/fixtures.mjs";
import {ATTESTATIONS,evaluateGovernance} from "../phase15c-real-governance/engine.mjs";
import {APPROVAL_POLICY,MAX_PACKET_AGE_MS,assessOnboarding,assessBoundFiles,validateShadowPacket} from "./engine.mjs";
const record=()=>structuredClone(FIXTURE_RECORDS[0]);
const hash=x=>createHash("sha256").update(typeof x==="string"?x:JSON.stringify(x)).digest("hex");
const attested=Object.fromEntries(ATTESTATIONS.map(([k])=>[k,true]));
const date="2026-10-15T10:00:00.000Z";
function valid(){
 const source=record(),s=hash(source);
 const report={...evaluateGovernance({record:source,file_sha256:s,backup_sha256:s,
  attestations:attested}),attested_controls:Object.keys(attested)};
 return {record:source,source_sha256:s,backup_sha256:s,governance_report:report,
  governance_report_sha256:hash(report),now:date,
  rights:{basis:"owner_original",evidence_ref:"rights-001",
   reviewer_ref:"Rights Auditor 1",confirmed:true},
  privacy:{classification:"public_non_sensitive",evidence_ref:"privacy-001",
   reviewer_ref:"Privacy Auditor 2",confirmed:true},
  owner:{owner_ref:"owner-check-001",exact_file_ack:true,seven_day_scope_ack:true,
   no_cloud_write_ack:true,deletion_backup_residual_ack:true}};
}
test("full local independent shadow review produces candidate but NEVER cloud permit",()=>{
 const report=assessOnboarding(valid());
 assert.equal(report.policy_version,APPROVAL_POLICY);
 assert.equal(report.decision,"SHADOW_APPROVAL_CANDIDATE");
 assert.equal(report.cloud_write_authorized,false);
 assert.equal(report.real_upload_enabled,false);
 assert.equal(report.server_approval_recorded,false);
 assert.equal(report.identities_verified,false);
 assert.equal(report.signature_verified,false);
 assert.equal(report.signed_at,null);
 assert.deepEqual([report.blockers,report.unknown,report.pending],[[],[],[]]);
 assert.equal(Date.parse(report.review_expires_at)-Date.parse(report.reviewed_at),MAX_PACKET_AGE_MS);
 assert.equal(validateShadowPacket(report,{
  source_id:report.source_id,source_sha256:report.source_sha256,
  now:"2026-10-15T11:00:00.000Z"}).valid,true);
});
test("source edit with same old governance report or mismatching offline backup HOLD",()=>{
 const baseline=valid();
 for(const c of [
  {...baseline,source_sha256:"0".repeat(64)},
  {...baseline,backup_sha256:"0".repeat(64)},
  {...baseline,governance_report_sha256:null}
 ]){
  const r=assessOnboarding(c);
  assert.equal(r.decision,"HOLD");
  assert.equal(r.cloud_write_authorized,false);
 }
});
test("tampered Phase1.5C result and forged attestation flags cannot bypass revalidation",()=>{
 const b=valid();
 for(const mutated of [
  {...b.governance_report,decision:"HOLD"},
  {...b.governance_report,cloud_write_authorized:true},
  {...b.governance_report,real_upload_enabled:true},
  {...b.governance_report,attested_controls:["rights"]},
  {...b.governance_report,blockers:[{code:"nope"}]},
  {...b.governance_report,source_id:"src_"+"0".repeat(32)},
  {...b.governance_report,source_sha256:"1".repeat(64)}
 ]){
  const result=assessOnboarding({...b,governance_report:mutated,
   governance_report_sha256:hash(mutated)});
  assert.equal(result.decision,"HOLD");
  assert.ok(result.blockers.length>0);
 }
});
test("rights/privacy reviewer details must be distinct and evidence references present",()=>{
 const b=valid();
 for(const change of [
  {rights:{...b.rights,basis:"public_on_web"}},
  {rights:{...b.rights,evidence_ref:""}},
  {privacy:{...b.privacy,evidence_ref:"no spaces allowed"}},
  {privacy:{...b.privacy,classification:"unknown"}},
  {rights:{...b.rights,confirmed:false}},
  {privacy:{...b.privacy,reviewer_ref:b.rights.reviewer_ref}},
  {owner:{...b.owner,no_cloud_write_ack:false}}
 ]){
  const result=assessOnboarding({...b,...change});
  assert.equal(result.decision,"HOLD");
  assert.ok(result.pending.length+result.unknown.length>0);
 }
});
test("old approval, secret signals or missing evidence cannot inherit governance status",()=>{
 const b=valid();
 for(const patch of [
  {approval_status:"approved"},
  {review_status:"reviewed"},
  {raw_text:b.record.raw_text+" private.mail@example.org"},
  {evidence:[]}
 ]){
  const r=assessOnboarding({...b,record:{...b.record,...patch}});
  assert.equal(r.decision,"HOLD");
  assert.equal(r.cloud_write_authorized,false);
 }
});
test("expiry, backdating and altered packet approval flag invalidates shadow packet",()=>{
 const packet=assessOnboarding(valid());
 for(const candidate of [
  {value:packet,when:"2026-10-16T10:00:00.000Z"},
  {value:packet,when:"2026-10-14T10:00:00.000Z"},
  {value:{...packet,cloud_write_authorized:true},when:"2026-10-15T11:00:00Z"},
  {value:{...packet,source_sha256:"0".repeat(64)},when:"2026-10-15T11:00:00Z"},
  {value:{...packet,review_expires_at:"2099-10-15T10:00:00Z"},when:"2026-10-15T11:00:00Z"}
 ]){
  assert.equal(validateShadowPacket(candidate.value,{source_id:packet.source_id,
   source_sha256:packet.source_sha256,now:candidate.when}).valid,false);
 }
});
test("incomplete malformed source/report does not accidentally issue permission",()=>{
 const b=valid();
 for(const c of [{...b,record:null},{...b,governance_report:null},
  {...b,governance_report:{}},{...b,record:[]},{...b,rights:{}},{...b,privacy:{}},{...b,owner:{}}]){
  const r=assessOnboarding(c);
  assert.equal(r.cloud_write_authorized,false);
  assert.equal(r.decision,"HOLD");
 }
});

test("official byte-bound entry rejects edited original and fake reused report hash",async()=>{
 const baseline=valid();
 const encode=x=>new TextEncoder().encode(JSON.stringify(x));
 const kwargs={source_bytes:encode(baseline.record),backup_bytes:encode(baseline.record),
  governance_report_bytes:encode(baseline.governance_report),
  rights:baseline.rights,privacy:baseline.privacy,owner:baseline.owner,now:date};
 const good=await assessBoundFiles(kwargs);
 assert.equal(good.decision,"SHADOW_APPROVAL_CANDIDATE");
 assert.equal(good.cloud_write_authorized,false);
 for(const alteration of [
  {source_bytes:encode({...baseline.record,summary:"tampered"})},
  {backup_bytes:encode({...baseline.record,summary:"tampered"})},
  {governance_report_bytes:encode({...baseline.governance_report,source_sha256:"0".repeat(64)})},
  {source_bytes:new Uint8Array(0)},
  {governance_report_bytes:new TextEncoder().encode("not json")},
 ]){
  const result=await assessBoundFiles({...kwargs,...alteration});
  assert.equal(result.decision,"HOLD");
  assert.equal(result.cloud_write_authorized,false);
 }
});
