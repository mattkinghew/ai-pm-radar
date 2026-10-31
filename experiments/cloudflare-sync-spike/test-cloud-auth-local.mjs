import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import worker from "./worker.mjs";
const hash=createHash("sha256").update("owner-a@example.test").digest("hex");
const env={DB:{},CLOUD_ACCESS_REQUIRED:"true",SYNTHETIC_ONLY:"true",OWNER_EMAIL_SHA256:hash};
const url="https://radar-phase11-preview-locked.example.invalid/api/cloud/fixture";
test("ctx.access missing always denied, even with forged X-User",async()=>{
 const request=new Request(url,{headers:{"X-User-Id":"owner-a@example.test","X-Email":"owner-a@example.test","Cf-Access-Jwt-Assertion":"forged.jwt"}});
 const response=await worker.fetch(request,env,{});
 assert.equal(response.status,401);
});
test("different signed Cloudflare Access identity cannot read cloud fixture",async()=>{
 const request=new Request(url);
 const response=await worker.fetch(request,env,{access:{getIdentity:async()=>({email:"owner-b@example.test"})}});
 assert.equal(response.status,401);
});
test("case-normalized allowed signed identity can read synthetic fixture",async()=>{
 const request=new Request(url);
 const response=await worker.fetch(request,env,{access:{getIdentity:async()=>({email:"OWNER-A@EXAMPLE.TEST"})}});
 assert.equal(response.status,200);
 assert.equal((await response.json()).record.record_version,2);
});
test("getIdentity rejection denied without leaking details",async()=>{
 const request=new Request(url);
 const response=await worker.fetch(request,env,{access:{getIdentity:async()=>{throw Error("identity temporarily unavailable")}}});
 assert.equal(response.status,401);
 assert.deepEqual(await response.json(),{code:"unauthenticated"});
});

for(const path of ["/gateway-workbench/","/gateway-workbench/app.js","/api/cloud/capabilities"]){
 test("Cloud Gateway "+path+" denies unsigned and spoofed identity headers",async()=>{
  const request=new Request("https://radar-phase11-preview-locked.example.invalid"+path,
    {headers:{"Cf-Access-Jwt-Assertion":"forged.jwt","X-Email":"owner-a@example.test"}});
  const res=await worker.fetch(request,env,{});
  assert.equal(res.status,401);
 });
 test("Cloud Gateway "+path+" denies wrong signed Access user",async()=>{
  const request=new Request("https://radar-phase11-preview-locked.example.invalid"+path);
  const res=await worker.fetch(request,env,{access:{getIdentity:async()=>({email:"owner-b@example.test"})}});
  assert.equal(res.status,401);
 });
}
test("Gateway HTML CSP limits network connections to self and prevents iframe embedding",async()=>{
 const req=new Request("https://radar-phase11-preview-locked.example.invalid/gateway-workbench/");
 const res=await worker.fetch(req,env,{access:{getIdentity:async()=>({email:"owner-a@example.test"})}});
 assert.equal(res.status,200);
 const csp=res.headers.get("content-security-policy");
 assert.match(csp,/connect-src 'self'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.match(csp,/script-src 'self'/);
});
test("Cloud capability endpoint remains synthetic-only with no real-data permission",async()=>{
 const req=new Request("https://radar-phase11-preview-locked.example.invalid/api/cloud/capabilities");
 const res=await worker.fetch(req,env,{access:{getIdentity:async()=>({email:"owner-a@example.test"})}});
 assert.equal(res.status,200);
 const c=await res.json();
 assert.equal(c.synthetic_only,true);
 assert.equal(c.real_sources_opt_in,false);
 assert.equal(c.access_enforced,true);
});
