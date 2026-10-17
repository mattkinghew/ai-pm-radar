/**
 * Phase 1.2B isolated, signed-Access-only cloud SourceRecord v2 API.
 * Only deterministic SYNTHETIC records in protected Preview.
 * DO NOT enable for real SourceRecords or production without further signoff.
 */
import { normaliseSourceInput } from "../../lib/source-inbox.ts";
import {
  createCloudSourceState, editCloudSourceState, reviewCloudSourceState,
  approveCloudSourceState, cloudApprovals, getCloudSourceRevision,
  getApprovedCloudSourceRecord, CloudRevisionConflict,
} from "../../lib/cloud-sync-contract.ts";
import { createSourceLibraryEntry, validateSourceLibraryEntry } from "../../lib/source-library.ts";
import {assertSyntheticFullRecord,SYNTHETIC_TEXT,SYNTHETIC_URL,SYNTHETIC_QUOTE} from "../../lib/synthetic-full-field.ts";

const PREFIX = "qa12_";
const ID = /^qa12_[A-Za-z0-9_-]{6,70}$/;
const MAX_INPUT = 100_000;
const MAX_RECORDS = 20;
const CAPTURED_AT = "2026-10-15T00:00:00.000Z";
const SOURCE_URL = SYNTHETIC_URL;
const TEXT = SYNTHETIC_TEXT;
const QUOTE = SYNTHETIC_QUOTE;
const SUMMARIES = [
  "Synthetic source: students requested more practice.",
  "Synthetic revised source: student requests remained unverified in a real study.",
];
const DAILY = Object.freeze({
  question_title: "What does this synthetic pilot teach about human review?",
  short_title: "Synthetic review test",
  category: "AI PM Learning",
  tags: ["synthetic", "governance"],
  impact_score: 5,
  relevance_score: 6,
  trust_score: 5,
});
function respond(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers:{
    "content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
  }});
}
function fail(code, status=422, extra={}) { return respond({code,...extra},status); }
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value==="object") {
    const result={};
    for(const key of Object.keys(value).sort()) result[key]=ordered(value[key]);
    return result;
  }
  return value;
}
const digestJson = record => JSON.stringify(ordered(record));

