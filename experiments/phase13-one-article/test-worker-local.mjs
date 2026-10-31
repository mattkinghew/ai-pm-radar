import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import worker from "./worker.mjs";
import {verifyCloudflareAccessOwner} from "./access-jwt.mjs";
const fixture=JSON.parse(readFileSync(new URL("./fixtures/clean-room-public-article.json",import.meta.url)));
const sha=x=>createHash("sha256").update(x).digest("hex");
const alternate={...fixture,summary:"修訂版：為跨裝置協作增加明確備份與人工衝突處理。"};
const digest=sha("owner-test@example.invalid");
const envDefault={
 OWNER_EMAIL_SHA256:digest,CLOUD_ACCESS_REQUIRED:"true",PILOT_REAL_UPLOAD_ENABLED:"false",
 PINNED_ARTICLE_ID:fixture.id,
 PINNED_ARTICLE_SHA256:sha(JSON.stringify(fixture)),
 PINNED_UPDATE_SHA256:sha(JSON.stringify(alternate)),
 PURGE_JOB_ENABLED:"true",
};
const ctxOwner={access:{getIdentity:async()=>({email:"owner-test@example.invalid"})}};
const ctxOther={access:{getIdentity:async()=>({email:"unauthorized@example.invalid"})}};
const base="https://radar-phase13-dark.example.invalid";
const accessIssuer="https://radar-synthetic.cloudflareaccess.com";
const accessAudience="radar-synthetic-owner-app";
const {privateKey:accessPrivateKey,publicKey:accessPublicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const accessJwk=accessPublicKey.export({format:"jwk"});
accessJwk.kid="synthetic-access-test-key";
accessJwk.alg="RS256";
accessJwk.use="sig";
const accessNow=Math.floor(Date.now()/1000);
function accessToken(overrides={}){
 const header=Buffer.from(JSON.stringify({alg:"RS256",kid:accessJwk.kid,typ:"JWT"})).toString("base64url");
 const claims=Buffer.from(JSON.stringify({iss:accessIssuer,aud:[accessAudience],type:"app",
  email:"owner-test@example.invalid",iat:accessNow-30,nbf:accessNow-30,exp:accessNow+300,...overrides})).toString("base64url");
 const signature=sign("RSA-SHA256",Buffer.from(`${header}.${claims}`),accessPrivateKey).toString("base64url");
 return `${header}.${claims}.${signature}`;
}
const accessEnv={CF_ACCESS_TEAM_DOMAIN:accessIssuer,CF_ACCESS_AUD:accessAudience};
const consent=Object.fromEntries([
 "original_local_backup_verified","original_local_backup_restored",
 "public_original_content_confirmed","no_confidential_or_sensitive_data",
 "seven_day_retention_accepted","cloud_time_travel_residual_accepted",
 "this_single_article_upload_authorized",
].map(k=>[k,true]));
function wrapDb(){
 const conn=new DatabaseSync(":memory:");
 conn.exec("PRAGMA foreign_keys=ON");
 conn.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
 const api={
  prepare(sql){
   const make=(values)=>{
    const stmt=conn.prepare(sql);
    return {
     first:async()=>stmt.get(...values)??null,
     all:async()=>({results:stmt.all(...values)}),
     run:async()=>({meta:{changes:Number(stmt.run(...values).changes)}}),
    };
   };
   return {bind:(...values)=>make(values),...make([])};
  },
  async batch(items){
   conn.exec("BEGIN IMMEDIATE");
   try{
    const replies=[];
    for(const query of items) replies.push(await query.run());
    conn.exec("COMMIT");return replies;
   }catch(e){conn.exec("ROLLBACK");throw e}
  },
 };
 return {conn,api};
}
function request(route,method="GET",payload=null,site="same-origin"){
 const headers={...(payload===null?{}:{"content-type":"application/json"}),"sec-fetch-site":site};
 return new Request(base+route,{method,headers,...(payload===null?{}:{body:JSON.stringify(payload)})});
}
async function response(r,env,ctx=ctxOwner){const res=await worker.fetch(r,env,ctx);return {status:res.status,data:await res.json()}}
test("Dark deployment denies unauthenticated/wrong identity before any D1 read",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api};
 for(const ctx of [{},ctxOther]){
  const res=await response(request("/api/pilot/capabilities"),env,ctx);
  assert.equal(res.status,401);
 }
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});
test("Authentication failures never expose internal diagnostics or touch D1",async()=>{
 const db=wrapDb(),env={...envDefault,...accessEnv,DB:db.api};
 const plain=await response(request("/api/source-sync/v1/capabilities"),env,{});
 assert.deepEqual(plain.data,{code:"unauthenticated"});
 const diagnostic=await response(request("/api/source-sync/v1/capabilities?auth_diagnostic=1"),env,{});
 assert.deepEqual(diagnostic.data,{code:"unauthenticated"});
 const malformedRequest=new Request(base+"/api/source-sync/v1/capabilities?auth_diagnostic=1",{
  headers:{"Cf-Access-Jwt-Assertion":"not-a-jwt"},
 });
 const malformed=await response(malformedRequest,env,{});
 assert.deepEqual(malformed.data,{code:"unauthenticated"});
 const otherRoute=await response(request("/api/pilot/capabilities?auth_diagnostic=1"),env,{});
 assert.deepEqual(otherRoute.data,{code:"unauthenticated"});
 assert.equal(JSON.stringify(diagnostic.data).includes("owner-test@example.invalid"),false);
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});
test("JWT verifier safely classifies JWKS redirect, transport, payload and key-id failures",async()=>{
 const call=async(issuer,fetchImpl)=>{
  const diagnostics=[];
  const env={...envDefault,CF_ACCESS_TEAM_DOMAIN:issuer,CF_ACCESS_AUD:accessAudience};
  const req=new Request(`${base}/api/source-sync/v1/capabilities`,{
   headers:{"Cf-Access-Jwt-Assertion":accessToken({iss:issuer})},
  });
  const principal=await verifyCloudflareAccessOwner(req,env,{
   nowMs:accessNow*1000,fetchImpl,onDiagnostic:stage=>diagnostics.push(stage),
  });
  assert.equal(principal,null);
  return diagnostics.at(-1);
 };
 const unavailableIssuer="https://jwks-unavailable.cloudflareaccess.com";
 const unavailable=await call(unavailableIssuer,async()=>new Response("{}",{status:503}));
 assert.equal(unavailable,"access_jwks_http_5xx");

 const requestFailureIssuer="https://jwks-request-failure.cloudflareaccess.com";
 const requestFailure=await call(requestFailureIssuer,async()=>{throw new TypeError("synthetic transport failure")});
 assert.equal(requestFailure,"access_jwks_request_failed");

 const redirectIssuer="https://jwks-redirect.cloudflareaccess.com";
 const redirect=await call(redirectIssuer,async(_url,init)=>{
  assert.equal(init.redirect,"manual");
  return new Response(null,{status:302,headers:{location:"https://private.example.invalid/access/certs"}});
 });
 assert.equal(redirect,"access_jwks_redirect_rejected");

 const invalidPayloadIssuer="https://jwks-invalid-payload.cloudflareaccess.com";
 const invalidPayload=await call(invalidPayloadIssuer,async()=>new Response("not-json"));
 assert.equal(invalidPayload,"access_jwks_invalid_payload");

 const mismatchIssuer="https://kid-mismatch.cloudflareaccess.com";
 const mismatch=await call(mismatchIssuer,async()=>new Response(JSON.stringify({keys:[{...accessJwk,kid:"different-synthetic-kid"}]})));
 assert.equal(mismatch,"access_signing_key_id_not_found");
});
test("Static Assets JWT fallback verifies RS256, issuer, audience, lifetime and exact Owner hash",async(t)=>{
 const previousFetch=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,`${accessIssuer}/cdn-cgi/access/certs`);
  assert.equal(init.redirect,"manual");
  return new Response(JSON.stringify({keys:[accessJwk]}),{headers:{"content-type":"application/json"}});
 };
 t.after(()=>{globalThis.fetch=previousFetch});
 const db=wrapDb(),env={...envDefault,...accessEnv,DB:db.api};
 const call=async token=>response(new Request(base+"/api/pilot/capabilities",{
  headers:{"Cf-Access-Jwt-Assertion":token},
 }),env,{});
 assert.equal((await call(accessToken())).status,200);
 const tampered=accessToken().split(".");
 tampered[1]=Buffer.from(JSON.stringify({iss:accessIssuer,aud:[accessAudience],type:"app",
  email:"owner-test@example.invalid",iat:accessNow-30,exp:accessNow+300})).toString("base64url");
 assert.equal((await call(tampered.join("."))).status,401);
 for(const claims of [
  {iss:"https://attacker.cloudflareaccess.com"},
  {aud:["other-audience"]},
  {exp:accessNow-120},
  {nbf:accessNow+120},
  {email:"other@example.invalid"},
 ]) assert.equal((await call(accessToken(claims))).status,401);
 assert.equal((await call("forged.header.value")).status,401);
 assert.equal((await response(request("/api/pilot/capabilities"),
  {...env,CLOUD_ACCESS_REQUIRED:"false"},{})).status,401);
 db.conn.close();
});
test("JWT fallback fails closed when the Access team issuer or application audience is missing",async()=>{
 const db=wrapDb(),env={...envDefault,...accessEnv,DB:db.api};
 const requestWithToken=new Request(base+"/api/pilot/capabilities",{
  headers:{"Cf-Access-Jwt-Assertion":accessToken()},
 });
 for(const incomplete of [
  {...env,CF_ACCESS_TEAM_DOMAIN:undefined},
  {...env,CF_ACCESS_AUD:undefined},
 ]){
  const result=await worker.fetch(requestWithToken,incomplete,{});
  assert.equal(result.status,401);
  assert.deepEqual(await result.json(),{code:"unauthenticated"});
 }
 db.conn.close();
});
test("A present but non-owner ctx.access identity never falls back to an assertion header",async()=>{
 const db=wrapDb(),env={...envDefault,...accessEnv,DB:db.api};
 const r=new Request(base+"/api/pilot/capabilities",{headers:{"Cf-Access-Jwt-Assertion":accessToken()}});
 const result=await response(r,env,ctxOther);
 assert.equal(result.status,401);
 db.conn.close();
});
test("Default DARK profile never authorizes a real article",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api};
 const cap=await response(request("/api/pilot/capabilities"),env);
 assert.equal(cap.status,200);
 assert.equal(cap.data.real_upload_enabled,false);
 const denied=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(denied.status,403);
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});
test("Isolated local canary: exact one clean-room real Record -> v2 -> CAS409 -> owner purge",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 const notConsent=await response(request("/api/pilot/record","POST",{record:fixture,consent:{}}),env);
 assert.equal(notConsent.status,403);
 const wrongOrigin=await response(request("/api/pilot/record","POST",{record:fixture,consent},"cross-site"),env);
 assert.equal(wrongOrigin.status,403);
 const wrongRecord={...fixture,raw_text:"Client's confidential internal memo."};
 const rejected=await response(request("/api/pilot/record","POST",{record:wrongRecord,consent}),env);
 assert.equal(rejected.status,422);
 const created=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(created.status,201);
 assert.equal(created.data.revision,1);
 assert.equal(created.data.content_sha256,sha(JSON.stringify(fixture)));
 assert.equal(created.data.reviewed,false);
 assert.equal(created.data.approved,false);
 const stored=await response(request("/api/pilot/record"),env);
 assert.equal(stored.status,200);
 assert.deepEqual(stored.data.record,fixture);
 const duplicate=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(duplicate.status,409);
 const updated=await response(request("/api/pilot/record","PUT",{record:alternate,consent,expectedRevision:1}),env);
 assert.equal(updated.status,200);
 assert.equal(updated.data.revision,2);
 const stale=await response(request("/api/pilot/record","PUT",{record:alternate,consent,expectedRevision:1}),env);
 assert.equal(stale.status,409);
 const history=await response(request("/api/pilot/history"),env);
 assert.equal(history.data.events.length,2);
 assert.equal(history.data.events[0].kind,"created");
 assert.equal(history.data.events[1].kind,"edited");
 const unauthorizedRead=await response(request("/api/pilot/record"),env,ctxOther);
 assert.equal(unauthorizedRead.status,401);
 const invalidDelete=await response(request("/api/pilot/record","DELETE",
   {delete_confirmation:"DELETE_THIS_ONE_ARTICLE",expectedRevision:1}),env);
 assert.equal(invalidDelete.status,409);
 const deleted=await response(request("/api/pilot/record","DELETE",
   {delete_confirmation:"DELETE_THIS_ONE_ARTICLE",expectedRevision:2}),env);
 assert.equal(deleted.status,200);
 assert.equal(deleted.data.deleted,true);
 for(const table of ["pilot_documents","pilot_revisions","pilot_review_events"]){
  assert.equal(db.conn.prepare("SELECT count(*) AS n FROM "+table).get().n,0,table);
 }
 db.conn.close();
});
test("Daily expiry deletes only expired data; future record remains",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 let res=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(res.status,201);
 await worker.scheduled({scheduledTime:Date.now()+8*24*60*60*1000},env,{});
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});

