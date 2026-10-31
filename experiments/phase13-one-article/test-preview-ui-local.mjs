import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import worker from "./worker.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const fixturePath="experiments/phase13-one-article/fixtures/clean-room-public-article.json";
const fixture=JSON.parse(readFileSync(fixturePath));
const sha=x=>createHash("sha256").update(x).digest("hex");
const address="127.0.0.1";
const port=8841;
const origin="http://"+address+":"+port;
const email="test-owner@example.invalid";
let simulatedUploaded=false,simulatedRevision=1;
const revised={...fixture,summary:"alternate synthetic test"};
const env={
 CLOUD_ACCESS_REQUIRED:"true",OWNER_EMAIL_SHA256:sha(email),
 PILOT_REAL_UPLOAD_ENABLED:"false",PINNED_ARTICLE_ID:fixture.id,
 PINNED_ARTICLE_SHA256:sha(JSON.stringify(fixture)),
 PINNED_UPDATE_SHA256:sha(JSON.stringify({...fixture,summary:"alternate synthetic test"})),
 PURGE_JOB_ENABLED:"true",
 DB:{
  prepare(sql){
   return {bind:()=>({first:async()=>{
    if(!simulatedUploaded)return null;
    if(sql.includes("FROM pilot_documents"))return {
     source_id:fixture.id,current_revision:simulatedRevision,
     content_sha256:sha(JSON.stringify(simulatedRevision===2?revised:fixture)),
     created_at:new Date().toISOString(),
     purge_due_at:new Date(Date.now()+7*86400_000).toISOString()
    };
    if(sql.includes("FROM pilot_revisions"))return {
     source_record_json:JSON.stringify(simulatedRevision===2?revised:fixture)
    };
    return null;
   }})};
  }
 },
};
const auth={access:{getIdentity:async()=>({email})}};
const unauthorized={access:{getIdentity:async()=>({email:"other@example.invalid"})}};
async function serve(request,context=auth){return worker.fetch(request,env,context)}
function makeServer(){
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin);
   const body=["POST","PUT","PATCH","DELETE"].includes(req.method)?req:undefined;
   const headers=new Headers();
   for(const [k,v] of Object.entries(req.headers))if(typeof v==="string")headers.set(k,v);
   const request=new Request(url,{method:req.method,headers,body,duplex:body?"half":undefined});
   const ans=await serve(request);
   res.writeHead(ans.status,Object.fromEntries(ans.headers));
   res.end(Buffer.from(await ans.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end("internal test error")}
 });
}
test("Access identity protects HTML, JS and API even with spoofed headers",async()=>{
 for(const path of ["/pilot-preview/","/pilot-preview/app.js","/api/pilot/capabilities"]){
  const target=new Request(origin+path,{headers:{"cf-access-jwt-assertion":"forged","x-email":email}});
  assert.equal((await serve(target,unauthorized)).status,401);
  assert.equal((await serve(target,{})).status,401);
 }
 const ok=await serve(new Request(origin+"/pilot-preview/"));
 assert.equal(ok.status,200);
 assert.match(ok.headers.get("content-security-policy"),/script-src 'self'/);
 assert.match(ok.headers.get("content-security-policy"),/connect-src 'self'/);
 assert.match(ok.headers.get("content-security-policy"),/frame-ancestors 'none'/);
});
test("real browser preview: local original file -> byte hash -> download -> read-back; NO cloud writes",async()=>{
 const server=makeServer();
 await new Promise(resolve=>server.listen(port,address,resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[],remoteCalls=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",req=>remoteCalls.push({url:req.url(),method:req.method()}));
  const visit=await page.goto(origin+"/pilot-preview/",{waitUntil:"domcontentloaded",timeout:12000});
  assert.equal(visit.status(),200);
  await page.locator("#auth-state").getByText(/PASS：身份已驗證/).waitFor();
  await page.locator("#remote-state").getByText(/PASS：尚無文章/).waitFor();
  assert.match(await page.locator("#upload-state").textContent(),/^OFF：已完成指定文章匯入/);
  assert.equal(await page.locator("#download-backup").isDisabled(),true);
  await page.locator("#choose-record").setInputFiles(fixturePath);
  await page.locator("#inspection").getByText(/PASS：指定來源/).waitFor();
  const readyDownload=page.waitForEvent("download");
  await page.locator("#download-backup").click();
  const downloaded=await readyDownload;
  const path="/tmp/radar-phase13-local-owner-preflight-backup.json";
  await downloaded.saveAs(path);
  await page.locator("#verify-backup").setInputFiles(path);
  await page.locator("#consent-result").getByText(/PASS：備份讀回/).waitFor();
  await page.locator("#review-consent").click();
  await page.locator("#consent-result").getByText(/聲明尚未齊備/).waitFor();
  const checkboxes=page.locator("#consent-options input[data-consent]");
  assert.equal(await checkboxes.count(),7);
  for(let i=0;i<7;i++)await checkboxes.nth(i).check();
  await page.locator("#review-consent").click();
  await page.locator("#consent-result").getByText(/聲明齊備（7\/7）/).waitFor();
  assert.equal(remoteCalls.filter(item=>item.method!=="GET").length,0);
  assert.ok(remoteCalls.every(item=>new URL(item.url).origin===origin));
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator(".primary:disabled").count(),1);
  for(const width of [390,768,1280]){
   await page.setViewportSize({width,height:844});
   const measured=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   assert.ok(measured.sw<=measured.cw+1,"no overflow "+width+"px");
  }
  await page.screenshot({path:"/tmp/radar-phase13-one-article-local-preflight-390.png",fullPage:true});
  // Same protected preview after a one-off Owner approved cloud import.
  simulatedUploaded=true;
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#auth-state").getByText(/PASS：身份已驗證/).waitFor();
  await page.locator("#remote-state").getByText(/PASS：Revision 1/).waitFor();
  await page.locator("#choose-record").setInputFiles(fixturePath);
  await page.locator("#inspection").getByText(/雲端與本機完整 SourceRecord 一致/).waitFor();
  await page.locator("#verify-cloud").click();
  await page.locator("#remote-state").getByText(/PASS：Revision 1/).waitFor();
  assert.ok(remoteCalls.every(item=>item.method==="GET"));
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator("#upload-state").textContent(),"OFF：已完成指定文章匯入，不接受其他文章");
  // Phase 1.4D original privileged commit created approved Revision2.
  simulatedRevision=2;
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#remote-state").getByText(/PASS：Revision 2/).waitFor({timeout:15000});
  assert.match(await page.locator("#remote-state").innerText(),/Evidence 6/);
  // The old baseline is not silently misrepresented as equal to Revision2.
  await page.locator("#choose-record").setInputFiles(fixturePath);
  await page.locator("#inspection").getByText(/雲端與本機內容有差異/).waitFor();
  const newestFile="/tmp/radar-phase14d-candidate-preview-check.json";
  const {writeFileSync}=await import("node:fs");
  writeFileSync(newestFile,JSON.stringify(revised,null,2)+"\n");
  await page.locator("#choose-record").setInputFiles(newestFile);
  await page.locator("#inspection").getByText(/雲端與本機完整 SourceRecord 一致/).waitFor();
  await page.locator("#verify-cloud").click();
  await page.locator("#remote-state").getByText(/PASS：Revision 2/).waitFor();
  assert.ok(remoteCalls.every(item=>item.method==="GET"));
  console.log("PASS_LEGACY_READONLY_UI_SUPPORTS_REV2_AND_FLAGS_REV1_MISMATCH");
  console.log("PASS_CLOUD_RECORD_PRESENT_READONLY_SHA256_AND_LOCAL_PARITY");
  console.log("PASS_BROWSER_PREVIEW_LOCAL_HASH_BACKUP_CONSENT_NO_UPLOAD");
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
