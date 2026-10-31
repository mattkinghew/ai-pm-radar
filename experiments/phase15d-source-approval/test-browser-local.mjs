import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import http from "node:http";
import {createRequire} from "node:module";
import worker from "../phase13-one-article/worker.mjs";
import {FIXTURE_RECORDS} from "../phase15-source-sync/fixtures.mjs";
import {ATTESTATIONS,evaluateGovernance} from "../phase15c-real-governance/engine.mjs";
import {validateShadowPacket} from "./engine.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const email="owner@example.invalid";
const origin="http://127.0.0.1:8855";
const env={
 OWNER_EMAIL_SHA256:createHash("sha256").update(email).digest("hex"),
 CLOUD_ACCESS_REQUIRED:"true",SHADOW_APPROVAL_ENABLED:"true",
 REAL_SOURCE_SYNC_ENABLED:"false",PILOT_REAL_UPLOAD_ENABLED:"false",
 PILOT_CONTROLLED_COMMIT_ENABLED:"false",
 DB:{prepare:()=>{throw Error("SHADOW GOVERNANCE MUST NOT READ REAL D1")}},
 SYNC_DB:{prepare:()=>{throw Error("SHADOW GOVERNANCE MUST NOT READ SYNTHETIC D1")}}
};
const ctx={access:{getIdentity:async()=>({email})}};
const check=(why,bool)=>{assert.ok(bool,why);console.log("PASS",why)};
const src=FIXTURE_RECORDS[0],original=JSON.stringify(src,null,2)+"\n";
const sha=x=>createHash("sha256").update(x).digest("hex");
const declaration=Object.fromEntries(ATTESTATIONS.map(([key])=>[key,true]));
const gov={
 ...evaluateGovernance({record:src,file_sha256:sha(original),backup_sha256:sha(original),
   attestations:declaration}),
 attested_controls:ATTESTATIONS.map(([key])=>key),
};
assert.equal(gov.decision,"LOCAL_GOVERNANCE_REVIEWED");
const fileSrc="/tmp/radar-phase15d-browser-source.json",
 fileBackup="/tmp/radar-phase15d-browser-backup.json",
 fileGov="/tmp/radar-phase15d-browser-governance.json",
 fileBad="/tmp/radar-phase15d-browser-bad-report.json";
