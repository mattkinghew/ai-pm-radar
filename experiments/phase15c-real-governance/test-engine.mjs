import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {FIXTURE_RECORDS} from "../phase15-source-sync/fixtures.mjs";
import {POLICY_VERSION,ATTESTATIONS,evaluateGovernance,inspectRecord,sensitiveIndicators} from "./engine.mjs";
const input=()=>structuredClone(FIXTURE_RECORDS[0]);
const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const complete=()=>Object.fromEntries(ATTESTATIONS.map(([key])=>[key,true]));
function decision(record=input(),attestations=complete(),backup=true){
 const h=digest(record);
 return evaluateGovernance({record,file_sha256:h,
   backup_sha256:backup?h:"0".repeat(64),attestations});
}
test("synthetic clean sample can pass LOCAL review but NEVER authorizes cloud writes",()=>{
 const report=decision();
 assert.equal(report.policy_version,POLICY_VERSION);
 assert.equal(report.decision,"LOCAL_GOVERNANCE_REVIEWED");
 assert.equal(report.cloud_write_authorized,false);
 assert.equal(report.real_upload_enabled,false);
 assert.ok(report.claim_references>=2);
 assert.deepEqual(report.blockers,[]);
 assert.deepEqual(report.unknown,[]);
 assert.deepEqual(report.pending,[]);
 assert.ok(report.assumptions.length>=2);
});
test("default unknown attestations keep candidate on HOLD",()=>{
 const record=input(),h=digest(record);
 const result=evaluateGovernance({record,file_sha256:h,backup_sha256:h,attestations:{}});
 assert.equal(result.decision,"HOLD");
 assert.equal(result.pending.length,ATTESTATIONS.length);
 assert.equal(result.cloud_write_authorized,false);
});
test("mismatching backup and invalid original digest always blocked",()=>{
 const record=input();
 const broken=decision(record,complete(),false);
 assert.equal(broken.decision,"HOLD");
 assert.ok(broken.blockers.some(x=>x.code==="backup_unverified"));
 const noHash=evaluateGovernance({record,file_sha256:"",backup_sha256:"",attestations:complete()});
 assert.ok(noHash.blockers.some(x=>x.code==="missing_fingerprint"));
});
test("missing or inaccurate evidence is BLOCKED",()=>{
 for(const record of [
  {...input(),evidence:[]},
  {...input(),raw_text:"fabricated replacement"},
  {...input(),key_claims:[{claim:"Unsupported",evidence:[]}]},
 ]){
  const result=decision(record);
  assert.equal(result.decision,"HOLD");
  assert.ok(result.blockers.some(x=>["missing_evidence","invalid_text_reference","claim_without_evidence"].includes(x.code)));
 }
});
test("source captured and v2 and proper id must all be valid",()=>{
 for(const patch of [{record_version:7},{material_status:"capture_failed"},
    {id:"untrusted"},{analysis:null},{raw_text:"",transcript:null}]){
  const result=decision({...input(),...patch});
  assert.equal(result.decision,"HOLD");
  assert.ok(result.blockers.length>0);
 }
});
test("rights/source context UNKNOWN cannot be manually bypassed by toggling everything",()=>{
 for(const patch of [
  {rights_note:""}, {creator:null}, {source_url:null,source_url_final:null,source_url_original:null},
  {review_status:"reviewed"}, {approval_status:"approved"}, {case_candidate:true}
 ]){
  const result=decision({...input(),...patch});
  assert.equal(result.decision,"HOLD");
  assert.ok(result.unknown.length>0);
 }
});
test("sensitive patterns are fail-closed and do not send or record matching values",()=>{
 const samples=[
  ["test.person@real.example","email_pattern"],
  ["api_key: abcd1234sensitive","possible_secret"],
  ["A123456(3)","hkid_pattern"],
  ["+852 9123 4567","hk_mobile_pattern"],
  ["此機構資料保密","sensitive_keyword"]
 ];
 for(const [str,flag] of samples){
  assert.ok(sensitiveIndicators(str).includes(flag));
  const record={...input(),raw_text:input().raw_text+" "+str};
  const result=decision(record);
  assert.equal(result.decision,"HOLD");
  assert.ok(result.blockers.some(x=>x.code==="sensitivity_red_flags"));
  assert.ok(!JSON.stringify(result).includes(str));
 }
});
test("source reviewer gate never auto-adopts pre-existing approval",()=>{
 const report=decision({...input(),approval_status:"approved"});
 assert.equal(report.cloud_write_authorized,false);
 assert.ok(report.unknown.some(x=>x.code==="legacy_approval"));
});
test("malformed input handled without exception or leaking content",()=>{
 for(const record of [null,1,"str",[],{},{record_version:2}]){
  const r=inspectRecord(record);
  assert.ok(r.blockers.length>0);
  const result=decision(record);
  assert.equal(result.cloud_write_authorized,false);
  assert.equal(result.decision,"HOLD");
 }
});
test("incomplete SourceRecord v2 contract remains HOLD even if all manual controls checked",()=>{
 const data=input();
 for(const patch of [
  {platform:null},{source_type:null},{captured_at:"invalid"},{language:""},
  {key_claims:"fake"},{evidence:null},{confidence:55},
  {analysis:{version:9,status:"draft"}},{review_status:"auto_pass"},{source_url:"file:///private"}
 ]){
  const report=decision({...data,...patch});
  assert.equal(report.decision,"HOLD");
  assert.ok(report.blockers.length>0,JSON.stringify(patch));
  assert.equal(report.cloud_write_authorized,false);
 }
});