export function fullSyntheticFixture(id="qa12_template") {
  const base=normaliseSourceInput({
    value:TEXT,kind:"paste_text",sourceUrl:SOURCE_URL,originalSourceUrl:SOURCE_URL,finalSourceUrl:SOURCE_URL,
    title:"Synthetic Radar Cloud Record",creator:"Synthetic Test",language:"zh-Hant",
    capturedAt:CAPTURED_AT,
  },{now:CAPTURED_AT}).record;
  const evidence={source:SOURCE_URL,timestamp:null,text_reference:QUOTE};
  return {
    ...base,id,summary:SUMMARIES[0],
    key_points:["Synthetic only; no actual customer data."],
    key_claims:[{claim:"Nine students requested practice.",evidence:[evidence]}],
    evidence:[evidence],evidence_grade:"B",confidence:0.7,
    why_it_matters:"Synthetic human review demonstration.",
    business_implication:"No business return measured in a synthetic source.",
    ai_pm_implication:"Human evaluation is required.",
    uncertainties:["All observed figures are fictional."],
    review_status:"needs_review",approval_status:"not_approved",
  };
}
function allowSynthetic(record,id,env) {
  if(env.SYNTHETIC_ONLY!=="true" || env.CLOUD_ACCESS_REQUIRED!=="true" || !ID.test(id))return false;
  if(!record||typeof record!=="object"||Array.isArray(record)||record.id!==id)return false;
  // The entire record is validated against a finite synthetic-only full-field
  // profile. No arbitrary text, URL, forged AI provider or additional keys.
  return assertSyntheticFullRecord(record,fullSyntheticFixture(id)).length===0;
}
async function parseJson(request) {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("content_type");
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>MAX_INPUT)throw new Error("too_large");
  let body;
  try{body=JSON.parse(raw);}catch{throw new Error("invalid_json");}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("invalid_json");
  return body;
}
function ownerScoped(auth) { if(!auth?.sub) throw Error("no_owner");return auth.sub; }
async function head(db,owner,id) {
  return db.prepare("SELECT current_revision,current_fingerprint FROM cloud_source_heads WHERE owner_sub=? AND source_id=?").bind(owner,id).first();
}
async function loadState(db,owner,id) {
  const h=await head(db,owner,id);
  if(!h)return null;
  const [revisionRows,eventRows]=await Promise.all([
    db.prepare("SELECT revision,content_fingerprint,source_record_json,changed_at FROM cloud_source_revisions WHERE owner_sub=? AND source_id=? ORDER BY revision").bind(owner,id).all(),
    db.prepare("SELECT source_revision,content_fingerprint,action,acted_at FROM cloud_source_review_events WHERE owner_sub=? AND source_id=? ORDER BY source_revision").bind(owner,id).all(),
  ]);
  const revisions=revisionRows.results.map(row=>({
    revision:row.revision,fingerprint:row.content_fingerprint,
    record:JSON.parse(row.source_record_json),changed_at:row.changed_at
  }));
  const events=eventRows.results.map(row=>({
    kind:row.action,source_revision:row.source_revision,
    fingerprint:row.content_fingerprint,occurred_at:row.acted_at,
  }));
  if(revisions.length!==h.current_revision || events.length!==h.current_revision
    || revisions.at(-1)?.fingerprint!==h.current_fingerprint
    || events.at(-1)?.fingerprint!==h.current_fingerprint)throw Error("inconsistent_revisions");
  let reviewed_fingerprint=null,approved_for_daily=null,approved_for_reuse=null;
  for(const event of events){
    if(["captured","edited","rejected"].includes(event.kind)){
      reviewed_fingerprint=null;approved_for_daily=null;approved_for_reuse=null;
    }else if(event.kind==="reviewed"){
      reviewed_fingerprint=event.fingerprint;approved_for_daily=null;approved_for_reuse=null;
    }else if(event.kind==="approved_for_daily"){
      approved_for_daily={revision:event.source_revision,fingerprint:event.fingerprint,approved_at:event.occurred_at};
    }else if(event.kind==="approved_for_reuse"){
      approved_for_reuse={revision:event.source_revision,fingerprint:event.fingerprint,approved_at:event.occurred_at};
    }else throw Error("bad_review_event");
  }
  return {schema_version:1,source_id:id,server_revision:h.current_revision,
    revisions,events,reviewed_fingerprint,approved_for_daily,approved_for_reuse};
}
function expose(state,{includeRecord=true,includeEvents=false}={}) {
  const latest=getCloudSourceRevision(state);
  return {
    source_id:state.source_id,revision:state.server_revision,
    fingerprint:latest.fingerprint,review_status:latest.record.review_status,
    approvals:cloudApprovals(state),
    ...(includeRecord?{record:latest.record}:{}),
    ...(includeEvents?{events:state.events}:{}),
  };
}
function precondition(body) {
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)
    throw new Error("missing_revision");
  return body.expectedRevision;
}
function conflict(error){
  if(error instanceof CloudRevisionConflict)return fail("revision_conflict",409,{currentRevision:error.currentRevision});
  return null;
}
function isWriteAllowed(request) {
  const url=new URL(request.url);
  const origin=request.headers.get("origin");
  const fetchSite=request.headers.get("sec-fetch-site");
  if(origin && origin!==url.origin)return false;
  if(fetchSite && !["same-origin","none"].includes(fetchSite))return false;
  return true;
}
/**
 * Remote writes are D1 batch transactions. The first statement is CAS.
 * Subsequent history writes are conditional on the HEAD revision+fingerprint
 * and cannot overwrite past revisions. D1 batch provides an atomic transaction.
 */