test("expired article becomes unreadable even before hourly purge job",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 const result=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(result.status,201);
 db.conn.prepare("UPDATE pilot_documents SET purge_due_at=? WHERE source_id=?").run("2000-01-01T00:00:00Z",fixture.id);
 const expired=await response(request("/api/pilot/record"),env);
 assert.equal(expired.status,410);
 const noEdit=await response(request("/api/pilot/record","PUT",{record:alternate,consent,expectedRevision:1}),env);
 assert.equal(noEdit.status,410);
 await worker.scheduled({scheduledTime:Date.now()},env,{});
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});

test("Phase1.4B allowed summary preflight produces exact pinned hash without DB writes",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 const created=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(created.status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";
 env.PILOT_WRITE_PREFLIGHT_ENABLED="true";
 const before=JSON.stringify(db.conn.prepare("SELECT * FROM pilot_documents").all());
 const revisionsBefore=db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n;
 const accepted=await response(request("/api/pilot/update-preflight","POST",{
  expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),summary:alternate.summary,
 }),env);
 assert.equal(accepted.status,200,JSON.stringify(accepted.data));
 assert.equal(accepted.data.ready,true);
 assert.equal(accepted.data.proposed_sha256,sha(JSON.stringify(alternate)));
 assert.deepEqual(accepted.data.touched_fields,["summary"]);
 assert.equal(accepted.data.persisted,false);
 assert.equal(accepted.data.cloud_write_enabled,false);
 assert.equal(accepted.data.reapproval_required,true);
 assert.equal(accepted.data.review_status,"needs_review");
 assert.equal(accepted.data.approval_status,"not_approved");
 assert.equal(accepted.data.revision_after_preflight,1);
 assert.equal(JSON.stringify(db.conn.prepare("SELECT * FROM pilot_documents").all()),before);
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,revisionsBefore);
 const deniedPut=await response(request("/api/pilot/record","PUT",{
  record:alternate,expectedRevision:1,consent,
 }),env);
 assert.equal(deniedPut.status,403);
 db.conn.close();
});
test("Phase1.4B preflight rejects CSRF, unauthorized identities, arbitrary summary and unknown keys",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 assert.equal((await response(request("/api/pilot/record","POST",{record:fixture,consent}),env)).status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";
 env.PILOT_WRITE_PREFLIGHT_ENABLED="true";
 const body={expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),summary:alternate.summary};
 for(const ctx of [{},ctxOther]){
  const result=await response(request("/api/pilot/update-preflight","POST",body),env,ctx);
  assert.equal(result.status,401);
 }
 assert.equal((await response(request("/api/pilot/update-preflight","POST",body,"cross-site"),env)).status,403);
 for(const bad of [{...body,summary:"Confidential client material"},
   {...body,record:fixture},{...body,expectedRevision:4},
   {...body,expectedSha256:"0".repeat(64)},
   {...body,summary:""},
  ]){
  const result=await response(request("/api/pilot/update-preflight","POST",bad),env);
  assert.ok([409,422].includes(result.status),JSON.stringify(result));
 }
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,1);
 db.conn.close();
});
test("Phase1.4B preflight rejects expired record and is off by default",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 assert.equal((await response(request("/api/pilot/record","POST",{record:fixture,consent}),env)).status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";
 const body={expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),summary:alternate.summary};
 assert.equal((await response(request("/api/pilot/update-preflight","POST",body),env)).status,403);
 env.PILOT_WRITE_PREFLIGHT_ENABLED="true";
 db.conn.prepare("UPDATE pilot_documents SET purge_due_at=? WHERE source_id=?")
  .run("2000-01-01T00:00:00Z",fixture.id);
 assert.equal((await response(request("/api/pilot/update-preflight","POST",body),env)).status,410);
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,1);
 db.conn.close();
});

