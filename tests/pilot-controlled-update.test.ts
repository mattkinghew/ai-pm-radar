import assert from "node:assert/strict";
import test from "node:test";
import {normaliseSourceInput} from "../lib/source-inbox.ts";
import type {SourceRecord} from "../lib/source-inbox.ts";
import {PHASE14_PINNED_CLOUD_ID,PHASE14_PINNED_TITLE} from "../lib/pilot-source-reconciliation.ts";
import {PILOT_ALLOWED_ALTERNATE_SUMMARY,proposeControlledSummaryUpdate} from "../lib/pilot-controlled-update.ts";
function fixture():SourceRecord{
 const r=normaliseSourceInput({kind:"paste_text",value:"Synthetic clean room source",
  title:PHASE14_PINNED_TITLE,capturedAt:"2026-10-15T00:00:00Z"},
  {now:"2026-10-15T00:00:00Z"}).record;
 return {...r,id:PHASE14_PINNED_CLOUD_ID};
}
test("controlled diff alters only summary, inherits original source provenance",()=>{
 const base=fixture(),next=proposeControlledSummaryUpdate(base,base.id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
 assert.equal(next.ready,true);
 assert.deepEqual(next.touched_fields,["summary"]);
 assert.equal(next.record?.summary,PILOT_ALLOWED_ALTERNATE_SUMMARY);
 for(const k of Object.keys(base) as (keyof SourceRecord)[]){
  if(k!=="summary")assert.deepEqual(next.record?.[k],base[k],k);
 }
 assert.equal(base.summary,null);
 assert.equal(next.allowed_to_write_cloud,false);
 assert.equal(next.owner_reapproval_required,true);
});
test("arbitrary text including confidential content never becomes candidate",()=>{
 const base=fixture();
 for(const summary of ["Private customer notes","Random post","",base.summary??""]){
  const result=proposeControlledSummaryUpdate(base,base.id,summary);
  assert.equal(result.ready,false);
  assert.equal(result.record,null);
  assert.equal(result.allowed_to_write_cloud,false);
 }
});
test("wrong source binding blocks the proposal",()=>{
 const base=fixture();
 for(const id of [null,"src_"+"a".repeat(32)]){
  const result=proposeControlledSummaryUpdate(base,id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes("source_identity_mismatch"));
 }
});
test("altered source identity or schema is rejected",()=>{
 const base=fixture();
 for(const patch of [{id:"src_"+"f".repeat(32)},{title:"Other"},{record_version:999},
   {material_status:"needs_manual_input" as const}]){
  const result=proposeControlledSummaryUpdate({...base,...patch} as SourceRecord,
    base.id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
  assert.equal(result.ready,false);
 }
});
test("cloud review or approval is not inherited by an update",()=>{
 const base=fixture();
 for(const patch of [{review_status:"reviewed" as const},{approval_status:"approved" as const}]){
  const result=proposeControlledSummaryUpdate({...base,...patch},
    base.id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes("cloud_approval_must_be_separate"));
 }
});
test("no-op already-applied update is blocked",()=>{
 const base={...fixture(),summary:PILOT_ALLOWED_ALTERNATE_SUMMARY};
 const result=proposeControlledSummaryUpdate(base,base.id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("no_change"));
});