async function commitState(db,owner,oldState,nextState,libraryEntry=null) {
  const next=getCloudSourceRevision(nextState);
  const event=nextState.events.at(-1);
  const now=next.changed_at;
  const old=currentRevision(oldState);
  const queries=[
    db.prepare("UPDATE cloud_source_heads SET current_revision=?,current_fingerprint=?,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=? AND current_fingerprint=?")
      .bind(next.revision,next.fingerprint,now,owner,oldState.source_id,old,oldState.revisions.at(-1).fingerprint),
    db.prepare("INSERT INTO cloud_source_revisions (owner_sub,source_id,revision,content_fingerprint,source_record_json,changed_at) SELECT ?,?,?,?,?,? FROM cloud_source_heads WHERE owner_sub=? AND source_id=? AND current_revision=? AND current_fingerprint=?")
      .bind(owner,oldState.source_id,next.revision,next.fingerprint,JSON.stringify(next.record),now,owner,oldState.source_id,next.revision,next.fingerprint),
    db.prepare("INSERT INTO cloud_source_review_events (event_id,owner_sub,source_id,source_revision,content_fingerprint,action,acted_at) SELECT ?,?,?,?,?,?,? FROM cloud_source_revisions WHERE owner_sub=? AND source_id=? AND revision=? AND content_fingerprint=?")
      .bind(crypto.randomUUID(),owner,oldState.source_id,next.revision,next.fingerprint,event.kind,event.occurred_at,owner,oldState.source_id,next.revision,next.fingerprint),
  ];
  if(libraryEntry){
    queries.push(db.prepare("INSERT INTO cloud_library_snapshots (owner_sub,source_id,approved_source_revision,content_fingerprint,library_entry_json,approved_at) SELECT ?,?,?,?,?,? FROM cloud_source_revisions WHERE owner_sub=? AND source_id=? AND revision=? AND content_fingerprint=?")
      .bind(owner,oldState.source_id,next.revision,next.fingerprint,JSON.stringify(libraryEntry),libraryEntry.approved_at,owner,oldState.source_id,next.revision,next.fingerprint));
  }
  let results;
  try{results=await db.batch(queries);}catch(error) {
    if(/UNIQUE|constraint|PRIMARY KEY/i.test(String(error?.message)))return {error:"revision_conflict",status:409};
    throw error;
  }
  if(results[0].meta.changes!==1)return {error:"revision_conflict",status:409};
  if(results.slice(1).some(result=>result.meta.changes!==1))throw Error("inconsistent_write");
  return {ok:true};
}
function currentRevision(state){return state.server_revision;}
async function newState(db,owner,id,record) {
  const next=await createCloudSourceState(record,new Date().toISOString());
  const rev=getCloudSourceRevision(next),event=next.events[0];
  const existing=await db.prepare("SELECT COUNT(*) AS n FROM cloud_source_heads WHERE owner_sub=?").bind(owner).first();
  if(existing.n>=MAX_RECORDS)return fail("synthetic_quota_reached",429);
  try {
    await db.batch([
      db.prepare("INSERT INTO cloud_source_heads (owner_sub,source_id,current_revision,current_fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?)")
        .bind(owner,id,1,rev.fingerprint,rev.changed_at,rev.changed_at),
      db.prepare("INSERT INTO cloud_source_revisions (owner_sub,source_id,revision,content_fingerprint,source_record_json,changed_at) VALUES(?,?,?,?,?,?)")
        .bind(owner,id,1,rev.fingerprint,JSON.stringify(rev.record),rev.changed_at),
      db.prepare("INSERT INTO cloud_source_review_events (event_id,owner_sub,source_id,source_revision,content_fingerprint,action,acted_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),owner,id,1,rev.fingerprint,event.kind,event.occurred_at),
    ]);
    return respond(expose(next),201);
  } catch(error) {
    if(/UNIQUE|constraint|PRIMARY KEY/i.test(String(error?.message)))return fail("duplicate_source",409);
    throw error;
  }
}
export async function handleCloudApi(request,env,auth,path) {
  if(env.SYNTHETIC_ONLY!=="true"||env.CLOUD_ACCESS_REQUIRED!=="true")return fail("preview_config_required",503);
  if(!env.DB)return fail("database_not_bound",503);
  const owner=ownerScoped(auth);
  const parts=path.split("/").filter(Boolean);
  if(parts[0]!=="api"||parts[1]!=="cloud")return fail("not_found",404);
  const method=request.method;
  if(method!=="GET"&&!isWriteAllowed(request))return fail("cross_origin_blocked",403);
  if(method==="GET"&&parts.length===3&&parts[2]==="health")
    return respond({status:"ready",schema_version:1,synthetic_only:true});
  if(method==="GET"&&parts.length===3&&parts[2]==="capabilities")
    return respond({
      gateway_version:1,
      api_version:1,
      source_record_version:2,
      source_library_version:4,
      full_field_synthetic_version:1,
      access_enforced:true,
      same_origin_required:true,
      synthetic_only:true,
      real_sources_opt_in:false,
      expected_revision_required:true,
      human_approval_required:true,
      max_record_bytes:MAX_INPUT,
      scope:"protected_owner_synthetic_preview",
    });
  if(method==="GET"&&parts.length===3&&parts[2]==="fixture")
    return respond({record:fullSyntheticFixture(),daily:DAILY});
  if(method==="GET"&&parts.length===3&&parts[2]==="records"){
    const rows=await env.DB.prepare("SELECT source_id FROM cloud_source_heads WHERE owner_sub=? ORDER BY updated_at DESC LIMIT ?").bind(owner,MAX_RECORDS).all();
    const records=[];
    for(const row of rows.results){
      const state=await loadState(env.DB,owner,row.source_id);
      records.push(expose(state,{includeRecord:false}));
    }
    return respond({records});
  }
  if(method==="POST"&&parts.length===3&&parts[2]==="records"){
    let body;try{body=await parseJson(request);}catch(e){return fail(e.message,400);}
    if(!allowSynthetic(body.record,body.source_id,env))return fail("synthetic_record_required");
    return newState(env.DB,owner,body.source_id,body.record);
  }
  if(parts[2]==="library"&&method==="GET"&&parts.length===3){
    const rows=await env.DB.prepare("SELECT source_id,approved_source_revision,content_fingerprint,approved_at FROM cloud_library_snapshots WHERE owner_sub=? ORDER BY approved_at DESC LIMIT 40").bind(owner).all();
    return respond({entries:rows.results});
  }
  const id=parts[3];
  if(parts[2]!=="records"||!ID.test(id??""))return fail("not_found",404);
  const state=await loadState(env.DB,owner,id);
  if(!state)return fail("not_found",404);
  if(method==="GET"&&parts.length===4)return respond(expose(state));
  if(method==="GET"&&parts.length===5&&parts[4]==="history")
    return respond(expose(state,{includeRecord:false,includeEvents:true}));
  if(method==="GET"&&parts.length===5&&parts[4]==="library-history"){
    // Audit metadata only; historical approved snapshots are never automatically reusable.
    const rows=await env.DB.prepare("SELECT approved_source_revision,content_fingerprint,approved_at FROM cloud_library_snapshots WHERE owner_sub=? AND source_id=? ORDER BY approved_source_revision DESC LIMIT 20").bind(owner,id).all();
    return respond({snapshots:rows.results.map(row=>({...row,current_approved:Boolean(
      cloudApprovals(state).reuse
      && row.approved_source_revision===state.approved_for_reuse?.revision
      && row.content_fingerprint===getCloudSourceRevision(state).fingerprint
    )}))});
  }
  if(method==="GET"&&parts.length===5&&parts[4]==="library"){
    const row=await env.DB.prepare("SELECT approved_source_revision,content_fingerprint,library_entry_json FROM cloud_library_snapshots WHERE owner_sub=? AND source_id=? ORDER BY approved_source_revision DESC LIMIT 1").bind(owner,id).first();
    if(!row)return fail("library_not_approved",404);
    const approved=cloudApprovals(state).reuse
      && state.approved_for_reuse?.revision===row.approved_source_revision
      && row.content_fingerprint===getCloudSourceRevision(state).fingerprint;
    if(!approved)return fail("library_approval_stale",409,{historical_snapshot_exists:true});
    const entry=JSON.parse(row.library_entry_json);
    if(!validateSourceLibraryEntry(entry))return fail("library_invalid",503);
    return respond({entry,current_approved:true});
  }
  if(method!=="PUT"&&method!=="POST")return fail("not_found",404);
  let body;try{body=await parseJson(request);}catch(e){return fail(e.message,400);}
  let expected;try{expected=precondition(body);}catch(e){return fail(e.message,400);}
  if(state.server_revision!==expected)return fail("revision_conflict",409,{currentRevision:state.server_revision});
  const now=new Date().toISOString();
  let next, libraryEntry=null;
  try{
    if(method==="PUT"&&parts.length===4){
      if(!allowSynthetic(body.record,id,env))return fail("synthetic_record_required");
      next=await editCloudSourceState(state,expected,body.record,now);
    }else if(method==="POST"&&parts.length===5&&parts[4]==="review"){
      next=reviewCloudSourceState(state,expected,now);
    }else if(method==="POST"&&parts.length===5&&parts[4]==="approve-daily"){
      // Reject arbitrary metadata; only exact synthetic testing data accepted.
      if(digestJson(body.daily)!==digestJson(DAILY))return fail("synthetic_daily_metadata_required");
      next=approveCloudSourceState(state,expected,"daily_candidate",now,DAILY);
    }else if(method==="POST"&&parts.length===5&&parts[4]==="approve-reuse"){
      next=approveCloudSourceState(state,expected,"source_reuse",now);
      libraryEntry=createSourceLibraryEntry(getApprovedCloudSourceRecord(next,"source_reuse"),now);
      if(!validateSourceLibraryEntry(libraryEntry))return fail("library_validation_failed");
    }else return fail("not_found",404);
  }catch(error){
    const r=conflict(error);if(r)return r;
    return fail("review_or_approval_blocked",422);
  }
  const outcome=await commitState(env.DB,owner,state,next,libraryEntry);
  if(!outcome.ok)return fail(outcome.error,outcome.status);
  return respond(expose(next));
}
