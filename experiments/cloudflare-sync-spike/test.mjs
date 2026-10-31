import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync,spawn} from "node:child_process";
import {generateKeyPairSync,sign} from "node:crypto";
import assert from "node:assert/strict";
const dir=dirname(fileURLToPath(import.meta.url));
const wrangler=process.env.WRANGLER_BIN;
if(!wrangler)throw Error("Set WRANGLER_BIN to existing cached CLI; never auto-install.");
const persist=mkdtempSync(join(tmpdir(),"radar-cf-d1-poc-"));
const cfg=["--config",resolve(dir,"wrangler.jsonc")];
const keys=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...keys.publicKey.export({format:"jwk"}),kid:"fixture-key",alg:"RS256",use:"sig"};
const jwks=JSON.stringify({keys:[jwk]});
let server;
const output=[];
const now=Math.floor(Date.now()/1000);
function token(sub="synthetic_owner_a",email="owner-a@example.test",claims={}) {
 const head=Buffer.from(JSON.stringify({alg:"RS256",kid:"fixture-key"})).toString("base64url");
 const data=Buffer.from(JSON.stringify({iss:"https://synthetic.cloudflareaccess.com",aud:["radar-synthetic-local"],sub,email,iat:now-10,exp:now+3600,...claims})).toString("base64url");
 const input=head+"."+data;
 return input+"."+sign("RSA-SHA256",Buffer.from(input),keys.privateKey).toString("base64url");
}
function record(id="src_a",raw="This is synthetic. Nine people wanted more practice.") {
 return {record_version:2,id,raw_text:raw,key_claims:[{claim:"Nine wanted practice",evidence:[{text_reference:"Nine people wanted more practice."}]}],review_status:"reviewed",approval_status:"approved"};
}
async function request(path,method="GET",jwt=null,body=undefined,headers={}) {
 const res=await fetch("http://127.0.0.1:8797"+path,{method,headers:{"content-type":"application/json",...(jwt?{"Cf-Access-Jwt-Assertion":jwt}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});
 return {status:res.status,data:await res.json()};
}
function pass(label,r,fn){assert.ok(fn(r),label+" returned "+JSON.stringify(r));console.log("PASS",label);}
async function main(){
 execFileSync(process.execPath,[wrangler,"d1","execute","DB","--local","--persist-to",persist,"--file",join(dir,"schema.sql"),"--yes",...cfg],{cwd:dir,env:{...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"},stdio:"pipe",timeout:90000});
 server=spawn(process.execPath,[wrangler,"dev","--local","--ip","127.0.0.1","--port","8797","--persist-to",persist,"--var","ACCESS_JWKS_JSON:"+jwks,...cfg],{cwd:dir,env:{...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"},stdio:["ignore","pipe","pipe"]});
 server.stdout.on("data",buf=>output.push(String(buf).slice(0,400)));
 server.stderr.on("data",buf=>output.push(String(buf).slice(0,400)));
 let ready=false;
 for(let i=0;i<35;i++){await new Promise(r=>setTimeout(r,300));if(server.exitCode!==null)break;try{if((await request("/api/records")).status===401){ready=true;break;}}catch{}}
 assert.ok(ready,"Worker startup failed: "+output.slice(-10).join(" | "));
 console.log("LOCAL_WORKER_READY");
 const a=token(),b=token("synthetic_owner_b","owner-b@example.test");
 pass("anonymous access denied",await request("/api/records"),r=>r.status===401);
 pass("forged user headers denied",await request("/api/records","GET",null,undefined,{"X-User-Id":"synthetic_owner_a"}),r=>r.status===401);
 pass("wrong JWT audience denied",await request("/api/records","GET",token(undefined,undefined,{aud:["bad"]})),r=>r.status===401);
 pass("expired JWT denied",await request("/api/records","GET",token(undefined,undefined,{exp:now-1})),r=>r.status===401);
 const tampered=token().split(".");
 tampered[1]=Buffer.from(JSON.stringify({iss:"https://synthetic.cloudflareaccess.com",aud:["radar-synthetic-local"],sub:"synthetic_owner_b",email:"owner-b@example.test",exp:now+3600})).toString("base64url");
 pass("modified JWT payload denied",await request("/api/records","GET",tampered.join(".")),r=>r.status===401);
 pass("unlisted email denied",await request("/api/records","GET",token(undefined,"stranger@example.test")),r=>r.status===401);
 pass("initial list empty",await request("/api/records","GET",a),r=>r.status===200&&r.data.records.length===0);
 pass("create unapproved SourceRecord",await request("/api/records","POST",a,{source_id:"src_a",record:record()}),r=>r.status===201&&r.data.approved===false);
 pass("duplicate rejected",await request("/api/records","POST",a,{source_id:"src_a",record:record()}),r=>r.status===409);
 pass("owner B list isolated",await request("/api/records","GET",b),r=>r.status===200&&r.data.records.length===0);
 pass("owner B cannot read A",await request("/api/records/src_a","GET",b),r=>r.status===404);
 pass("owner B cannot write A",await request("/api/records/src_a","PUT",b,{expectedRevision:1,record:record()}),r=>r.status===404);
 pass("review required before approval",await request("/api/records/src_a/approve","POST",a,{expectedRevision:1}),r=>r.status===422);
 pass("explicit review",await request("/api/records/src_a/review","POST",a,{expectedRevision:1}),r=>r.status===200&&r.data.revision===2&&r.data.review_status==="reviewed");
 pass("explicit approve",await request("/api/records/src_a/approve","POST",a,{expectedRevision:2}),r=>r.status===200&&r.data.revision===3&&r.data.approved===true);
 pass("stale revision rejected",await request("/api/records/src_a","PUT",a,{expectedRevision:1,record:record()}),r=>r.status===409&&r.data.currentRevision===3);
 pass("edit invalidates approval",await request("/api/records/src_a","PUT",a,{expectedRevision:3,record:record("src_a","This is synthetic. Nine people wanted more practice. An edit.")}),r=>r.status===200&&r.data.revision===4&&r.data.review_status==="needs_review"&&!r.data.approved);
 pass("invalid evidence edit stored as draft",await request("/api/records/src_a","PUT",a,{expectedRevision:4,record:record("src_a","Unrelated paragraph with no supporting quote.")}),r=>r.status===200);
 pass("bad evidence blocks review",await request("/api/records/src_a/review","POST",a,{expectedRevision:5}),r=>r.status===422&&r.data.code==="evidence_missing");
 pass("Gemini route not implemented",await request("/api/analyze","POST",a,{}),r=>r.status===404);
 console.log("CLOUDFLARE_LOCAL_D1_AUTH_CAS_PASS");
}
try{await main()}finally{if(server){server.kill("SIGTERM");await new Promise(r=>setTimeout(r,300));if(server.exitCode===null)server.kill("SIGKILL");}rmSync(persist,{recursive:true,force:true});}
