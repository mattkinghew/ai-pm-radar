/**
 * Phase 1.5A: multiple SourceRecord v2 sync, synthetic-only local QA.
 * The live Worker MUST keep SOURCE_SYNC_ENABLED=false and WITHOUT a SYNC_DB
 * binding. Access principal MUST come from verified ctx.access identity.
 * Never trust owner_sub, approvals, content rights or revisions in client headers.
 */
import {validateSourceRecord} from "../../lib/source-inbox.ts";
import {findAnalysisEvidence,sourceTextForAnalysis} from "../../lib/ai-analysis.ts";
import {fixedSyntheticRecordAllowed,FIXTURE_RECORDS,FIXTURE_ALTERNATE_RECORDS} from "./fixtures.mjs";
const enc=new TextEncoder();
const SOURCE_ID=/^src_[0-9a-f]{32}$/;
const DIGEST=/^[0-9a-f]{64}$/;
const MAX_ITEM_BYTES=80_000;
const MAX_ARTICLES=5;
const MAX_REVISIONS=8;
const MAX_RETENTION=7*24*60*60*1000;
const code=(name,status=400,extra={})=>respond({ok:false,code:name,...extra},status);
const respond=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"content-type":"application/json; charset=utf-8",
 "cache-control":"no-store","x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer","x-frame-options":"DENY"}
});
const sha=async text=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(text)))]
 .map(c=>c.toString(16).padStart(2,"0")).join("");
function sameOrigin(request){
 const url=new URL(request.url);
 const origin=request.headers.get("origin");
 const site=request.headers.get("sec-fetch-site");
 return (!origin||origin===url.origin)&&(!site||site==="same-origin"||site==="none");
}
async function jsonBody(request){
 if(!request.headers.get("content-type")?.startsWith("application/json"))
  throw Error("content_type_required");
 const stated=request.headers.get("content-length");
 if(stated && (!Number.isSafeInteger(Number(stated))||Number(stated)>MAX_ITEM_BYTES+5000))
  throw Error("payload_too_large");
 const text=await request.text();
 if(enc.encode(text).byteLength>MAX_ITEM_BYTES+5000)throw Error("payload_too_large");
 let value;
 try{value=JSON.parse(text)}catch{throw Error("invalid_json")}
 if(!value||Array.isArray(value)||typeof value!=="object")throw Error("invalid_json");
 return value;
}
function syntheticAllowed(record){
 try{
  if(typeof record.title!=="string"||!record.title.startsWith("SYNTHETIC "))
   return false;
  if(typeof record.source_url!=="string")return false;
  if(!new URL(record.source_url).hostname.endsWith(".invalid"))return false;
  return typeof record.rights_note==="string"&&record.rights_note.toLowerCase().includes("synthetic");
 }catch{return false}
}
async function canonical(raw,env){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||!SOURCE_ID.test(raw.id??""))
  return null;
 if(validateSourceRecord(raw).length||raw.material_status!=="captured"||
    raw.analysis?.status==="processing"||env.SOURCE_SYNC_SYNTHETIC_ONLY!=="true")
  return null;
 if(!syntheticAllowed(raw)||!fixedSyntheticRecordAllowed(raw))return null;
 const text=sourceTextForAnalysis(raw);
 const refs=[...(raw.evidence??[]),...(raw.key_claims??[]).flatMap(c=>c.evidence??[])];
 if(!text.trim()||!refs.length||
  !refs.every(e=>e?.text_reference&&findAnalysisEvidence(text,e.text_reference)))
  return null;
 const record={...raw,review_status:"needs_review",approval_status:"not_approved"};
 const payload=JSON.stringify(record);
 if(enc.encode(payload).byteLength>MAX_ITEM_BYTES)return null;
 return {record,payload,sha256:await sha(payload),evidence_count:refs.length};
}
function authorized(request,claim,sourceId,sha256){
 return Boolean(claim && !Array.isArray(claim)
  &&Object.keys(claim).sort().join("|")===[
   "backup_verified","content_sha256","rights_confirmed","seven_day_retention_accepted",
   "source_id","time_travel_residual_acknowledged"
  ].sort().join("|")
  &&claim.backup_verified===true&&claim.rights_confirmed===true
  &&claim.seven_day_retention_accepted===true
  &&claim.time_travel_residual_acknowledged===true
  &&claim.source_id===sourceId&&claim.content_sha256===sha256);
}
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const current=(db,owner,id)=>query(db,
 "SELECT source_id,current_revision,content_sha256,created_at,purge_due_at FROM sync_documents WHERE owner_sub=? AND source_id=?",
 owner,id).first();
