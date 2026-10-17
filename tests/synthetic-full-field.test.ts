import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Worker runtime .mjs does not expose TypeScript declarations.
import {fullSyntheticFixture} from "../experiments/cloudflare-sync-spike/cloud-api.mjs";
import {
  assertSyntheticFullRecord,prepareSyntheticFullRecord,syntheticAlternateValues,
  SYNTHETIC_MUTABLE_FIELDS,SYNTHETIC_TEXT,SYNTHETIC_URL,
} from "../lib/synthetic-full-field.ts";
import {sourceRecordFingerprint} from "../lib/source-library.ts";
import type {SourceRecord} from "../lib/source-inbox.ts";
const id="qa12_synthetic_fullfield_test";
const baseline=()=>fullSyntheticFixture(id) as SourceRecord;
function alternate():SourceRecord{
 const record=baseline();
 const variants=syntheticAlternateValues();
 for(const field of SYNTHETIC_MUTABLE_FIELDS){
  const alt=variants[field];
  if(alt!==undefined)(record as unknown as Record<string,unknown>)[field]=structuredClone(alt);
 }
 record.analysis.source_facts=[...variants.analysis_source_facts];
 record.analysis.inferences=[...variants.analysis_inferences];
 record.analysis.method_or_teaching_points=[...variants.analysis_methods];
 return record;
}
test("19 independent synthetic editable fields tracked, all source metadata stays immutable",()=>{
 assert.equal(SYNTHETIC_MUTABLE_FIELDS.length,16);
 assert.deepEqual(assertSyntheticFullRecord(baseline(),baseline()),[]);
 assert.deepEqual(assertSyntheticFullRecord(alternate(),baseline()),[]);
 const updated=alternate();
 assert.equal(updated.raw_text,SYNTHETIC_TEXT);
 assert.equal(updated.source_url,SYNTHETIC_URL);
 assert.notEqual(sourceRecordFingerprint(updated),sourceRecordFingerprint(baseline()));
});
test("copy only actual Workbench semantic fields, preserve full typed record",()=>{
 const workbench={...alternate(),id:"src_legacy_computed",review_status:"reviewed" as const,approval_status:"approved" as const};
 const result=prepareSyntheticFullRecord(workbench,baseline(),id);
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.record.id,id);
 assert.equal(result.record.review_status,"needs_review");
 assert.equal(result.record.approval_status,"not_approved");
 for(const field of SYNTHETIC_MUTABLE_FIELDS) assert.deepEqual(result.record[field],workbench[field],field);
 assert.deepEqual(result.record.analysis.source_facts,workbench.analysis.source_facts);
 assert.deepEqual(result.record.analysis.inferences,workbench.analysis.inferences);
 assert.deepEqual(result.record.analysis.method_or_teaching_points,workbench.analysis.method_or_teaching_points);
});
test("no unrecognized SourceRecord keys and no mutated fixed provenance",()=>{
 const base=baseline();
 assert.ok(assertSyntheticFullRecord({...base,title:"Real employer report"},base).some(v=>v.includes("immutable_provenance_changed")));
 assert.ok(assertSyntheticFullRecord({...base,raw_text:"Client confidential data"},base).includes("non_synthetic_source"));
 assert.ok(assertSyntheticFullRecord({...base,source_url:"https://private.company.test"},base).includes("non_synthetic_source"));
 assert.ok(assertSyntheticFullRecord({...base,secret:"yes"} as SourceRecord,base).includes("record_keys_changed"));
});
test("field allowlist never accepts arbitrary user/customer strings or untrusted code",()=>{
 const base=baseline();
 for(const changed of [
  {...base,summary:"Private customer confidential ROI"},
  {...base,key_points:["External client meeting notes"]},
  {...base,why_it_matters:"Employee details"},
  {...base,topic_tags:["private-project"]},
  {...base,evidence_grade:"A"},
  {...base,confidence:0.99},
  {...base,analysis:{...base.analysis,source_facts:["Private internal finance"]}},
  {...base,analysis:{...base.analysis,provider:"gemini",model:"unverified-live-model"}},
  {...base,evidence:[{...base.evidence[0],text_reference:"Claim without source"}]},
  {...base,key_claims:[{claim:"400% return earned.",evidence:base.evidence}]},
 ]){
  assert.ok(assertSyntheticFullRecord(changed as SourceRecord,base).length>0,JSON.stringify(changed));
 }
});
test("allowed synthetic Evidence excerpts appear verbatim in immutable source",()=>{
 const alt=alternate();
 assert.ok(alt.evidence.every(e=>SYNTHETIC_TEXT.includes(e.text_reference)));
 assert.ok(alt.key_claims.every(c=>c.evidence.every(e=>SYNTHETIC_TEXT.includes(e.text_reference))));
 assert.deepEqual(assertSyntheticFullRecord(alt,baseline()),[]);
});
test("per-field modifications create different fingerprint without copying human approval",()=>{
 const current=baseline();
 for(const field of SYNTHETIC_MUTABLE_FIELDS){
  const variant=syntheticAlternateValues()[field] as never;
  const next={...current,[field]:variant};
  const failures=assertSyntheticFullRecord(next,baseline());
  assert.deepEqual(failures,[],field+" "+failures.join(" "));
  assert.notEqual(sourceRecordFingerprint(next),sourceRecordFingerprint(current),field);
 }
});

test("unsupported real Workbench metadata edits block rather than silently disappear",()=>{
 const base=baseline();
 for(const edited of [
  {...base,title:"Altered client title"},
  {...base,description:"New private metadata"},
  {...base,language:"en"},
  {...base,captured_at:"2026-10-16T01:00:00Z"},
  {...base,analysis:{...base.analysis,status:"draft" as const}},
 ]){
  const result=prepareSyntheticFullRecord(edited,base,id);
  assert.ok(result.blockers.some(b=>b.includes("immutable_")),JSON.stringify(edited));
 }
});
