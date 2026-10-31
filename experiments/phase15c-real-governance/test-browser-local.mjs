import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import http from "node:http";
import worker from "../phase13-one-article/worker.mjs";
import {FIXTURE_RECORDS} from "../phase15-source-sync/fixtures.mjs";
import {ATTESTATIONS} from "./engine.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const email="owner@example.invalid";
const origin="http://127.0.0.1:8854";
const config={
 CLOUD_ACCESS_REQUIRED:"true",
 OWNER_EMAIL_SHA256:createHash("sha256").update(email).digest("hex"),
 PILOT_REAL_UPLOAD_ENABLED:"false",
 PILOT_CONTROLLED_COMMIT_ENABLED:"false",REAL_SOURCE_SYNC_ENABLED:"false",
 DB:{prepare:()=>{throw Error("Governance MUST NOT use live D1")}},
 SYNC_DB:{prepare:()=>{throw Error("Governance MUST NOT use synthetic D1")}},
};
const ownerCtx={access:{getIdentity:async()=>({email})}};
const pass=(description,yes)=>{assert.ok(yes,description);console.log("PASS",description)};
async function server(){
 const s=http.createServer(async(req,res)=>{
  try{
   const headers=new Headers();
   for(const [k,v] of Object.entries(req.headers))if(typeof v==="string")headers.set(k,v);
   const request=new Request(origin+req.url,{method:req.method,headers,
    ...(req.method==="GET"?{}:{body:req,duplex:"half"})});
   const response=await worker.fetch(request,config,ownerCtx);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error("LOCAL_PREVIEW_SERVER_ERROR",e.message);res.writeHead(500);res.end("server_error")}
 });
 await new Promise(resolve=>s.listen(8854,"127.0.0.1",resolve));
 return s;
}
const file="/tmp/radar-phase15c-governance-test-original.json";
const bad="/tmp/radar-phase15c-governance-test-tampered.json";
const risky="/tmp/radar-phase15c-governance-test-sensitive.json";
writeFileSync(file,JSON.stringify(FIXTURE_RECORDS[0],null,2)+"\n");
writeFileSync(bad,JSON.stringify({...FIXTURE_RECORDS[0],summary:"tampered"},null,2)+"\n");
writeFileSync(risky,JSON.stringify({...FIXTURE_RECORDS[0],
 raw_text:FIXTURE_RECORDS[0].raw_text+" contact@demo.example"},null,2)+"\n");