async function fullRecord(db,owner,head){
 const row=await query(db,
  "SELECT content_sha256,source_record_json FROM sync_revisions WHERE owner_sub=? AND source_id=? AND revision=?",
  owner,head.source_id,head.current_revision).first();
 if(!row||row.content_sha256!==head.content_sha256||
  await sha(row.source_record_json)!==head.content_sha256)return null;
 const record=JSON.parse(row.source_record_json);
 return record.id===head.source_id?record:null;
}
const expired=head=>Date.parse(head.purge_due_at)<=Date.now();
const quota=(a,b,max=MAX_ARTICLES)=>a>=max?code("article_quota_exceeded",409):null;
export async function handleSourceSync(request,env,owner){
 // Gate BEFORE any SYNC_DB access and any source content inspection.
 if(!owner||!/^cf_[a-f0-9]{64}$/.test(owner))return code("unauthenticated",401);
 const url=new URL(request.url),path=url.pathname;
 const route=path.startsWith("/api/source-sync/v1/")?path.slice("/api/source-sync/v1/".length):"";
 const enabled=env.SOURCE_SYNC_ENABLED==="true"&&env.SOURCE_SYNC_SYNTHETIC_ONLY==="true"&&Boolean(env.SYNC_DB);
 if(request.method==="GET" && path==="/api/source-sync/v1/capabilities"){
  return respond({version:1,source_record_version:2,enabled,
   real_sources_allowed:false,synthetic_only:true,
   access_required:true,owner_scoped:true,max_articles:MAX_ARTICLES,
   max_revisions:MAX_REVISIONS,max_item_bytes:MAX_ITEM_BYTES,max_retention_days:7,
   backups_before_overwrite:true,human_review_required:true,
   approval_inherited:false,server_side_cas_required:true});
 }
 if(!enabled)return code("source_sync_disabled",403);
 if(request.method!=="GET"&&!sameOrigin(request))return code("cross_origin_blocked",403);
 const db=env.SYNC_DB;
 if(request.method==="GET"&&route==="fixtures"){
  return respond({fixtures:FIXTURE_RECORDS.slice(0,3).map((record,i)=>({
   id:record.id,title:record.title,
   versions:[record,FIXTURE_ALTERNATE_RECORDS[i]],
  }))});
 }
 if(request.method==="GET"&&route==="records"){
  const rows=await query(db,
   "SELECT source_id,current_revision,content_sha256,created_at,purge_due_at FROM sync_documents WHERE owner_sub=? AND purge_due_at>? ORDER BY updated_at DESC LIMIT ?",
   owner,new Date().toISOString(),MAX_ARTICLES).all();
  return respond({records:rows.results??[]});
 }
 const match=route.match(/^records\/(src_[0-9a-f]{32})(?:\/(history))?$/);
 if(match){
  const id=match[1],history=Boolean(match[2]);
  if(request.method==="GET"){
   const head=await current(db,owner,id);
   if(!head)return code("not_found",404);
   if(expired(head))return code("expired",410);
   if(history){
    const entries=await query(db,
     "SELECT revision,content_sha256,updated_at FROM sync_revisions WHERE owner_sub=? AND source_id=? ORDER BY revision",
     owner,id).all();
    return respond({source_id:id,current_revision:head.current_revision,revisions:entries.results??[]});
   }
   const record=await fullRecord(db,owner,head);
   if(!record)return code("revision_integrity_failed",503);
   return respond({source_id:id,revision:head.current_revision,
    sha256:head.content_sha256,created_at:head.created_at,purge_due_at:head.purge_due_at,record});
  }
  if(history)return code("method_not_allowed",405);
  if(request.method==="PUT"){
   let body;
   try{body=await jsonBody(request)}catch(e){return code(e.message,400)}
   if(Object.keys(body).sort().join("|")!=="authorization|expectedRevision|expectedSha256|record")
    return code("unexpected_fields",422);
   if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1
    ||!DIGEST.test(body.expectedSha256??""))return code("revision_required",422);
   const parsed=await canonical(body.record,env);
   if(!parsed||parsed.record.id!==id)return code("invalid_synthetic_record",422);
   if(!authorized(request,body.authorization,id,parsed.sha256))
    return code("per_article_backup_and_consent_required",403);
   const head=await current(db,owner,id);
   if(!head)return code("not_found",404);
   if(expired(head))return code("expired",410);
   if(head.current_revision!==body.expectedRevision||head.content_sha256!==body.expectedSha256)
    return code("revision_conflict",409,{current_revision:head.current_revision});
   if(head.current_revision>=MAX_REVISIONS)return code("revision_limit",409);
   const prev=await fullRecord(db,owner,head);
   if(!prev)return code("revision_integrity_failed",503);
   if(parsed.sha256===head.content_sha256)return code("no_changes",409);
   const next=head.current_revision+1,at=new Date().toISOString();
   const results=await db.batch([
    query(db,"UPDATE sync_documents SET current_revision=?,content_sha256=?,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=? AND purge_due_at>?",
     next,parsed.sha256,at,owner,id,head.current_revision,head.content_sha256,at),
    query(db,"INSERT INTO sync_revisions SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)",
     owner,id,next,parsed.sha256,parsed.payload,at,owner,id,next,parsed.sha256),
    query(db,"INSERT INTO sync_events SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=? AND content_sha256=?)",
     owner,id,next,"edited",at,owner,id,next,parsed.sha256)
   ]);
   if(results[0].meta.changes!==1)return code("revision_conflict",409);
   if(results[1].meta.changes!==1||results[2].meta.changes!==1)return code("revision_integrity_failed",503);
   const latest=await current(db,owner,id);
   if(!latest||latest.current_revision!==next||latest.content_sha256!==parsed.sha256||
    latest.purge_due_at!==head.purge_due_at||
    !await fullRecord(db,owner,latest))return code("post_write_integrity_failed",503);
   return respond({committed:true,source_id:id,revision:next,sha256:parsed.sha256,
    purge_due_at:head.purge_due_at,review_status:"needs_review",approval_status:"not_approved"});
  }
  if(request.method==="DELETE"){
   let body;
   try{body=await jsonBody(request)}catch(e){return code(e.message,400)}
   if(Object.keys(body).sort().join("|")!=="confirmation|expectedRevision|source_id"||
    body.confirmation!=="DELETE_THIS_SOURCE"||body.source_id!==id||
    !Number.isSafeInteger(body.expectedRevision))return code("explicit_delete_confirmation_required",403);
   const head=await current(db,owner,id);
   if(!head)return code("not_found",404);
   if(head.current_revision!==body.expectedRevision)return code("revision_conflict",409);
   const result=await query(db,
     "DELETE FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=?",
     owner,id,body.expectedRevision).run();
   if(result.meta.changes!==1)return code("revision_conflict",409);
   return respond({deleted:true,source_id:id,active_rows_removed:true,
    backup_residual_possible:true});
  }
 }
 if(request.method==="POST"&&route==="records"){
  let body;
  try{body=await jsonBody(request)}catch(e){return code(e.message,400)}
  if(Object.keys(body).sort().join("|")!=="authorization|record")
   return code("unexpected_fields",422);
  const parsed=await canonical(body.record,env);
  if(!parsed)return code("invalid_synthetic_record",422);
  const id=parsed.record.id;
  if(!authorized(request,body.authorization,id,parsed.sha256))
   return code("per_article_backup_and_consent_required",403);
  const total=await query(db,"SELECT count(*) AS n FROM sync_documents WHERE owner_sub=? AND purge_due_at>?",
   owner,new Date().toISOString()).first();
  if(quota(total.n,MAX_ARTICLES))return code("article_quota_exceeded",409);
  const now=new Date(),at=now.toISOString(),end=new Date(now.getTime()+MAX_RETENTION).toISOString();
  try{
   const responses=await db.batch([
    query(db,"INSERT INTO sync_documents SELECT ?,?,1,?,?,?,? WHERE (SELECT COUNT(*) FROM sync_documents WHERE owner_sub=? AND purge_due_at>?)<?",
     owner,id,parsed.sha256,at,at,end,owner,at,MAX_ARTICLES),
    query(db,"INSERT INTO sync_revisions SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=1 AND content_sha256=?)",
     owner,id,1,parsed.sha256,parsed.payload,at,owner,id,parsed.sha256),
    query(db,"INSERT INTO sync_events SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM sync_documents WHERE owner_sub=? AND source_id=? AND current_revision=1 AND content_sha256=?)",
     owner,id,1,"created",at,owner,id,parsed.sha256),
   ]);
   if(responses[0].meta.changes!==1)return code("article_quota_exceeded",409);
   if(responses[1].meta.changes!==1||responses[2].meta.changes!==1)
    return code("revision_integrity_failed",503);
  }catch(e){
   if(/constraint|unique/i.test(String(e)))return code("article_already_exists",409);
   throw e;
  }
  return respond({created:true,source_id:id,revision:1,sha256:parsed.sha256,
   purge_due_at:end,review_status:"needs_review",approval_status:"not_approved"},201);
 }
 return code("not_found_or_method",404);
}
export async function purgeSourceSync(env,at){
 if(env.SOURCE_SYNC_ENABLED!=="true"||env.SOURCE_SYNC_SYNTHETIC_ONLY!=="true"||!env.SYNC_DB)
  return {purged:0,disabled:true};
 const result=await query(env.SYNC_DB,"DELETE FROM sync_documents WHERE purge_due_at<=?",at).run();
 return {purged:result.meta.changes,disabled:false};
}