test("Phase1.4C commit is OFF by default and general POST/PUT remain OFF",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 assert.equal((await response(request("/api/pilot/record","POST",{record:fixture,consent}),env)).status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";
 const body={expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),
  backupSha256:sha(JSON.stringify(fixture)),confirmedSummary:alternate.summary,
  consentPhrase:"APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY"};
 const cap=await response(request("/api/pilot/capabilities"),env);
 assert.equal(cap.data.controlled_commit_enabled,false);
 assert.equal(cap.data.cloud_write_enabled,false);
 assert.equal((await response(request("/api/pilot/controlled-commit","POST",body),env)).status,403);
 assert.equal((await response(request("/api/pilot/record","PUT",{record:alternate,consent,expectedRevision:1}),env)).status,403);
 assert.equal(db.conn.prepare("SELECT current_revision AS n FROM pilot_documents").get().n,1);
 db.conn.close();
});
test("Phase1.4C local-only authorized commit performs immutable revision2 with same TTL",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 assert.equal((await response(request("/api/pilot/record","POST",{record:fixture,consent}),env)).status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";env.PILOT_CONTROLLED_COMMIT_ENABLED="true";
 const before=db.conn.prepare("SELECT purge_due_at,created_at FROM pilot_documents").get();
 const body={expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),
  backupSha256:sha(JSON.stringify(fixture)),confirmedSummary:alternate.summary,
  consentPhrase:"APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY"};
 const success=await response(request("/api/pilot/controlled-commit","POST",body),env);
 assert.equal(success.status,200,JSON.stringify(success.data));
 assert.equal(success.data.committed,true);
 assert.equal(success.data.revision,2);
 assert.equal(success.data.content_sha256,sha(JSON.stringify(alternate)));
 assert.equal(success.data.purge_due_at,before.purge_due_at);
 assert.equal(success.data.review_status,"needs_review");
 assert.equal(success.data.approval_status,"not_approved");
 assert.equal(db.conn.prepare("SELECT purge_due_at,created_at FROM pilot_documents").get().purge_due_at,
  before.purge_due_at);
 const hist=db.conn.prepare("SELECT revision,source_record_json,content_sha256 FROM pilot_revisions ORDER BY revision").all();
 assert.equal(hist.length,2);
 assert.deepEqual(JSON.parse(hist[0].source_record_json),fixture);
 assert.deepEqual(JSON.parse(hist[1].source_record_json),alternate);
 assert.equal(hist[0].content_sha256,sha(JSON.stringify(fixture)));
 assert.equal(hist[1].content_sha256,sha(JSON.stringify(alternate)));
 assert.deepEqual(
  db.conn.prepare("SELECT kind FROM pilot_review_events ORDER BY revision").all().map(row=>row.kind),
  ["created","edited"]);
 const read=await response(request("/api/pilot/record"),env);
 assert.equal(read.status,200);
 assert.equal(read.data.revision,2);
 assert.deepEqual(read.data.record,alternate);
 const replay=await response(request("/api/pilot/controlled-commit","POST",body),env);
 assert.equal(replay.status,409,"replay must fail stale expectedRevision");
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,2);
 db.conn.close();
});
test("Phase1.4C rejects wrong owner, bad consent, extra keys, spoofed hash, expired and cross-origin",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 assert.equal((await response(request("/api/pilot/record","POST",{record:fixture,consent}),env)).status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";env.PILOT_CONTROLLED_COMMIT_ENABLED="true";
 const base={expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),
  backupSha256:sha(JSON.stringify(fixture)),confirmedSummary:alternate.summary,
  consentPhrase:"APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY"};
 assert.equal((await response(request("/api/pilot/controlled-commit","POST",base),env,ctxOther)).status,401);
 assert.equal((await response(request("/api/pilot/controlled-commit","POST",base,"cross-site"),env)).status,403);
 for(const patched of [
  {...base,consentPhrase:"YES"},
  {...base,confirmedSummary:"Private customer text"},
  {...base,backupSha256:"0".repeat(64)},
  {...base,expectedSha256:"0".repeat(64)},
  {...base,expectedRevision:2},
  {...base,record:fixture},
  {...base,extra:"unsafe"},
 ]){
  const result=await response(request("/api/pilot/controlled-commit","POST",patched),env);
  assert.ok([403,409].includes(result.status),JSON.stringify(result));
 }
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,1);
 db.conn.prepare("UPDATE pilot_documents SET purge_due_at=? WHERE source_id=?").run("2000-01-01T00:00:00Z",fixture.id);
 const expired=await response(request("/api/pilot/controlled-commit","POST",base),env);
 assert.equal(expired.status,410);
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n,1);
 db.conn.close();
});

