/**
 * PHASE 1.4D — one-time authorized revision 2. ONLY the Owner-specified
 * Clean-room record, with fixed update summary and immutable history.
 * Admin maintenance route, not a Cloudflare Access browser POST.
 * All data and D1 backups stay on Owner's Mac; never include SQL in logs.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {validateSourceRecord} from "../../lib/source-inbox.ts";
import {findAnalysisEvidence,sourceTextForAnalysis} from "../../lib/ai-analysis.ts";
import {PILOT_ALLOWED_ALTERNATE_SUMMARY,proposeControlledSummaryUpdate} from "../../lib/pilot-controlled-update.ts";
import {PHASE14_PINNED_CLOUD_ID} from "../../lib/pilot-source-reconciliation.ts";
const root="experiments/phase13-one-article";
const record=JSON.parse(readFileSync(root+"/fixtures/clean-room-public-article.json","utf8"));
const config=JSON.parse(readFileSync(root+"/wrangler-next-pilot-preview.jsonc","utf8"));
const hash=x=>createHash("sha256").update(x).digest("hex");
const enc=x=>JSON.stringify(x);
assert.equal(process.env.PHASE14D_OWNER_AUTHORIZED,"GO Phase 1.4D，同意提交 Revision 2",
 "Missing explicit approval of one exactly specified summary change");
assert.equal(record.id,PHASE14_PINNED_CLOUD_ID);
assert.equal(config.vars.PILOT_REAL_UPLOAD_ENABLED,"false");
assert.equal(config.vars.PILOT_CONTROLLED_COMMIT_ENABLED,"false","No live in-app commit capability should be active");
assert.equal(config.vars.CLOUD_ACCESS_REQUIRED,"true");
assert.equal(config.vars.PINNED_ARTICLE_ID,record.id);
assert.equal(config.d1_databases[0].database_name,"radar-phase13-one-article-20261015");
assert.equal(config.triggers.crons[0],"0 * * * *");
assert.deepEqual(validateSourceRecord(record),[]);
assert.equal(record.material_status,"captured");
assert.equal(record.review_status,"needs_review");
assert.equal(record.approval_status,"not_approved");
const originals=[...record.evidence,...record.key_claims.flatMap(c=>c.evidence)];
assert.equal(originals.length,6);
assert.ok(originals.every(x=>findAnalysisEvidence(sourceTextForAnalysis(record),x.text_reference)));
const originalSha=hash(enc(record));
assert.equal(originalSha,"bdea79cb77ae17c5467aba2f6a0517abd8368c611e76be45989f9af300ee6474");
assert.equal(originalSha,config.vars.PINNED_ARTICLE_SHA256);
const changed=proposeControlledSummaryUpdate(record,record.id,PILOT_ALLOWED_ALTERNATE_SUMMARY);
assert.equal(changed.ready,true);
assert.deepEqual(changed.touched_fields,["summary"]);
assert.ok(changed.record);
const updated=changed.record;
assert.deepEqual(validateSourceRecord(updated),[]);
const newHash=hash(enc(updated));
assert.equal(newHash,"9249bd0181fd7197d93ad6f64f5f689cb4bca3eb1c3faf171adab116c0f7ed13");
assert.equal(newHash,config.vars.PINNED_UPDATE_SHA256);
for(const key of Object.keys(record)){
 if(key!=="summary")assert.deepEqual(updated[key],record[key],key);
}
const ownerSha=config.vars.OWNER_EMAIL_SHA256;
assert.match(ownerSha,/^[a-f0-9]{64}$/);
const ownerSub="cf_"+ownerSha;
const dest=process.argv[2];
if(!dest||!dest.endsWith(".sql"))throw Error("Private absolute .sql destination required");
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const stamp=new Date().toISOString();
const id=record.id;
const statement=[
"PRAGMA foreign_keys=ON;",
"UPDATE pilot_documents SET current_revision=2,content_sha256="+quote(newHash)+",updated_at="+quote(stamp)+
 " WHERE owner_sub="+quote(ownerSub)+" AND source_id="+quote(id)+" AND current_revision=1"+
 " AND content_sha256="+quote(originalSha)+" AND purge_due_at>"+quote(stamp)+";",
"INSERT INTO pilot_revisions (owner_sub,source_id,revision,content_sha256,source_record_json,updated_at) SELECT "+
 [ownerSub,id,2,newHash,enc(updated),stamp].map(quote).join(",")+
 " WHERE changes()=1 AND EXISTS (SELECT 1 FROM pilot_documents WHERE owner_sub="+quote(ownerSub)+
 " AND source_id="+quote(id)+" AND current_revision=2 AND content_sha256="+quote(newHash)+");",
"INSERT INTO pilot_review_events (owner_sub,source_id,revision,kind,occurred_at) SELECT "+
 [ownerSub,id,2,"edited",stamp].map(quote).join(",")+
 " WHERE changes()=1 AND EXISTS (SELECT 1 FROM pilot_documents WHERE owner_sub="+quote(ownerSub)+
 " AND source_id="+quote(id)+" AND current_revision=2 AND content_sha256="+quote(newHash)+");",
].join("\n")+"\n";
writeFileSync(dest,statement,{mode:0o600});
console.log(JSON.stringify({
 status:"ONE_OWNER_APPROVED_CAS_REVISION2_SQL_READY",
 source_id:id,
 original_revision:1,candidate_revision:2,
 original_sha256:originalSha,candidate_sha256:newHash,
 only_field:"summary",evidence_references:originals.length,
 created_event_name:"edited",review_status:updated.review_status,approval_status:updated.approval_status,
 public_real_upload_enabled:false,public_controlled_commit_enabled:false,
 sql_contents_logged:false
}));
