/**
 * Phase1.3 standalone ONE clean-room article gateway.
 * DARK WORKER by default: workers_dev=false, preview_urls=false, no routes.
 * NEVER use synthetic QA database or deploy publicly without Access All Traffic.
 * The only future writable content is pinned by Owner-reviewed SHA256(s).
 */
import {validateSourceRecord} from "../../lib/source-inbox.ts";
import {findAnalysisEvidence,sourceTextForAnalysis} from "../../lib/ai-analysis.ts";
import {PILOT_PREVIEW_HTML,PILOT_PREVIEW_SCRIPT} from "./pilot-preview-ui.mjs";
import {PILOT_ALLOWED_ALTERNATE_SUMMARY,proposeControlledSummaryUpdate} from "../../lib/pilot-controlled-update.ts";
import {handleSourceSync,purgeSourceSync} from "../phase15-source-sync/service.mjs";
import {handleCloudSource,purgeCloudSource} from "../phase20-cloud-source/service.mjs";
import {MULTI_SOURCE_HTML,MULTI_SOURCE_JS} from "../phase15-source-sync/pilot-ui/embedded.mjs";
import {GOVERNANCE_HTML,GOVERNANCE_JS,GOVERNANCE_ENGINE} from "../phase15c-real-governance/pilot-ui/embedded.mjs";
import {SHADOW_HTML,SHADOW_JS,SHADOW_ENGINE} from "../phase15d-source-approval/pilot-ui/embedded.mjs";
import {verifyCloudflareAccessOwner} from "./access-jwt.mjs";

const MAX_WIRE_BYTES=100_000;
const ID=/^src_[0-9a-f]{32}$/;
const SHA=/^[0-9a-f]{64}$/;
const MAX_RETENTION_MS=7*24*60*60*1000;
const enc=new TextEncoder();
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
 "x-frame-options":"DENY",
}});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))))
 .map(v=>v.toString(16).padStart(2,"0")).join("");
