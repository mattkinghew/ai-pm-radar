/** Fully isolated Cloudflare Wrangler+Assets+D1 + genuine React UI acceptance. */
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync,spawn} from "node:child_process";
import assert from "node:assert/strict";
const dir=dirname(fileURLToPath(import.meta.url));
const w=process.env.WRANGLER_BIN;
assert.ok(w,"WRANGLER_BIN required");
const persist=mkdtempSync(join(tmpdir(),"radar-react-c3-"));
const base="http://127.0.0.1:8816";
const env={...process.env,WRANGLER_SEND_METRICS:"false",CI:"true",GATEWAY_TEST_ORIGIN:base};
let worker;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const schema of ["schema.sql","schema-v12.sql"]){
  execFileSync(process.execPath,[w,"d1","execute","DB","--local","--config","wrangler-preview-next-local.jsonc",
   "--persist-to",persist,"--file",schema,"--yes"],{cwd:dir,env,timeout:60000,stdio:"pipe"});
 }
 worker=spawn(process.execPath,[w,"dev","--local","--config","wrangler-preview-next-local.jsonc",
  "--ip","127.0.0.1","--port","8816","--persist-to",persist],
  {cwd:dir,env,stdio:["ignore","ignore","ignore"]});
 let ready=false;
 for(let i=0;i<45;i++){await sleep(250);if(worker.exitCode!==null)break;
  try{ready=(await fetch(base+"/api/cloud/capabilities")).status===200;if(ready)break}catch{}
 }
 assert.ok(ready,"Cannot start synthetic authenticated Wrangler");
 const result=execFileSync(process.execPath,["test-actual-react-source-inbox-browser.cjs"],
  {cwd:dir,env,timeout:100000,maxBuffer:300000,encoding:"utf8"});
 process.stdout.write(result);
 assert.match(result,/PHASE12C3_ACTUAL_REACT_SOURCE_INBOX_LOCAL_PASS/);
 console.log("PHASE12C3_SELF_CONTAINED_WRANGLER_INTEGRATION_PASS");
}catch(e){console.error("PHASE12C3_SELF_CONTAINED_FAIL",e.stderr?.toString()||e.stack);process.exitCode=1}
finally{
 if(worker){worker.kill("SIGTERM");await sleep(500);if(worker.exitCode===null)worker.kill("SIGKILL")}
 rmSync(persist,{recursive:true,force:true});
}