writeFileSync(fileSrc,original);writeFileSync(fileBackup,original);
writeFileSync(fileGov,JSON.stringify(gov,null,2)+"\n");
writeFileSync(fileBad,JSON.stringify({...gov,source_sha256:"0".repeat(64)},null,2)+"\n");
async function makeServer(){
 const s=http.createServer(async(req,res)=>{
  try{
   const headers=new Headers();
   for(const [k,v] of Object.entries(req.headers))if(typeof v==="string")headers.set(k,v);
   const request=new Request(origin+req.url,{method:req.method,headers,
    ...(req.method==="GET"?{}:{body:req,duplex:"half"})});
   const response=await worker.fetch(request,env,ctx);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error("LOCAL_SERVER_ERROR",e.message);res.writeHead(500);res.end("ERROR")}
 });
 await new Promise(resolve=>s.listen(8855,"127.0.0.1",resolve));
 return s;
}
async function selectThree(page,report=fileGov,backup=fileBackup){
 await page.locator("#source-file").setInputFiles(fileSrc);
 await page.locator("#backup-file").setInputFiles(backup);
 await page.locator("#report-file").setInputFiles(report);
}
async function fill(page,{same=false}={}){
 await page.locator("#rights-basis").selectOption("owner_original");
 await page.locator("#rights-evidence").fill("rights-proof-001");
 await page.locator("#rights-reviewer").fill("Rights Reviewer 01");
 await page.locator("#rights-confirm").check();
 await page.locator("#privacy-class").selectOption("public_non_sensitive");
 await page.locator("#privacy-evidence").fill("privacy-proof-001");
 await page.locator("#privacy-reviewer").fill(same?"Rights Reviewer 01":"Privacy Reviewer 02");
 await page.locator("#privacy-confirm").check();
 await page.locator("#owner-ref").fill("owner-shadow-001");
 for(const id of ["ack-exact","ack-ttl","ack-residual","ack-off"])
  await page.locator("#"+id).check();
 await page.locator("#review").click();
}
(async()=>{
 let listener,browser;
 try{
  for(const path of ["/real-source-approval/","/real-source-approval/app.js",
   "/real-source-approval/engine.js"]){
   const denied=await worker.fetch(new Request(origin+path),env,{});
   const other=await worker.fetch(new Request(origin+path),env,{
    access:{getIdentity:async()=>({email:"other@example.invalid"})}});
   check("Verified Cloudflare Access enforced before "+path,
    denied.status===401&&other.status===401);
  }
  const badflag=await worker.fetch(new Request(origin+"/real-source-approval/"),
    {...env,REAL_SOURCE_SYNC_ENABLED:"true"},ctx);
  check("Page fails closed if real cloud write flag activates",badflag.status===403);
  const post=await worker.fetch(new Request(origin+"/real-source-approval/",{method:"POST"}),env,ctx);
  check("Approval UI never accepts POST",post.status===405);
  listener=await makeServer();
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const mac=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const phone=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const desktop=await mac.newPage(),mobile=await phone.newPage();
  const errors=[],requests=[];
  for(const page of [desktop,mobile]){
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>requests.push({method:r.method(),url:r.url()}));
  }
  const response=await desktop.goto(origin+"/real-source-approval/",{waitUntil:"networkidle"});
  check("Protected actual Chromium page loads",response.status()===200);
  check("CSP connect-src none",response.headers()["content-security-policy"].includes("connect-src 'none'"));
  await desktop.getByTestId("shadow-approval-status").getByText(/HOLD/).waitFor();
  check("Default status HOLD",await desktop.locator("#download-packet").isDisabled());
  await selectThree(desktop);
  await fill(desktop);
  await desktop.getByTestId("shadow-approval-status").getByText(/SHADOW CANDIDATE PASS/).waitFor({timeout:10000});
  const view=await desktop.locator("#packet-preview").innerText();
  check("Fully bound candidate explicitly forbids cloud write",
   view.includes('"cloud_write_authorized": false')&&view.includes('"signature_verified": false'));
  const dl=desktop.waitForEvent("download");
  await desktop.locator("#download-packet").click();
  const file=await dl;const filePath="/tmp/radar-phase15d-shadow-export-test.json";
  await file.saveAs(filePath);
  const result=JSON.parse(readFileSync(filePath,"utf8"));
  check("Exported shadow packet source SHA hash correct but no source raw",
   result.source_sha256===sha(original)
   &&result.decision==="SHADOW_APPROVAL_CANDIDATE"
   &&!JSON.stringify(result).includes(src.raw_text)
   &&result.cloud_write_authorized===false);
  check("Revalidate 24h signed-in independent shadow validity",
   validateShadowPacket(result,{source_id:src.id,source_sha256:sha(original)}).valid);
  await desktop.locator("#privacy-reviewer").fill("Rights Reviewer 01");
  await desktop.getByTestId("shadow-approval-status").getByText(/HOLD/).waitFor();
  check("Same rights/privacy reviewer causes HOLD",await desktop.locator("#download-packet").isDisabled());
  await desktop.locator("#privacy-reviewer").fill("Privacy Reviewer 02");
  await desktop.getByTestId("shadow-approval-status").getByText(/SHADOW CANDIDATE PASS/).waitFor();
  await desktop.locator("#report-file").setInputFiles(fileBad);
  await desktop.getByTestId("shadow-approval-status").getByText(/HOLD/).waitFor();
  check("Tampered governance file triggers HOLD",await desktop.locator("#download-packet").isDisabled());
  await desktop.reload({waitUntil:"networkidle"});
  await desktop.getByTestId("shadow-approval-status").getByText(/HOLD/).waitFor();
  check("Reload clears files, reviewer metadata and approval controls",
   await desktop.locator("#rights-reviewer").inputValue()===""
   &&await desktop.locator("#source-file").inputValue()===""
   &&await desktop.locator("#rights-confirm").isChecked()===false);
  await mobile.goto(origin+"/real-source-approval/",{waitUntil:"networkidle"});
  await selectThree(mobile);
  await fill(mobile);
  await mobile.getByTestId("shadow-approval-status").getByText(/SHADOW CANDIDATE PASS/).waitFor();
  for(const width of [390,768,1280]){
   await mobile.setViewportSize({width,height:850});
   const w=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,
     client:document.documentElement.clientWidth}));
   check("No mobile/tablet/desktop overflow "+width,w.scroll<=w.client+1);
  }
  check("Zero source article data POST/PUT; static same-origin GET only",
   requests.every(req=>req.method==="GET"&&new URL(req.url).origin===origin));
  check("No JS runtime errors",errors.length===0);
  console.log("PHASE15D_SHADOW_APPROVAL_DUAL_BROWSER_ALL_PASS");
 }catch(e){console.error("PHASE15D_BROWSER_FAILED",e.stack);process.exitCode=1}
 finally{
  if(browser)await browser.close();
  if(listener)await new Promise(resolve=>listener.close(resolve));
 }
})();