const approvedPayload=record=>({...record,review_status:"needs_review",approval_status:"not_approved"});
function eligibleEvidence(record) {
 const source=sourceTextForAnalysis(record);
 return Boolean(source.trim() && Array.isArray(record.key_claims) && record.key_claims.length
    && Array.isArray(record.evidence) && record.evidence.length)
 && [...record.evidence,...record.key_claims.flatMap(c=>c.evidence)]
   .every(item=>item?.text_reference && findAnalysisEvidence(source,item.text_reference));
}
async function caller(request,env,ctx){
 if(env.CLOUD_ACCESS_REQUIRED!=="true" || !SHA.test(env.OWNER_EMAIL_SHA256??"")){
  return null;
 }
 if(ctx?.access){
  try {
   const identity=await ctx.access.getIdentity();
   const email=typeof identity?.email==="string"?identity.email.trim().toLowerCase():"";
   if(!email)return null;
   const hash=await sha(email);
   if(hash!==env.OWNER_EMAIL_SHA256)return null;
   return {sub:"cf_"+hash};
  }catch{return null}
 }
 return verifyCloudflareAccessOwner(request,env);
}
function sameOrigin(request){
 const origin=request.headers.get("origin");
 const site=request.headers.get("sec-fetch-site");
 const target=new URL(request.url).origin;
 return (!origin||origin===target)&&(!site||site==="same-origin"||site==="none");
}
async function jsonBody(req){
 if(!req.headers.get("content-type")?.startsWith("application/json"))throw Error("content_type_required");
 const stated=req.headers.get("content-length");
 if(stated && Number(stated)>MAX_WIRE_BYTES)throw Error("payload_too_large");
 const text=await req.text();
 if(enc.encode(text).byteLength>MAX_WIRE_BYTES)throw Error("payload_too_large");
 try{
  const obj=JSON.parse(text);
  if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("invalid_json");
  return obj;
 }catch{throw Error("invalid_json")}
}
function consentOK(value){
 return value&&typeof value==="object"&&[
  "original_local_backup_verified","original_local_backup_restored",
  "public_original_content_confirmed","no_confidential_or_sensitive_data",
  "seven_day_retention_accepted","cloud_time_travel_residual_accepted",
  "this_single_article_upload_authorized",
 ].every(key=>value[key]===true);
}
async function pinnedRecord(raw,env){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||!ID.test(raw.id||""))return null;
 try {
  if(validateSourceRecord(raw).length||!eligibleEvidence(raw)||raw.material_status!=="captured"
   ||raw.analysis?.status==="processing")return null;
  const record=approvedPayload(raw);
  const payload=JSON.stringify(record);
  const hash=await sha(payload);
  if(!SHA.test(env.PINNED_ARTICLE_SHA256??"")||!SHA.test(env.PINNED_UPDATE_SHA256??""))return null;
  if(hash!==env.PINNED_ARTICLE_SHA256 && hash!==env.PINNED_UPDATE_SHA256)return null;
  if(record.id!==env.PINNED_ARTICLE_ID)return null;
  return {record,payload,hash};
 }catch{return null}
}
async function statusOf(env,owner,id){
 const row=await env.DB.prepare("SELECT source_id,current_revision,content_sha256,created_at,purge_due_at FROM pilot_documents WHERE owner_sub=? AND source_id=?").bind(owner,id).first();
 return row??null;
}
async function handle(request,env,owner) {
 const url=new URL(request.url);
 // Phase1.5D OFFLINE OWNER SHADOW APPROVAL (NO CLOUD PERMIT).
 // Cloudflare Access is checked globally before this handler executes.
 // Browser CSP denies network connect and form submissions.
 if(["/real-source-approval","/real-source-approval/",
    "/real-source-approval/app.js","/real-source-approval/engine.js"].includes(url.pathname)){
  if(request.method!=="GET")return reply({code:"method_not_allowed"},405);
  if(env.CLOUD_ACCESS_REQUIRED!=="true"||env.SHADOW_APPROVAL_ENABLED!=="true"||
    env.REAL_SOURCE_SYNC_ENABLED!=="false"||
    env.PILOT_REAL_UPLOAD_ENABLED!=="false"||
    env.PILOT_CONTROLLED_COMMIT_ENABLED!=="false")return reply({code:"shadow_approval_disabled"},403);
  const isJS=url.pathname.endsWith(".js");
  const body=url.pathname.endsWith("/app.js")?SHADOW_JS:
    url.pathname.endsWith("/engine.js")?SHADOW_ENGINE:SHADOW_HTML;
  return new Response(body,{headers:{
    "content-type":isJS?"text/javascript; charset=utf-8":"text/html; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "x-frame-options":"DENY","referrer-policy":"no-referrer",
    "content-security-policy":isJS?
      "default-src 'none'; script-src 'none'; connect-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'":
      "default-src 'none'; script-src 'self'; connect-src 'none'; style-src 'unsafe-inline'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  }});
 }
 // Phase1.5C is a LOCAL-ONLY GOVERNANCE PAGE with NO SOURCE API.
 // Cloudflare Access verified Owner identity before any UI bytes are returned.
 // CSP connect-src 'none' disallows runtime network fetch from this page.
 if(["/real-source-readiness","/real-source-readiness/","/real-source-readiness/app.js",
    "/real-source-readiness/engine.js"].includes(url.pathname)){
  if(request.method!=="GET")return reply({code:"method_not_allowed"},405);
  if(env.CLOUD_ACCESS_REQUIRED!=="true"||
     env.PILOT_REAL_UPLOAD_ENABLED!=="false"||
     env.PILOT_CONTROLLED_COMMIT_ENABLED!=="false"||
     env.REAL_SOURCE_SYNC_ENABLED!=="false")return reply({code:"governance_preview_unavailable"},403);
  const isJs=url.pathname.endsWith(".js");
  const body=url.pathname.endsWith("/app.js")?GOVERNANCE_JS:
    url.pathname.endsWith("/engine.js")?GOVERNANCE_ENGINE:GOVERNANCE_HTML;
  return new Response(body,{headers:{
    "content-type":isJs?"text/javascript; charset=utf-8":"text/html; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer","x-frame-options":"DENY",
    "content-security-policy":isJs?
     "default-src 'none'; script-src 'none'; connect-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'":
     "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }});
 }
 // Phase1.5B test page shares the ALREADY Access-protected Worker hostname.
 // It has a separately provisioned synthetic D1, not the live real Pilot DB.
 if(["/multi-source-pilot","/multi-source-pilot/","/multi-source-pilot/app.js"].includes(url.pathname)){
  if(env.CLOUD_ACCESS_REQUIRED!=="true"||env.SOURCE_SYNC_ENABLED!=="true"||
     env.SOURCE_SYNC_SYNTHETIC_ONLY!=="true"||!env.SYNC_DB)
   return reply({code:"synthetic_pilot_disabled"},403);
  if(request.method!=="GET")return reply({code:"method_not_allowed"},405);
  const js=url.pathname.endsWith("/app.js");
  return new Response(js?MULTI_SOURCE_JS:MULTI_SOURCE_HTML,{headers:{
   "content-type":js?"text/javascript; charset=utf-8":"text/html; charset=utf-8",
   "cache-control":"no-store",
   "x-content-type-options":"nosniff","x-frame-options":"DENY",
   "referrer-policy":"no-referrer",
   "content-security-policy":js?
    "default-src 'none'; script-src 'none'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'":
    "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  }});
 }
 // Access identity was already verified by worker.fetch before this function.
 // Real SourceRecord persistence is opt-in and uses a dedicated D1 binding.
 // It never shares the one-article pilot DB or synthetic SYNC_DB.
 if(url.pathname==="/api/cloud/capabilities"||url.pathname==="/api/cloud/records"
   ||url.pathname.startsWith("/api/cloud/records/"))
  return handleCloudSource(request,env,owner);
 // The reusable multi-article service is disabled in the deployed profile
 // and has no SYNC_DB D1 binding. Only capability discovery is available.
 if(url.pathname.startsWith("/api/source-sync/v1/"))
  return handleSourceSync(request,env,owner);
 if(!url.pathname.startsWith("/api/pilot/") &&
   !["/","/pilot-preview","/pilot-preview/","/pilot-preview/app.js","/pilot-source-inbox","/pilot-source-inbox/"].includes(url.pathname)
   && !url.pathname.startsWith("/_next/static/")){
  return reply({code:"not_found"},404);
 }
 if(env.PILOT_REAL_UPLOAD_ENABLED!=="false"&&env.PILOT_REAL_UPLOAD_ENABLED!=="true")
  return reply({code:"pilot_disabled"},503);
 if(!env.DB)return reply({code:"pilot_database_missing"},503);
 const parts=url.pathname.split("/").filter(Boolean);
 const method=request.method;
 if(method!=="GET"&&!sameOrigin(request))return reply({code:"cross_origin_blocked"},403);
 // Genuine Next.js SourceInboxWorkbench: Worker MUST run first, validate
 // Cloudflare Access identity, then fetch curated assets through ASSETS.
 if(method==="GET" && (["/pilot-source-inbox","/pilot-source-inbox/"].includes(url.pathname)
   ||url.pathname.startsWith("/_next/static/"))){
  if(!env.ASSETS||env.PILOT_REAL_UPLOAD_ENABLED!=="false"||env.CLOUD_ACCESS_REQUIRED!=="true")
   return reply({code:"protected_preview_disabled"},503);
  const path=url.pathname;
  if(path.includes("%")||path.includes("\\")||path.split("/").some(part=>part.startsWith(".")||part===".."))
   return reply({code:"not_found"},404);
  const r=await env.ASSETS.fetch(new Request(request.url,{
   method:"GET",headers:{accept:request.headers.get("accept")||"*/*"},
  }));
  const headers=new Headers(r.headers);
  headers.set("cache-control","no-store");
  headers.set("x-frame-options","DENY");
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","no-referrer");
  headers.set("content-security-policy",
   "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'none'");
  return new Response(r.body,{status:r.status,headers});
 }
 if(method==="GET" && ["/","/pilot-preview","/pilot-preview/"].includes(url.pathname)){
  return new Response(PILOT_PREVIEW_HTML,{headers:{
   "content-type":"text/html; charset=utf-8","cache-control":"no-store",
   "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
   "x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer",
  }});
 }
 if(method==="GET"&&url.pathname==="/pilot-preview/app.js"){
  return new Response(PILOT_PREVIEW_SCRIPT,{headers:{
   "content-type":"text/javascript; charset=utf-8","cache-control":"no-store",
   "x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer",
  }});
 }
 if(method==="GET"&&url.pathname==="/api/pilot/capabilities"){
  return reply({pilot_version:1,api_version:1,access_required:true,
   isolated_database:true,one_article_only:true,owner_scoped:true,
   max_payload_bytes:MAX_WIRE_BYTES,max_retention_days:7,
   pinned_article_id:env.PINNED_ARTICLE_ID||null,
   pinned_article_sha256:env.PINNED_ARTICLE_SHA256||null,
   pinned_update_sha256:env.PINNED_UPDATE_SHA256||null,
   real_upload_enabled:env.PILOT_REAL_UPLOAD_ENABLED==="true",
   controlled_update_preflight_only:env.PILOT_WRITE_PREFLIGHT_ENABLED==="true",
   cloud_write_enabled:env.PILOT_CONTROLLED_COMMIT_ENABLED==="true" &&
     env.PILOT_REAL_UPLOAD_ENABLED==="false",
   controlled_commit_enabled:env.PILOT_CONTROLLED_COMMIT_ENABLED==="true",
   requires_explicit_consent:true,legacy_approvals_inherited:false,
   default_expiry_purge_enabled:env.PURGE_JOB_ENABLED==="true"});
 }
 if(method==="GET"&&url.pathname==="/api/pilot/record"){
  if(!ID.test(env.PINNED_ARTICLE_ID||""))return reply({code:"not_configured"},503);
  const id=env.PINNED_ARTICLE_ID;
  const head=await statusOf(env,owner,id);
  if(!head)return reply({code:"not_found"},404);
  if(Date.parse(head.purge_due_at)<=Date.now())return reply({code:"article_expired_pending_purge"},410);
  const row=await env.DB.prepare("SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? AND source_id=? AND revision=?")
   .bind(owner,id,head.current_revision).first();
  if(!row)return reply({code:"revision_integrity_failed"},503);
  const record=JSON.parse(row.source_record_json);
  const digest=await sha(JSON.stringify(record));
  if(digest!==head.content_sha256)return reply({code:"revision_integrity_failed"},503);
  return reply({revision:head.current_revision,content_sha256:head.content_sha256,
   purge_due_at:head.purge_due_at,record});
 }
 if(method==="POST"&&url.pathname==="/api/pilot/update-preflight"){
  // Phase 1.4B: REVIEW ONLY. This endpoint NEVER writes D1; do NOT mistake
  // a successful preflight for consent or for a committed new Revision.
  if(env.PILOT_REAL_UPLOAD_ENABLED!=="false"||
     env.PILOT_WRITE_PREFLIGHT_ENABLED!=="true")
   return reply({code:"controlled_update_preflight_disabled"},403);
  let body;
  try{body=await jsonBody(request)}catch(e){return reply({code:e.message},400)}
  const keys=Object.keys(body).sort();
  if(keys.join("|")!=="expectedRevision|expectedSha256|summary"||
     body.expectedRevision!==1||
     typeof body.expectedSha256!=="string"||
     !SHA.test(body.expectedSha256)||
     body.summary!==PILOT_ALLOWED_ALTERNATE_SUMMARY)
   return reply({code:"proposal_not_allowlisted"},422);
  const id=env.PINNED_ARTICLE_ID;
  if(!ID.test(id??""))return reply({code:"source_not_configured"},503);
  const head=await statusOf(env,owner,id);
  if(!head)return reply({code:"source_not_found"},404);
  if(Date.parse(head.purge_due_at)<=Date.now())
   return reply({code:"article_expired_pending_purge"},410);
  if(head.current_revision!==body.expectedRevision||
     head.content_sha256!==body.expectedSha256||
     head.content_sha256!==env.PINNED_ARTICLE_SHA256)
   return reply({code:"revision_conflict",current_revision:head.current_revision},409);
  const row=await env.DB.prepare(
   "SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? AND source_id=? AND revision=?"
  ).bind(owner,id,head.current_revision).first();
  if(!row)return reply({code:"revision_integrity_failed"},503);
  const current=JSON.parse(row.source_record_json);
  if(await sha(JSON.stringify(current))!==head.content_sha256)
   return reply({code:"revision_integrity_failed"},503);
  const prepared=proposeControlledSummaryUpdate(current,id,body.summary);
  if(!prepared.ready||!prepared.record)
   return reply({code:"proposal_invalid",blockers:prepared.blockers},422);
  const candidate=JSON.stringify(prepared.record);
  const newHash=await sha(candidate);
  if(newHash!==env.PINNED_UPDATE_SHA256 ||
     validateSourceRecord(prepared.record).length||
     !eligibleEvidence(prepared.record))
   return reply({code:"proposal_sha_or_evidence_mismatch"},422);
  return reply({ready:true,base_revision:head.current_revision,
   base_sha256:head.content_sha256,
   proposed_sha256:newHash,
   touched_fields:["summary"],reapproval_required:true,
   review_status:"needs_review",approval_status:"not_approved",
   purge_due_at:head.purge_due_at,
   persisted:false,cloud_write_enabled:false,revision_after_preflight:head.current_revision});
 }
 if(method==="POST"&&url.pathname==="/api/pilot/controlled-commit"){
  // Phase 1.4C: INERT in the live Cloudflare profile.
  // Separate narrow gate NEVER requires switching on generic source POST/PUT.
  if(env.PILOT_CONTROLLED_COMMIT_ENABLED!=="true"||
    env.PILOT_REAL_UPLOAD_ENABLED!=="false")
   return reply({code:"controlled_commit_not_authorized"},403);
  let body;
  try{body=await jsonBody(request)}catch(e){return reply({code:e.message},400)}
  // Explicit Owner consent for this specific candidate, not a generic
  // SourceRecord payload or inherited local approval.
  if(Object.keys(body).sort().join("|")!==
    "backupSha256|confirmedSummary|consentPhrase|expectedRevision|expectedSha256"||
    body.consentPhrase!=="APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY"||
    body.confirmedSummary!==PILOT_ALLOWED_ALTERNATE_SUMMARY||
    body.expectedRevision!==1||
    !SHA.test(body.expectedSha256??"")||
    !SHA.test(body.backupSha256??"")||
    body.backupSha256!==body.expectedSha256)
   return reply({code:"explicit_exact_candidate_consent_required"},403);
  const id=env.PINNED_ARTICLE_ID;
  if(!ID.test(id??""))return reply({code:"source_not_configured"},503);
  const head=await statusOf(env,owner,id);
  if(!head)return reply({code:"source_not_found"},404);
  const now=new Date(),at=now.toISOString();
  if(Date.parse(head.purge_due_at)<=now.getTime())
   return reply({code:"article_expired_pending_purge"},410);
  if(head.current_revision!==body.expectedRevision||
     head.content_sha256!==body.expectedSha256||
     head.content_sha256!==env.PINNED_ARTICLE_SHA256)
   return reply({code:"revision_conflict",current_revision:head.current_revision},409);
  const row=await env.DB.prepare(
   "SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? AND source_id=? AND revision=?"
  ).bind(owner,id,head.current_revision).first();
  if(!row)return reply({code:"revision_integrity_failed"},503);
  const original=JSON.parse(row.source_record_json);
  if(await sha(JSON.stringify(original))!==head.content_sha256)
   return reply({code:"revision_integrity_failed"},503);
  const candidate=proposeControlledSummaryUpdate(original,id,body.confirmedSummary);
  if(!candidate.ready||!candidate.record)
   return reply({code:"candidate_not_allowlisted",blockers:candidate.blockers},422);
  if(validateSourceRecord(candidate.record).length||!eligibleEvidence(candidate.record))
   return reply({code:"candidate_validation_failed"},422);
  const payload=JSON.stringify(candidate.record);
  const fingerprint=await sha(payload);
  if(fingerprint!==env.PINNED_UPDATE_SHA256)
   return reply({code:"candidate_sha_mismatch"},422);
  const nextRevision=head.current_revision+1;
  // D1 batch is transactional. changes() restricts revision append to the
  // immediately preceding successful CAS UPDATE, and event append to the
  // immediately preceding successful revision INSERT. This also handles a
  // stale writer whose head changed between SELECT and UPDATE.
  // The original seven-day purge_due_at is untouched.
  const writes=await env.DB.batch([
   env.DB.prepare("UPDATE pilot_documents SET current_revision=?,content_sha256=?,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=? AND purge_due_at>?")
    .bind(nextRevision,fingerprint,at,owner,id,head.current_revision,head.content_sha256,at),
   env.DB.prepare("INSERT INTO pilot_revisions SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM pilot_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)")
    .bind(owner,id,nextRevision,fingerprint,payload,at,owner,id,nextRevision,fingerprint),
   env.DB.prepare("INSERT INTO pilot_review_events SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM pilot_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)")
    .bind(owner,id,nextRevision,"edited",at,owner,id,nextRevision,fingerprint),
  ]);
  if(writes[0].meta.changes!==1)return reply({code:"revision_conflict"},409);
  if(writes[1].meta.changes!==1||writes[2].meta.changes!==1)
   return reply({code:"revision_integrity_failed"},503);
  const latest=await statusOf(env,owner,id);
  const latestRecord=await env.DB.prepare(
   "SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? AND source_id=? AND revision=?"
  ).bind(owner,id,nextRevision).first();
  if(!latest||latest.current_revision!==nextRevision||
    latest.content_sha256!==fingerprint||
    latest.purge_due_at!==head.purge_due_at||
    !latestRecord||await sha(latestRecord.source_record_json)!==fingerprint)
   return reply({code:"post_write_integrity_failed"},503);
  return reply({committed:true,source_id:id,revision:nextRevision,
    content_sha256:fingerprint,touched_fields:["summary"],
    review_status:"needs_review",approval_status:"not_approved",
    purge_due_at:latest.purge_due_at,immutable_previous_revision_preserved:true});
 }
 if(method==="GET"&&url.pathname==="/api/pilot/history"){
  const id=env.PINNED_ARTICLE_ID;
  if(!ID.test(id||""))return reply({code:"not_configured"},503);
  const head=await statusOf(env,owner,id);
  if(head && Date.parse(head.purge_due_at)<=Date.now())return reply({code:"article_expired_pending_purge"},410);
  const rows=await env.DB.prepare("SELECT revision,kind,occurred_at FROM pilot_review_events WHERE owner_sub=? AND source_id=? ORDER BY revision ASC")
   .bind(owner,id).all();
  return reply({events:rows.results});
 }
 if(method==="POST"&&url.pathname==="/api/pilot/record"){
  if(env.PILOT_REAL_UPLOAD_ENABLED!=="true")return reply({code:"upload_not_authorized"},403);
  let body;try{body=await jsonBody(request)}catch(e){return reply({code:e.message},400)}
  if(!consentOK(body.consent))return reply({code:"explicit_consent_required"},403);
  const prepped=await pinnedRecord(body.record,env);
  if(!prepped||prepped.hash!==env.PINNED_ARTICLE_SHA256)return reply({code:"article_not_allowlisted"},422);
  const existing=await env.DB.prepare("SELECT COUNT(*) AS n FROM pilot_documents WHERE owner_sub=?").bind(owner).first();
  if(existing.n!==0)return reply({code:"one_article_limit"},409);
  const now=new Date();
  const at=now.toISOString(),end=new Date(now.getTime()+MAX_RETENTION_MS).toISOString();
  try{
   await env.DB.batch([
    env.DB.prepare("INSERT INTO pilot_documents VALUES (?,?,?,?,?,?,?)")
      .bind(owner,prepped.record.id,1,prepped.hash,at,at,end),
    env.DB.prepare("INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)")
      .bind(owner,prepped.record.id,1,prepped.hash,prepped.payload,at),
    env.DB.prepare("INSERT INTO pilot_review_events VALUES (?,?,?,?,?)")
      .bind(owner,prepped.record.id,1,"created",at),
   ]);
  }catch(e){if(/constraint|UNIQUE/i.test(String(e)))return reply({code:"one_article_limit"},409);throw e}
  return reply({created:true,source_id:prepped.record.id,revision:1,content_sha256:prepped.hash,purge_due_at:end,
    reviewed:false,approved:false},201);
 }
 if(method==="PUT"&&url.pathname==="/api/pilot/record"){
  if(env.PILOT_REAL_UPLOAD_ENABLED!=="true")return reply({code:"upload_not_authorized"},403);
  let body;try{body=await jsonBody(request)}catch(e){return reply({code:e.message},400)}
  if(!consentOK(body.consent)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)
   return reply({code:"consent_or_revision_missing"},403);
  const prepped=await pinnedRecord(body.record,env);
  if(!prepped||prepped.hash!==env.PINNED_UPDATE_SHA256)return reply({code:"article_not_allowlisted"},422);
  const head=await statusOf(env,owner,prepped.record.id);
  if(!head)return reply({code:"not_found"},404);
  if(Date.parse(head.purge_due_at)<=Date.now())return reply({code:"article_expired_pending_purge"},410);
  if(head.current_revision!==body.expectedRevision)return reply({code:"revision_conflict",current_revision:head.current_revision},409);
  const next=head.current_revision+1,at=new Date().toISOString();
  // D1 batch is transactional. A losing compare-and-swap writes no history.
  const changes=await env.DB.batch([
   env.DB.prepare("UPDATE pilot_documents SET current_revision=?,content_sha256=?,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=?")
    .bind(next,prepped.hash,at,owner,prepped.record.id,body.expectedRevision),
   env.DB.prepare("INSERT INTO pilot_revisions SELECT ?,?,?,?,?,? WHERE (SELECT current_revision FROM pilot_documents WHERE owner_sub=? AND source_id=?)=?")
    .bind(owner,prepped.record.id,next,prepped.hash,prepped.payload,at,owner,prepped.record.id,next),
   env.DB.prepare("INSERT INTO pilot_review_events SELECT ?,?,?,?,? WHERE (SELECT current_revision FROM pilot_documents WHERE owner_sub=? AND source_id=?)=?")
    .bind(owner,prepped.record.id,next,"edited",at,owner,prepped.record.id,next),
  ]);
  if(changes[0].meta.changes!==1)return reply({code:"revision_conflict"},409);
  if(changes[1].meta.changes!==1||changes[2].meta.changes!==1)return reply({code:"revision_integrity_failed"},503);
  return reply({revision:next,content_sha256:prepped.hash,reviewed:false,approved:false});
 }
 if(method==="DELETE"&&url.pathname==="/api/pilot/record"){
  let body;try{body=await jsonBody(request)}catch(e){return reply({code:e.message},400)}
  if(body.delete_confirmation!=="DELETE_THIS_ONE_ARTICLE" || !Number.isSafeInteger(body.expectedRevision))
   return reply({code:"delete_confirmation_and_revision_required"},403);
  const id=env.PINNED_ARTICLE_ID;
  if(!ID.test(id||""))return reply({code:"not_configured"},503);
  const old=await statusOf(env,owner,id);
  if(!old)return reply({code:"not_found"},404);
  if(old.current_revision!==body.expectedRevision)return reply({code:"revision_conflict",current_revision:old.current_revision},409);
  const result=await env.DB.prepare("DELETE FROM pilot_documents WHERE owner_sub=? AND source_id=? AND current_revision=?")
   .bind(owner,id,body.expectedRevision).run();
  if(result.meta.changes!==1)return reply({code:"revision_conflict"},409);
  return reply({deleted:true,source_id:id,active_rows_removed:true,
   note:"D1 Time Travel point-in-time copies may remain for the plan retention window"});
 }
 return reply({code:"not_found"},404);
}
export default {
 async fetch(request,env,ctx){
  const principal=await caller(request,env,ctx);
  if(!principal)return reply({code:"unauthenticated"},401);
  try{return await handle(request,env,principal.sub)}
  catch{return reply({code:"pilot_internal_error"},500)}
 },
 async scheduled(controller,env,ctx){
  if(env.PURGE_JOB_ENABLED!=="true")return;
  // No content is logged. One hourly query cleans expired owners' own
  // single-article pilots, cascading revision and review rows.
  if(env.DB)await env.DB.prepare("DELETE FROM pilot_documents WHERE purge_due_at <= ?").bind(new Date(controller.scheduledTime).toISOString()).run();
  // Separate multi-article synthetic pilot cleanup, only if a future Owner
  // explicitly authorizes, provisions and enables an isolated SYNC_DB.
  await purgeSourceSync(env,new Date(controller.scheduledTime).toISOString());
  // Independently gated cleanup for the dedicated real-source database.
  await purgeCloudSource(env,new Date(controller.scheduledTime).toISOString());
 },
};
