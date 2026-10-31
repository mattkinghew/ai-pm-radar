import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {handleSourceSync,purgeSourceSync} from "./service.mjs";
import {STABLE_FIXTURES,syntheticRecord} from "./fixtures.mjs";
const BASE=JSON.parse(readFileSync(new URL("../phase13-one-article/fixtures/clean-room-public-article.json",import.meta.url)));
const sha=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const owner="cf_"+createHash("sha256").update("owner@example.invalid").digest("hex");
const anotherOwner="cf_"+createHash("sha256").update("other@example.invalid").digest("hex");
const origin="https://radar-phase15.example.invalid";
function fixture(n=1){
 return syntheticRecord(STABLE_FIXTURES[n-1],0);
}
function alternate(n=1){
 return syntheticRecord(STABLE_FIXTURES[n-1],1);
}
function localDb(){
 const conn=new DatabaseSync(":memory:");
 conn.exec("PRAGMA foreign_keys=ON");
 conn.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
 const db={
  prepare(sql){
   const make=args=>{
    const stmt=conn.prepare(sql);
    return {first:async()=>stmt.get(...args)??null,
      all:async()=>({results:stmt.all(...args)}),
      run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})}
   };
   return {bind:(...args)=>make(args),...make([])};
  },
  async batch(stmts){
   const done=[];
   conn.exec("BEGIN IMMEDIATE");
   try{
    for(const statement of stmts)done.push(await statement.run());
    conn.exec("COMMIT");return done;
   }catch(e){conn.exec("ROLLBACK");throw e}
  }
 };
 return {conn,db,env:{SYNC_DB:db,SOURCE_SYNC_ENABLED:"true",SOURCE_SYNC_SYNTHETIC_ONLY:"true"}};
}
function bodyFor(record){
 const canonical={...record,review_status:"needs_review",approval_status:"not_approved"};
 return {record,authorization:{
   source_id:record.id,content_sha256:sha(canonical),
   backup_verified:true,rights_confirmed:true,
   seven_day_retention_accepted:true,time_travel_residual_acknowledged:true
 }};
}
function request(route,method="GET",body,extraHeaders={}){
 return new Request(origin+"/api/source-sync/v1/"+route,{
  method,headers:{"sec-fetch-site":"same-origin",...extraHeaders,
   ...(body===undefined?{}:{"content-type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function ask(env,route,method="GET",body,who=owner,headers={}){
 const response=await handleSourceSync(request(route,method,body,headers),env,who);
 return {status:response.status,data:await response.json()};
}
function counts(db){
 const tables=["sync_documents","sync_revisions","sync_events"];
 return tables.map(t=>db.prepare("SELECT COUNT(*) AS n FROM "+t).first().then(v=>v.n));
}
test("server capability flag OFF and absent DB guarantee no write",async()=>{
 const {conn,env}=localDb();
 for(const patch of [
  {SOURCE_SYNC_ENABLED:"false"},
  {SOURCE_SYNC_SYNTHETIC_ONLY:"false"},
  {SYNC_DB:null},
 ]){
  const state={...env,...patch};
  const cap=await ask(state,"capabilities");
  assert.equal(cap.status,200);
  assert.equal(cap.data.enabled,false);
  assert.equal(cap.data.real_sources_allowed,false);
  assert.equal(cap.data.max_retention_days,7);
  assert.equal((await ask(state,"records","POST",bodyFor(fixture()))).status,403);
 }
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[0,0,0]);
 conn.close();
});
test("two distinct synthetic records, independent access, exact original backup and hash",async()=>{
 const {conn,env}=localDb();
 const source1=fixture(1),source2=fixture(2);
 for(const record of [source1,source2]){
  const result=await ask(env,"records","POST",bodyFor(record));
  assert.equal(result.status,201,JSON.stringify(result));
  assert.equal(result.data.revision,1);
  assert.equal(result.data.sha256,sha({...record,review_status:"needs_review",approval_status:"not_approved"}));
  assert.equal(result.data.review_status,"needs_review");
  assert.equal(result.data.approval_status,"not_approved");
 }
 const list=await ask(env,"records");
 assert.equal(list.status,200);
 assert.equal(list.data.records.length,2);
 const current=await ask(env,"records/"+source1.id);
 assert.equal(current.status,200);
 assert.deepEqual(current.data.record,{...source1,review_status:"needs_review",approval_status:"not_approved"});
 assert.equal(current.data.sha256,sha(current.data.record));
 assert.equal((await ask(env,"records/"+source2.id,"GET",undefined,anotherOwner)).status,404);
 assert.equal((await ask(env,"records","GET",undefined,anotherOwner)).data.records.length,0);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[2,2,2]);
 conn.close();
});
test("manual full source edit advances just one article, invalidates approval, preserves original TTL",async()=>{
 const {conn,env}=localDb();
 const source1=fixture(1),source2=fixture(2);
 for(const source of [source1,source2])assert.equal((await ask(env,"records","POST",bodyFor(source))).status,201);
 const original=await ask(env,"records/"+source1.id);
 const changed={...alternate(1),review_status:"reviewed",approval_status:"approved"};
 const payload={...bodyFor(changed),expectedRevision:1,expectedSha256:original.data.sha256};
 const reply=await ask(env,"records/"+source1.id,"PUT",payload);
 assert.equal(reply.status,200,JSON.stringify(reply));
 assert.equal(reply.data.revision,2);
 assert.equal(reply.data.purge_due_at,original.data.purge_due_at);
 assert.equal(reply.data.approval_status,"not_approved");
 const again=await ask(env,"records/"+source1.id);
 assert.equal(again.data.revision,2);
 assert.equal(again.data.record.review_status,"needs_review");
 assert.equal(again.data.record.approval_status,"not_approved");
 assert.equal(again.data.record.summary,changed.summary);
 const other=await ask(env,"records/"+source2.id);
 assert.equal(other.data.revision,1);
 const history=await ask(env,"records/"+source1.id+"/history");
 assert.deepEqual(history.data.revisions.map(x=>x.revision),[1,2]);
 assert.equal((await ask(env,"records/"+source1.id,"PUT",payload)).status,409);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[2,3,3]);
 conn.close();
});
test("reject arbitrary/private records, invalid rights/evidence, missing per-article consent, CSRF",async()=>{
 const {conn,env}=localDb();
 const source=fixture(1),payload=bodyFor(source);
 for(const bad of [
  {...payload,record:{...source,title:"Not synthetic"}},
  {...payload,record:{...source,source_url:"https://example.com/private"}},
  {...payload,record:{...source,rights_note:"rights unknown"}},
  {...payload,record:{...source,raw_text:"no matching source citations"}},
  {...payload,record:{...source,analysis:{...source.analysis,status:"processing"}}},
 ]){
  const reply=await ask(env,"records","POST",bad);
  assert.equal(reply.status,422,JSON.stringify(reply));
 }
 for(const bad of [
  {...payload,authorization:{...payload.authorization,backup_verified:false}},
  {...payload,authorization:{...payload.authorization,source_id:fixture(2).id}},
  {...payload,authorization:{...payload.authorization,content_sha256:"0".repeat(64)}},
  {...payload,authorization:{...payload.authorization,owner_sub:owner}},
 ]){
  const reply=await ask(env,"records","POST",bad);
  assert.equal(reply.status,403,JSON.stringify(reply));
 }
 assert.equal((await ask(env,"records","POST",payload,owner,{"sec-fetch-site":"cross-site"})).status,403);
 assert.equal((await ask(env,"records","POST",{...payload,extra:true})).status,422);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[0,0,0]);
 conn.close();
});
test("per-owner quota 5, duplicate ID 409, unrelated owner still free",async()=>{
 const {conn,env}=localDb();
 for(let n=1;n<=5;n++){
  const res=await ask(env,"records","POST",bodyFor(fixture(n)));
  assert.equal(res.status,201,JSON.stringify(res));
 }
 assert.equal((await ask(env,"records","POST",bodyFor(fixture(6)))).status,409);
 assert.equal((await ask(env,"records","POST",bodyFor(fixture(1)))).status,409);
 assert.equal((await ask(env,"records","POST",bodyFor(fixture(6)),anotherOwner)).status,201);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[6,6,6]);
 conn.close();
});
test("parent delete guarded by explicit Owner + CAS cascades revisions and events only of that article",async()=>{
 const {conn,env}=localDb();
 for(const source of [fixture(1),fixture(2)]){
  assert.equal((await ask(env,"records","POST",bodyFor(source))).status,201);
 }
 const id=fixture(1).id,body={source_id:id,expectedRevision:1,confirmation:"DELETE_THIS_SOURCE"};
 assert.equal((await ask(env,"records/"+id,"DELETE",{...body,confirmation:"DELETE"})).status,403);
 assert.equal((await ask(env,"records/"+id,"DELETE",{...body,expectedRevision:2})).status,409);
 assert.equal((await ask(env,"records/"+id,"DELETE",body,anotherOwner)).status,404);
 assert.equal((await ask(env,"records/"+id,"DELETE",body)).status,200);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[1,1,1]);
 assert.equal((await ask(env,"records/"+fixture(2).id)).status,200);
 conn.close();
});
test("active retention requires exactly seven days; after expiry GET 410 and hourly purge cascades",async()=>{
 const {conn,env}=localDb();
 const result=await ask(env,"records","POST",bodyFor(fixture()));
 assert.equal(result.status,201);
 const head=env.SYNC_DB.prepare("SELECT created_at,purge_due_at FROM sync_documents").first();
 assert.equal(Date.parse((await head).purge_due_at)-Date.parse((await head).created_at),7*86400_000);
 conn.prepare("UPDATE sync_documents SET purge_due_at='2000-01-01T00:00:00Z'").run();
 assert.equal((await ask(env,"records/"+fixture().id)).status,410);
 assert.equal((await ask(env,"records")).data.records.length,0);
 const purged=await purgeSourceSync(env,new Date().toISOString());
 assert.deepEqual(purged,{purged:1,disabled:false});
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[0,0,0]);
 const noop=await purgeSourceSync({...env,SOURCE_SYNC_ENABLED:"false"},new Date().toISOString());
 assert.equal(noop.disabled,true);
 conn.close();
});
test("revision and audit history are immutable in database regardless of API authority",async()=>{
 const {conn,env}=localDb();
 assert.equal((await ask(env,"records","POST",bodyFor(fixture()))).status,201);
 assert.throws(()=>conn.prepare("UPDATE sync_revisions SET revision=3 WHERE revision=1").run(),/immutable/);
 assert.throws(()=>conn.prepare("UPDATE sync_events SET kind='edited' WHERE revision=1").run(),/immutable/);
 conn.close();
});
test("missing or attacker-supplied owner principal never reads or writes",async()=>{
 const {conn,env}=localDb();
 assert.equal((await ask(env,"records","GET",undefined,null)).status,401);
 assert.equal((await ask(env,"records","POST",bodyFor(fixture()),"cf_attack")).status,401);
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[0,0,0]);
 conn.close();
});
test("source sync revision cap enforces 8 immutable history rows with 409 on ninth",async()=>{
 const {conn,env}=localDb();
 const source=fixture(1);
 assert.equal((await ask(env,"records","POST",bodyFor(source))).status,201);
 let last=await ask(env,"records/"+source.id);
 for(let v=2;v<=8;v++){
  const changed=v%2===0?alternate(1):fixture(1);
  const body={...bodyFor(changed),expectedRevision:v-1,expectedSha256:last.data.sha256};
  const next=await ask(env,"records/"+source.id,"PUT",body);
  assert.equal(next.status,200,JSON.stringify(next));
  last=await ask(env,"records/"+source.id);
  assert.equal(last.data.revision,v);
 }
 const finalChange=alternate(1);
 const blocked=await ask(env,"records/"+source.id,"PUT",{
  ...bodyFor(finalChange),expectedRevision:8,expectedSha256:last.data.sha256
 });
 assert.equal(blocked.status,409);
 assert.equal(blocked.data.code,"revision_limit");
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[1,8,8]);
 conn.close();
});
test("racing update after head read returns 409 and does not duplicate historical event rows",async()=>{
 const {conn,env}=localDb(),source=fixture(1);
 assert.equal((await ask(env,"records","POST",bodyFor(source))).status,201);
 const old=await ask(env,"records/"+source.id);
 const revision2=alternate(1);
 let injected=false;
 env.SYNC_DB={...env.SYNC_DB,async batch(actions){
  if(!injected){
   injected=true;
   const now=new Date().toISOString();
   const digest=sha({...revision2,review_status:"needs_review",approval_status:"not_approved"});
   conn.prepare("UPDATE sync_documents SET current_revision=2,content_sha256=?,updated_at=? WHERE owner_sub=? AND source_id=?")
    .run(digest,now,owner,source.id);
   conn.prepare("INSERT INTO sync_revisions VALUES (?,?,?,?,?,?)")
    .run(owner,source.id,2,digest,JSON.stringify({...revision2,review_status:"needs_review",approval_status:"not_approved"}),now);
   conn.prepare("INSERT INTO sync_events VALUES (?,?,?,?,?)")
    .run(owner,source.id,2,"edited",now);
  }
  return env.SYNC_DB_ORIGINAL.batch(actions);
 }};
 env.SYNC_DB_ORIGINAL={prepare:env.SYNC_DB.prepare,batch:localDbPlaceholder=>{}};
 // Use the original SQLite API before the wrapped intercept.
 const orig=env.SYNC_DB;
 env.SYNC_DB_ORIGINAL.batch=async statements=>{
  const output=[];conn.exec("BEGIN IMMEDIATE");
  try{for(const st of statements)output.push(await st.run());conn.exec("COMMIT");return output}
  catch(e){conn.exec("ROLLBACK");throw e}
 };
 const proposal=alternate(1);
 const result=await ask(env,"records/"+source.id,"PUT",{
  ...bodyFor(proposal),expectedRevision:1,expectedSha256:old.data.sha256
 });
 assert.equal(result.status,409,JSON.stringify(result));
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[1,2,2]);
 assert.equal((await ask(env,"records/"+source.id)).data.record.summary,revision2.summary);
 conn.close();
});
test("actual authenticated Worker exposes only capability and rejects multi-source writes with flag OFF",async()=>{
 const {conn,env}=localDb();
 const {default: worker}=await import("../phase13-one-article/worker.mjs");
 const crypto2=await import("node:crypto");
 const ownerEmail="owner@example.invalid";
 const identityHash=crypto2.createHash("sha256").update(ownerEmail).digest("hex");
 const fake={...env,CLOUD_ACCESS_REQUIRED:"true",OWNER_EMAIL_SHA256:identityHash,
  SOURCE_SYNC_ENABLED:"false",
  PILOT_REAL_UPLOAD_ENABLED:"false",PILOT_CONTROLLED_COMMIT_ENABLED:"false",
  DB:{prepare:()=>{throw Error("legacy D1 must not be accessed during source sync capability")}},
 };
 const ownerCtx={access:{getIdentity:async()=>({email:ownerEmail})}};
 const otherCtx={access:{getIdentity:async()=>({email:"other@example.invalid"})}};
 const capReq=request("capabilities");
 for(const ctx of [{},otherCtx]){
  const denied=await worker.fetch(capReq,fake,ctx);
  assert.equal(denied.status,401);
 }
 const capability=await worker.fetch(capReq,fake,ownerCtx);
 assert.equal(capability.status,200);
 const caps=await capability.json();
 assert.equal(caps.enabled,false);
 assert.equal(caps.real_sources_allowed,false);
 const forbidden=await worker.fetch(request("records","POST",bodyFor(fixture())),fake,ownerCtx);
 assert.equal(forbidden.status,403);
 assert.equal((await forbidden.json()).code,"source_sync_disabled");
 assert.deepEqual(await Promise.all(counts(env.SYNC_DB)),[0,0,0]);
 conn.close();
});