test("Phase1.4D race between head-read and CAS batch returns 409 with no duplicate history",async()=>{
 const db=wrapDb(),env={...envDefault,DB:db.api,PILOT_REAL_UPLOAD_ENABLED:"true"};
 const created=await response(request("/api/pilot/record","POST",{record:fixture,consent}),env);
 assert.equal(created.status,201);
 env.PILOT_REAL_UPLOAD_ENABLED="false";
 env.PILOT_CONTROLLED_COMMIT_ENABLED="true";
 let raced=false;
 env.DB={...db.api,async batch(statements){
   if(!raced){
    raced=true;
    // Another writer completed first while our handler was computing
    // the submitted proposal. Keep revision 1 immutable, and simulate
    // another valid persisted revision 2 + edited event.
    const at=new Date().toISOString(),hash=sha(JSON.stringify(alternate));
    db.conn.prepare("UPDATE pilot_documents SET current_revision=2,content_sha256=?,updated_at=? WHERE current_revision=1")
      .run(hash,at);
    db.conn.prepare("INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)")
      .run("cf_"+env.OWNER_EMAIL_SHA256,fixture.id,2,hash,JSON.stringify(alternate),at);
    db.conn.prepare("INSERT INTO pilot_review_events VALUES (?,?,?,?,?)")
      .run("cf_"+env.OWNER_EMAIL_SHA256,fixture.id,2,"edited",at);
   }
   return db.api.batch(statements);
 }};
 const body={
  expectedRevision:1,expectedSha256:sha(JSON.stringify(fixture)),
  backupSha256:sha(JSON.stringify(fixture)),
  confirmedSummary:alternate.summary,
  consentPhrase:"APPROVE_ONLY_THIS_CLEAN_ROOM_SUMMARY",
 };
 const attempt=await response(request("/api/pilot/controlled-commit","POST",body),env);
 assert.equal(attempt.status,409,JSON.stringify(attempt.data));
 assert.equal(attempt.data.code,"revision_conflict");
 assert.equal(db.conn.prepare("SELECT COUNT(*) AS n FROM pilot_revisions").get().n,2);
 assert.equal(db.conn.prepare("SELECT COUNT(*) AS n FROM pilot_review_events").get().n,2);
 assert.equal(db.conn.prepare("SELECT current_revision AS n FROM pilot_documents").get().n,2);
 db.conn.close();
});

test("Phase1.5A capability gated by verified Access and multi-source API remains disabled",async()=>{
 const db=wrapDb();
 const env={...envDefault,DB:db.api,SOURCE_SYNC_ENABLED:"false",
  SOURCE_SYNC_SYNTHETIC_ONLY:"true"};
 const route="/api/source-sync/v1/capabilities";
 for(const ctx of [{},ctxOther]){
  const r=await response(request(route),env,ctx);
  assert.equal(r.status,401);
 }
 const ownerCap=await response(request(route),env);
 assert.equal(ownerCap.status,200);
 assert.equal(ownerCap.data.enabled,false);
 assert.equal(ownerCap.data.real_sources_allowed,false);
 assert.equal(ownerCap.data.synthetic_only,true);
 assert.equal(ownerCap.data.owner_scoped,true);
 assert.equal(ownerCap.data.max_articles,5);
 const fakeMutation=await response(request("/api/source-sync/v1/records","POST",
  {record:fixture,authorization:{backup_verified:true}}),env);
 assert.equal(fakeMutation.status,403);
 assert.equal(fakeMutation.data.code,"source_sync_disabled");
 assert.equal(db.conn.prepare("SELECT count(*) AS n FROM pilot_documents").get().n,0);
 db.conn.close();
});
