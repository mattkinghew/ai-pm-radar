/**
 * Read-only D1 integrity evidence after Owner authorized Phase 1.4D commit.
 * NEVER output article body, private owner digest/email or credentials.
 */
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {validateSourceRecord} from "../../lib/source-inbox.ts";
import {sourceTextForAnalysis,findAnalysisEvidence} from "../../lib/ai-analysis.ts";
import {PILOT_ALLOWED_ALTERNATE_SUMMARY,proposeControlledSummaryUpdate} from "../../lib/pilot-controlled-update.ts";
const root="experiments/phase13-one-article";
const original=JSON.parse(readFileSync(root+"/fixtures/clean-room-public-article.json","utf8"));
const config=JSON.parse(readFileSync(root+"/wrangler-next-pilot-preview.jsonc","utf8"));
const sha=t=>createHash("sha256").update(t).digest("hex");
const newCandidate=proposeControlledSummaryUpdate(original,original.id,PILOT_ALLOWED_ALTERNATE_SUMMARY).record;
assert.ok(newCandidate);
function query(sql){
 const executable="/Users/mattgor/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js";
 const output=execFileSync(process.execPath,[executable,"d1","execute",
  "radar-phase13-one-article-20261015","--remote","--command",sql,"--json"],
  {cwd:root,encoding:"utf8",maxBuffer:1_000_000,timeout:90_000,
   env:{...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"}});
 const result=JSON.parse(output);
 assert.equal(result[0].success,true);
 return result[0].results;
}
const heads=query("SELECT source_id,owner_sub,current_revision,content_sha256,created_at,purge_due_at FROM pilot_documents");
assert.equal(heads.length,1);
const head=heads[0];
assert.equal(head.source_id,original.id);
assert.equal(head.owner_sub,"cf_"+config.vars.OWNER_EMAIL_SHA256);
assert.equal(head.current_revision,2);
assert.equal(head.content_sha256,config.vars.PINNED_UPDATE_SHA256);
assert.equal(head.purge_due_at,"2026-10-22T06:12:29.952Z");
assert.equal(head.created_at,"2026-10-15T06:12:29.952Z");
assert.ok(Date.parse(head.purge_due_at)>Date.now(),"Article already expired");
const versions=query("SELECT source_id,revision,content_sha256,source_record_json,updated_at FROM pilot_revisions ORDER BY revision");
assert.equal(versions.length,2);
const events=query("SELECT revision,kind FROM pilot_review_events ORDER BY revision");
assert.equal(events.length,2);
assert.deepEqual(events.map(e=>[e.revision,e.kind]),[[1,"created"],[2,"edited"]]);
assert.deepEqual(versions.map(v=>v.revision),[1,2]);
const rev1=JSON.parse(versions[0].source_record_json),rev2=JSON.parse(versions[1].source_record_json);
assert.deepEqual(rev1,original,"Original Revision1 is immutable");
assert.deepEqual(rev2,newCandidate,"Revision2 must be exact approved proposal");
assert.equal(sha(versions[0].source_record_json),versions[0].content_sha256);
assert.equal(sha(versions[1].source_record_json),versions[1].content_sha256);
assert.equal(versions[0].content_sha256,config.vars.PINNED_ARTICLE_SHA256);
assert.equal(versions[1].content_sha256,config.vars.PINNED_UPDATE_SHA256);
assert.equal(versions[1].content_sha256,head.content_sha256);
assert.deepEqual(validateSourceRecord(rev2),[]);
assert.deepEqual(Object.keys(original).filter(key=>JSON.stringify(original[key])!==JSON.stringify(rev2[key])),["summary"]);
const literalReferences=[...rev2.evidence,...rev2.key_claims.flatMap(claim=>claim.evidence)];
assert.equal(literalReferences.length,6);
assert.ok(literalReferences.every(e=>findAnalysisEvidence(sourceTextForAnalysis(rev2),e.text_reference)));
assert.equal(rev2.review_status,"needs_review");
assert.equal(rev2.approval_status,"not_approved");
assert.equal(config.vars.PILOT_REAL_UPLOAD_ENABLED,"false");
assert.equal(config.vars.PILOT_CONTROLLED_COMMIT_ENABLED,"false");
console.log(JSON.stringify({
 status:"PHASE14D_LIVE_D1_REVISION2_FULL_PARITY_PASS",
 docs:heads.length,revisions:versions.length,events:events.length,
 source_id:head.source_id,current_revision:head.current_revision,
 revision1_sha256:versions[0].content_sha256,
 revision2_sha256:head.content_sha256,
 only_changed_field:"summary",
 exact_record_equals_approved_candidate:true,
 original_immutable:true,
 evidence_references_checked:literalReferences.length,
 owner_bound:true,history_events:events.map(e=>e.kind),
 current_review_status:rev2.review_status,current_approval_status:rev2.approval_status,
 created_at:head.created_at,purge_due_at:head.purge_due_at,
 general_upload_disabled:true,controlled_commit_disabled:true
},null,2));
