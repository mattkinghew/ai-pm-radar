import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import worker from "./worker.mjs";
const config=JSON.parse(readFileSync(new URL("./wrangler-preview-next-cloud-access.jsonc",import.meta.url),"utf8"));
const {createHash}=await import("node:crypto");
const email="owner-a@example.test";
const digest=createHash("sha256").update(email).digest("hex");
const base="https://radar-phase11-preview-locked.example.invalid";
function env() {
 const called=[];
 return {
  called,
  vars:{
   SYNTHETIC_ONLY:"true",CLOUD_ACCESS_REQUIRED:"true",OWNER_EMAIL_SHA256:digest,DB:{},
   ASSETS:{fetch:async request=>{called.push(request.url);return new Response("synthetic protected asset",{status:200})}},
  },
 };
}
test("Worker MUST run before every static asset (no direct CDN bypass)",()=>{
 assert.equal(config.assets.run_worker_first,true);
 assert.equal(config.assets.binding,"ASSETS");
 assert.equal(config.vars.SYNTHETIC_ONLY,"true");
 assert.equal(config.vars.CLOUD_ACCESS_REQUIRED,"true");
 assert.equal(config.workers_dev,true,"original Access protected hostname retained");
});
for(const route of [
 "/preview-source-inbox/","/preview-source-inbox/index.html",
 "/_next/static/chunks/35qcco0jbvy7y.css",
 "/_next/static/chunks/private-test.js",
]){
 test("static request denied before env.ASSETS fetch: "+route,async()=>{
  const e=env();
  const response=await worker.fetch(new Request(base+route,{headers:{"Cf-Access-Jwt-Assertion":"spoof"}}),e.vars,{});
  assert.equal(response.status,401);
  assert.deepEqual(e.called,[]);
 });
 test("wrong Access identity cannot read Next asset "+route,async()=>{
  const e=env();
  const response=await worker.fetch(new Request(base+route),e.vars,{
   access:{getIdentity:async()=>({email:"not-owner@example.test"})}
  });
  assert.equal(response.status,401);
  assert.deepEqual(e.called,[]);
 });
 test("authorized Access identity routes to ASSETS only after validation "+route,async()=>{
  const e=env();
  const response=await worker.fetch(new Request(base+route),e.vars,{
   access:{getIdentity:async()=>({email})}
  });
  assert.equal(response.status,200);
  assert.equal(e.called.length,1);
  assert.equal(response.headers.get("x-frame-options"),"DENY");
  assert.match(response.headers.get("content-security-policy"),/connect-src 'self'/);
 });
}
test("raw non-synthetic data cannot be enabled by changing browser state",async()=>{
 const e=env();
 const response=await worker.fetch(new Request(base+"/api/cloud/fixture"),{
  ...e.vars,SYNTHETIC_ONLY:"false"
 },{access:{getIdentity:async()=>({email})}});
 assert.equal(response.status,503);
 assert.deepEqual(e.called,[]);
});
test("Asset serving rejects traversal or dotfiles",async()=>{
 const e=env();
 for(const path of ["/_next/static/.secret","/preview-source-inbox/.env.local"]){
  const res=await worker.fetch(new Request(base+path),e.vars,{access:{getIdentity:async()=>({email})}});
  assert.equal(res.status,404);
 }
 assert.equal(e.called.length,0);
});
