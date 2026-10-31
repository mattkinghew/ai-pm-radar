/**
 * One-time OWNER-approved maintenance upload. Never expose a generic import.
 * Uses the authorized Cloudflare admin D1 connection rather than browser HTTP.
 * The deployed public API must remain write-disabled.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
import assert from "node:assert/strict";
import {validateSourceRecord} from "../../lib/source-inbox.ts";
import {findAnalysisEvidence,sourceTextForAnalysis} from "../../lib/ai-analysis.ts";

const root="experiments/phase13-one-article";
const sourceBytes=readFileSync(join(root,"fixtures/clean-room-public-article.json"));
const source=JSON.parse(sourceBytes.toString("utf8"));
const config=JSON.parse(readFileSync(join(root,"wrangler-protected-preview.jsonc"),"utf8"));
const sha=text=>createHash("sha256").update(text).digest("hex");
const originalSha=sha(sourceBytes);
assert.equal(originalSha,"54c698b9ce1a29615362ce1a5b071f688fa7fd26996934757e2b09281ca1001a",
 "Wrong article file or modified backup");
assert.equal(source.id,"src_b374361cee7c6e132205267306a1e82b");
assert.equal(config.name,"radar-phase13-one-article-dark");
assert.equal(config.vars.PILOT_REAL_UPLOAD_ENABLED,"false","Public API must remain OFF");
assert.equal(config.vars.CLOUD_ACCESS_REQUIRED,"true");
assert.equal(config.vars.PINNED_ARTICLE_ID,source.id);
assert.equal(config.triggers?.crons?.[0],"0 * * * *","Hourly expiry job required");
assert.equal(config.d1_databases?.[0]?.database_name,"radar-phase13-one-article-20261015");
assert.deepEqual(validateSourceRecord(source),[],"Structured source validation");
const quoteItems=[...source.evidence,...source.key_claims.flatMap(c=>c.evidence)];
assert.equal(quoteItems.length,6);
assert.ok(quoteItems.every(e=>e.text_reference&&findAnalysisEvidence(sourceTextForAnalysis(source),e.text_reference)),
 "Claim/evidence quote not found in source");
assert.equal(source.material_status,"captured");
assert.equal(source.analysis.status,"not_requested");
assert.equal(source.review_status,"needs_review");
assert.equal(source.approval_status,"not_approved");
const candidate={...source,review_status:"needs_review",approval_status:"not_approved"};
const payload=JSON.stringify(candidate);
const hash=sha(payload);
assert.equal(hash,config.vars.PINNED_ARTICLE_SHA256,"Not the approved exact article");
const ownerSha=config.vars.OWNER_EMAIL_SHA256;
assert.match(ownerSha,/^[0-9a-f]{64}$/);
const ownerId="cf_"+ownerSha;
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const now=new Date();
const start=now.toISOString(),expiry=new Date(now.getTime()+7*86400_000).toISOString();
const statement=[
"PRAGMA foreign_keys=ON;",
"INSERT INTO pilot_documents (owner_sub,source_id,current_revision,content_sha256,created_at,updated_at,purge_due_at) VALUES ("+
 [ownerId,source.id,1,hash,start,start,expiry].map(q).join(",")+");",
"INSERT INTO pilot_revisions (owner_sub,source_id,revision,content_sha256,source_record_json,updated_at) VALUES ("+
 [ownerId,source.id,1,hash,payload,start].map(q).join(",")+");",
"INSERT INTO pilot_review_events (owner_sub,source_id,revision,kind,occurred_at) VALUES ("+
 [ownerId,source.id,1,"created",start].map(q).join(",")+");",
].join("\n")+"\n";
const dest=process.argv[2];
if(!dest?.endsWith(".sql"))throw Error("Explicit private SQL file destination required");
writeFileSync(dest,statement,{mode:0o600});
console.log(JSON.stringify({
  status:"APPROVED_SINGLE_RECORD_SQL_READY",
  source_id:source.id,sha256:hash,original_file_sha256:originalSha,
  bytes:Buffer.byteLength(payload),evidence_verified:quoteItems.length,
  current_revision:1,cloud_review:"needs_review",cloud_approval:"not_approved",
  created_at:start,purge_due_at:expiry,route_upload_enabled:false
}));
