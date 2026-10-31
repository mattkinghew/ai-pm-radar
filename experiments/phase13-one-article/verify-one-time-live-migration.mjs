/** Read-only live D1 parity check. Never print source bodies, emails or tokens. */
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {findAnalysisEvidence,sourceTextForAnalysis} from "../../lib/ai-analysis.ts";
import {validateSourceRecord} from "../../lib/source-inbox.ts";
const sha=x=>createHash("sha256").update(x).digest("hex");
const p="experiments/phase13-one-article/";
const source=JSON.parse(readFileSync(p+"fixtures/clean-room-public-article.json","utf8"));
const config=JSON.parse(readFileSync(p+"wrangler-protected-preview.jsonc","utf8"));
const w="/Users/mattgor/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js";
const query=sql=>{
  const out=execFileSync(process.execPath,[w,"d1","execute","radar-phase13-one-article-20261015",
   "--remote","--command",sql,"--json"],{cwd:p,encoding:"utf8",maxBuffer:1_000_000,
    timeout:90000,env:{...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"}});
  const json=JSON.parse(out);
  assert.equal(json[0].success,true);
  return json[0].results;
};
const tables=query("SELECT (SELECT count(*) FROM pilot_documents) AS documents,(SELECT count(*) FROM pilot_revisions) AS revisions,(SELECT count(*) FROM pilot_review_events) AS events;")[0];
assert.deepEqual(tables,{documents:1,revisions:1,events:1});
const rows=query("SELECT d.owner_sub,d.source_id,d.current_revision,d.content_sha256,d.created_at,d.purge_due_at,r.source_record_json,r.content_sha256 AS revision_hash,r.revision AS revision_number,e.kind,e.revision AS event_revision FROM pilot_documents d JOIN pilot_revisions r ON r.owner_sub=d.owner_sub AND r.source_id=d.source_id JOIN pilot_review_events e ON e.owner_sub=r.owner_sub AND e.source_id=r.source_id AND e.revision=r.revision;");
assert.equal(rows.length,1);
const row=rows[0];
const canonical={...source,review_status:"needs_review",approval_status:"not_approved"};
const live=JSON.parse(row.source_record_json);
assert.deepEqual(live,canonical,"Cloud SourceRecord differs from local backup");
const remoteHash=sha(row.source_record_json);
assert.equal(remoteHash,config.vars.PINNED_ARTICLE_SHA256);
assert.equal(remoteHash,row.content_sha256);
assert.equal(remoteHash,row.revision_hash);
assert.equal(row.owner_sub,"cf_"+config.vars.OWNER_EMAIL_SHA256);
assert.equal(row.source_id,source.id);
assert.equal(row.current_revision,1);
assert.equal(row.revision_number,1);
assert.equal(row.event_revision,1);
assert.equal(row.kind,"created");
assert.equal(live.review_status,"needs_review");
assert.equal(live.approval_status,"not_approved");
assert.deepEqual(validateSourceRecord(live),[]);
const checked=[...live.evidence,...live.key_claims.flatMap(c=>c.evidence)];
assert.equal(checked.length,6);
assert.ok(checked.every(e=>findAnalysisEvidence(sourceTextForAnalysis(live),e.text_reference)));
const start=Date.parse(row.created_at),expiry=Date.parse(row.purge_due_at);
const now=Date.now();
assert.ok(start>now-7*86400_000 && start<=now+60*1000,
 "Creation must be within the article's authorized seven-day retention, not the most recent hour");
assert.ok(expiry>now+6*86400_000 && expiry<=start+7*86400_000+1000);
assert.equal(config.vars.PILOT_REAL_UPLOAD_ENABLED,"false");
const result={
 status:"PHASE13_ONE_REAL_CLEANROOM_ARTICLE_LIVE_D1_PARITY_PASS",
 source_id:row.source_id,cloud_revision:1,
 remote_rows:tables, sha256:remoteHash,original_clauses:checked.length,
 full_record_equal:true,verified_owner_scoped:true,
 review_status:live.review_status,approval_status:live.approval_status,
 created_at:row.created_at,purge_due_at:row.purge_due_at,
 route_upload_enabled:false,origin:"admin-approved-maintenance-D1-import",
 note:"App authenticated GET and physical device verification still pending."
};
const dest=process.argv[2];
if(dest)writeFileSync(dest,JSON.stringify(result,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify(result,null,2));
