import assert from "node:assert/strict";
import test from "node:test";
import {normaliseSourceInput} from "../lib/source-inbox.ts";
import type {SourceRecord} from "../lib/source-inbox.ts";
import {
 inspectRealPilotCandidate,testRealPilotBackupRoundTrip,canonicalRealPilotRecord,
 REQUIRED_PILOT_ATTESTATIONS,REAL_PILOT_MAX_ARTICLES,
 type RealPilotRiskAttestation,
} from "../lib/phase13-real-pilot-preflight.ts";
const cloudId="src_0123456789abcdef0123456789abcdef";
function fixture():SourceRecord {
 const raw="Synthetic training article: Every request needs reviewed evidence.";
 const record=normaliseSourceInput({value:raw,kind:"paste_text",title:"Synthetic training",capturedAt:"2026-10-15T00:00:00Z"},{now:"2026-10-15T00:00:00Z"}).record;
 const ev={source:"manual:synthetic",timestamp:null,text_reference:"Every request needs reviewed evidence."};
 return {...record,review_status:"reviewed",approval_status:"approved",
    summary:"A fictional training summary.",evidence:[ev],
    key_claims:[{claim:"Review is required",evidence:[ev]}],confidence:0.7,evidence_grade:"B"};
}
const fullConsent=()=>Object.fromEntries(REQUIRED_PILOT_ATTESTATIONS.map(k=>[k,true])) as RealPilotRiskAttestation;
test("single article only; no auto migration capability",()=>{
 assert.equal(REAL_PILOT_MAX_ARTICLES,1);
 assert.ok(REQUIRED_PILOT_ATTESTATIONS.includes("source_specific_cloud_upload_authorized"));
});
test("missing ALL attestations yields metadata-only BLOCKED",async()=>{
 const source=fixture();
 const result=await inspectRealPilotCandidate(source,null,cloudId);
 assert.equal(result.outcome,"BLOCKED");
 assert.equal(result.blockers.length,REQUIRED_PILOT_ATTESTATIONS.length);
 const report=JSON.stringify(result);
 assert.ok(!report.includes(source.raw_text));
 assert.ok(!report.includes(source.title??""));
 assert.ok(!report.includes(source.summary??""));
 assert.equal(result.actual_cloud_upload_occurred,false);
});
test("all consent flags plus evidence checked yields READY_FOR_SERVER_GATES only",async()=>{
 const result=await inspectRealPilotCandidate(fixture(),fullConsent(),cloudId);
 assert.equal(result.outcome,"READY_FOR_SERVER_GATES");
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.evidence_references_checked,2);
 assert.match(result.record_content_sha256??"",/^[a-f0-9]{64}$/);
 assert.match(result.content_fingerprint_sha256??"",/^[a-f0-9]{64}$/);
 assert.equal(result.proposed_cloud_review_status,"needs_review");
 assert.equal(result.proposed_cloud_approval_status,"not_approved");
 assert.equal(result.actual_cloud_upload_occurred,false);
});
test("changing rights or sensitive data attestation FAILS closed",async()=>{
 for(const field of REQUIRED_PILOT_ATTESTATIONS){
  const values={...fullConsent(),[field]:false};
  const result=await inspectRealPilotCandidate(fixture(),values,cloudId);
  assert.equal(result.outcome,"BLOCKED",field);
  assert.ok(result.blockers.includes("consent_missing:"+field));
 }
});
test("unsupported claim evidence is blocked even if schema fields look valid",async()=>{
 const rec=fixture();rec.key_claims=[{claim:"Unsupported",evidence:[{source:"manual:synthetic",timestamp:null,text_reference:"not in original input"}]}];
 const result=await inspectRealPilotCandidate(rec,fullConsent(),cloudId);
 assert.equal(result.outcome,"BLOCKED");
 assert.ok(result.blockers.includes("evidence_not_verbatim"));
});
test("incomplete and running analyses block",async()=>{
 const rec=fixture();rec.analysis.status="processing";rec.material_status="needs_manual_input";rec.evidence=[];
 const result=await inspectRealPilotCandidate(rec,fullConsent(),cloudId);
 assert.equal(result.outcome,"BLOCKED");
 assert.ok(result.blockers.includes("source_not_captured"));
 assert.ok(result.blockers.includes("analysis_pending"));
 assert.ok(result.blockers.includes("evidence_missing"));
});
test("cloud candidate retains full original fields but never inherits local approvals",()=>{
 const record=fixture(),candidate=canonicalRealPilotRecord(record,cloudId);
 assert.equal(candidate.id,cloudId);
 assert.equal(candidate.raw_text,record.raw_text);
 assert.equal(record.review_status,"reviewed");
 assert.equal(record.approval_status,"approved");
 assert.equal(candidate.review_status,"needs_review");
 assert.equal(candidate.approval_status,"not_approved");
});
test("backup JSON survives offline roundtrip while not changing original",async()=>{
 const record=fixture();
 const result=await testRealPilotBackupRoundTrip(record,cloudId);
 assert.equal(result.ok,true);
 assert.equal(result.cloud_candidate_approvals_reset,true);
 assert.match(result.backup_sha256,/^[0-9a-f]{64}$/);
 assert.ok(result.backup_bytes>200);
 assert.equal(record.approval_status,"approved");
});
test("invalid cloud ID fails closed",async()=>{
 const result=await inspectRealPilotCandidate(fixture(),fullConsent(),"src_bad");
 assert.equal(result.outcome,"BLOCKED");
 assert.ok(result.blockers.includes("source_record_invalid_or_cloud_id_mismatch"));
});
test("invalid source record never logged or returned to diagnostics",async()=>{
 const malicious={...fixture(),raw_text:"Private person: confidential notes",source_url:"invalid-url"};
 const res=await inspectRealPilotCandidate(malicious,fullConsent(),cloudId);
 assert.equal(res.outcome,"BLOCKED");
 assert.equal(JSON.stringify(res).includes("confidential"),false);
});