(async()=>{
 let browser,listener;
 try{
  for(const path of ["/real-source-readiness/","/real-source-readiness/app.js",
   "/real-source-readiness/engine.js"]){
   const req=new Request(origin+path);
   const denied=await worker.fetch(req,config,{});
   const wrong=await worker.fetch(req,config,{access:{getIdentity:async()=>({email:"other@example.invalid"})}});
   pass("No anonymous or wrong Access identity can read "+path,
    denied.status===401&&wrong.status===401);
  }
  const unsafe=await worker.fetch(new Request(origin+"/real-source-readiness/"),{
   ...config,REAL_SOURCE_SYNC_ENABLED:"true"
  },ownerCtx);
  pass("Governance preview fails closed if real-sync flag is ever enabled",unsafe.status===403);
  const method=await worker.fetch(new Request(origin+"/real-source-readiness/",{method:"POST"}),config,ownerCtx);
  pass("Governance endpoint rejects POST and never touches a D1",method.status===405);
  listener=await server();
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const mac=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const a=await mac.newPage(),b=await mobile.newPage();
  const errors=[],requests=[];
  for(const p of [a,b]){
   p.on("pageerror",e=>errors.push(e.message));
   p.on("request",r=>requests.push({method:r.method(),url:r.url()}));
  }
  const res=await a.goto(origin+"/real-source-readiness/",{waitUntil:"networkidle"});
  pass("Access-protected local governance UI serves in Chromium",res.status()===200);
  pass("CSP prevents all external network connections",res.headers()["content-security-policy"].includes("connect-src 'none'"));
  await a.getByTestId("readiness-decision").getByText(/HOLD/).waitFor();
  pass("Default decision HOLD, all nine attestations unchecked",
   await a.locator("#attestations input:checked").count()===0);
  await a.locator("#source-file").setInputFiles(file);
  await a.locator("#source-state").getByText(/已在瀏覽器本機載入原件/).waitFor();
  pass("Record v2 read into browser only",await a.locator("#source-meta").getByText(/src_f150/).count()===1);
  await a.locator("#backup-file").setInputFiles({name:"ignored.json",mimeType:"application/json",buffer:Buffer.from("{}")}).catch(()=>{});
  pass("Before download source backup input disabled",await a.locator("#backup-file").isDisabled());
  const downloadPromise=a.waitForEvent("download");
  await a.locator("#download-backup").click();
  const downloaded=await downloadPromise;
  const saved="/tmp/radar-phase15c-governance-backed-up.json";
  await downloaded.saveAs(saved);
  pass("Downloaded complete original identical bytes",readFileSync(saved).equals(readFileSync(file)));
  await a.locator("#backup-file").setInputFiles(bad);
  await a.locator("#backup-state").getByText(/BLOCKED/).waitFor();
  pass("Tampered backup rejected",true);
  await a.locator("#backup-file").setInputFiles(saved);
  await a.locator("#backup-state").getByText(/PASS：完整來源備份/).waitFor();
  pass("Original SHA256 and downloaded backup matched",true);
  for(const [key] of ATTESTATIONS)await a.locator("#attest-"+key).check();
  if(errors.length)throw Error("Browser JavaScript execution failed");

  await a.getByTestId("readiness-decision").getByText(/本機治理審查：PASS/).waitFor();
  const text=await a.locator("#report-preview").innerText();
  pass("Decision says LOCAL governance, never cloud upload",
   text.includes("LOCAL_GOVERNANCE_REVIEWED")&&text.includes('"cloud_write_authorized": false'));
  pass("UI sanitized preview hides raw text and rights narrative",
   !text.includes(FIXTURE_RECORDS[0].raw_text) && !text.includes(FIXTURE_RECORDS[0].source_url));
  const reportPromise=a.waitForEvent("download");
  await a.locator("#download-report").click();
  const reportDownloaded=await reportPromise;
  const reportPath="/tmp/radar-phase15c-governance-report-qa.json";
  await reportDownloaded.saveAs(reportPath);
  const report=JSON.parse(readFileSync(reportPath,"utf8"));
  pass("Download report has source fingerprint and no source body",
   report.decision==="LOCAL_GOVERNANCE_REVIEWED"
   &&report.cloud_write_authorized===false
   &&!JSON.stringify(report).includes(FIXTURE_RECORDS[0].raw_text)
   &&!JSON.stringify(report).includes(FIXTURE_RECORDS[0].source_url));
  await a.reload({waitUntil:"networkidle"});
  await a.getByTestId("readiness-decision").getByText(/HOLD/).waitFor();
  pass("Reload clears SourceRecord and all consents (no browser persistence)",
   await a.locator("#attestations input:checked").count()===0
   &&(await a.locator("#source-meta").innerText())==="");
  await b.goto(origin+"/real-source-readiness/",{waitUntil:"networkidle"});
  await b.locator("#source-file").setInputFiles(risky);
  await b.locator("#errors-state").getByText(/BLOCKED/).waitFor();
  pass("Mobile screen blocks sensitive email pattern",
   (await b.locator("#errors-list").innerText()).includes("疑似憑證")||
   (await b.locator("#errors-list").innerText()).includes("可能屬個人資料"));
  for(const width of [390,768,1280]){
   await b.setViewportSize({width,height:844});
   const size=await b.evaluate(()=>({scroll:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth}));
   pass("No horizontal overflow at "+width,size.scroll<=size.viewport+1);
  }
  pass("Only same-origin static GETs (no JSON source data network upload)",
   requests.every(x=>x.method==="GET"&&new URL(x.url).origin===origin));
  pass("Browser had zero JS runtime errors",errors.length===0);
  console.log("PHASE15C_REAL_BROWSER_OFFLINE_GOVERNANCE_PASS");
 }catch(e){console.error("PHASE15C_BROWSER_FAILED",e.stack);process.exitCode=1;}
 finally{
  if(browser)await browser.close();
  if(listener)await new Promise(resolve=>listener.close(resolve));
 }
})();
