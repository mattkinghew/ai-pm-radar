/**
 * Two independent real Chromium contexts (Mac 1280px and iPhone 390px)
 * accessing a single Access-authorized Worker with a separate local SQLite DB.
 * Cloudflare real D1 is never touched by this test.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import http from "node:http";
import worker from "../phase13-one-article/worker.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const sha=str=>createHash("sha256").update(str).digest("hex");
const owner="pilot-cross-device@example.invalid";
const ctx={access:{getIdentity:async()=>({email:owner})}};
const conn=new DatabaseSync(":memory:");
conn.exec("PRAGMA foreign_keys=ON");
conn.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
const db={
 prepare(sql){
  const make=args=>{
   const stmt=conn.prepare(sql);
   return {first:async()=>stmt.get(...args)??null,
    all:async()=>({results:stmt.all(...args)}),
    run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})};
  };
  return {bind:(...args)=>make(args),...make([])};
 },
 async batch(statements){
  const out=[];conn.exec("BEGIN IMMEDIATE");
  try{for(const stmt of statements)out.push(await stmt.run());conn.exec("COMMIT");return out}
  catch(e){conn.exec("ROLLBACK");throw e}
 }
};
const env={
 DB:null,SYNC_DB:db,OWNER_EMAIL_SHA256:sha(owner),
 CLOUD_ACCESS_REQUIRED:"true",SOURCE_SYNC_ENABLED:"true",
 SOURCE_SYNC_SYNTHETIC_ONLY:"true",PILOT_REAL_UPLOAD_ENABLED:"false",
 PILOT_CONTROLLED_COMMIT_ENABLED:"false",PURGE_JOB_ENABLED:"true",
};
const host="http://127.0.0.1:8853";
const success=(name,yes)=>{assert.ok(yes,name);console.log("PASS",name)};
const safeStatus=async page=>{
 const text=await page.locator("#op-status").innerText();
 success("UI operation status not a BLOCKED error: "+text.slice(0,50),!text.includes("BLOCKED"));
};
async function server(){
 const instance=http.createServer(async(req,res)=>{
  try{
   const headers=new Headers();
   for(const [key,val] of Object.entries(req.headers)){
    if(typeof val==="string")headers.set(key,val);
   }
   const request=new Request(host+req.url,{method:req.method,headers,
    ...(req.method==="GET"?{}:{body:req,duplex:"half"})});
   const response=await worker.fetch(request,env,ctx);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error("LOCAL_TEST_SERVER_ERROR",e.message);res.writeHead(500);res.end("failed")}
 });
 await new Promise(resolve=>instance.listen(8853,"127.0.0.1",resolve));
 return instance;
}
const fileInput=async(page,index,version)=>{
 const selected=page.locator(".card").nth(index);
 if(!await selected.evaluate(el=>el.classList.contains("selected")))await selected.click();
 await page.locator("#variant").selectOption(String(version));
 const downloading=page.waitForEvent("download");
 await page.locator("#download-selected").click();
 const file=await downloading;
 const path="/tmp/radar-phase15b-browser-"+index+"-"+version+"-"+page.viewportSize().width+".json";
 await file.saveAs(path);
 await page.locator("#verify-json").setInputFiles(path);
 await page.locator("#backup-status").getByText(/PASS：完整 SourceRecord JSON/).waitFor();
 return path;
};
async function consent(page){
 for(const name of ["approve-rights","approve-retention","approve-residual"])
  await page.locator("#"+name).check();
}
(async()=>{
 let browser,serverInstance;
 try{
  // Missing/wrong identity cannot load even static frontend (no content).
  for(const route of ["/multi-source-pilot/","/multi-source-pilot/app.js",
   "/api/source-sync/v1/fixtures","/api/source-sync/v1/capabilities"]){
   const r=new Request(host+route);
   const unauthenticated=await worker.fetch(r,env,{});
   const rejected=await worker.fetch(r,env,{access:{getIdentity:async()=>({email:"not-owner@example.invalid"})}});
   success("Worker enforces verified Access before serving "+route,
    unauthenticated.status===401&&rejected.status===401);
  }
  serverInstance=await server();
  browser=await chromium.launch({headless:true,
   executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const mac=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const iphone=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const a=await mac.newPage(),b=await iphone.newPage();
  const errors=[],requests=[];
  for(const p of [a,b]){
   p.on("pageerror",e=>errors.push(e.message));
   p.on("request",r=>requests.push({method:r.method(),url:r.url()}));
  }
  const launch=await a.goto(host+"/multi-source-pilot/",{waitUntil:"networkidle",timeout:25000});
  success("Actual standalone multi-article HTML from Access-protected Worker",launch.status()===200);
  await a.locator("#connection").getByText(/同步可用/).waitFor({timeout:13000});
  success("Only fixed synthetic fixture cards are listed",await a.locator(".card").count()===3);
  await consent(a);
  await fileInput(a,0,0);
  await a.locator("#create-source").click();
  await a.waitForTimeout(900);
  console.log("CREATE_DEBUG",await a.locator("#op-status").innerText(),
   await a.locator("#backup-status").innerText());
  await a.locator("#op-status").getByText(/已建立合成文章 Revision 1/).waitFor({timeout:10000});
  success("Mac fixture 1 Revision1 remotely saved in D1-like DB",
   conn.prepare("SELECT COUNT(*) AS n FROM sync_documents").get().n===1);
  await fileInput(a,1,0);
  await a.locator("#create-source").click();
  await a.locator("#op-status").getByText(/已建立合成文章 Revision 1/).waitFor();
  success("Mac fixture 2 independently created",
   conn.prepare("SELECT COUNT(*) AS n FROM sync_documents").get().n===2);
  await fileInput(a,0,0);
  await a.locator("#fetch-source").click();
  await a.locator("#selected-meta").getByText("1",{exact:true}).waitFor();
  // Mac retains source 1 / revision 1 while iPhone updates.
  const phoneResponse=await b.goto(host+"/multi-source-pilot/",{waitUntil:"networkidle"});
  success("iPhone on another independent context loads same Worker",phoneResponse.status()===200);
  await b.locator("#connection").getByText(/同步可用/).waitFor();
  await b.locator("#cloud-list").getByText(/Revision 1/).waitFor();
  await consent(b);
  await fileInput(b,0,1);
  await b.locator("#fetch-source").click();
  await b.locator("#download-cloud").click();
  await b.locator("#update-source").click();
  await b.locator("#op-status").getByText(/成功提交合成修訂 Revision 2/).waitFor({timeout:10000});
  success("iPhone updates fixture1 to revision2",conn.prepare(
   "SELECT current_revision AS n FROM sync_documents WHERE source_id=?"
   ).get("src_f1500000000000000000000000000001").n===2);
  // Old Mac token is deliberately stale. Mac changes to v2 and hits 409.
  await fileInput(a,0,1);
  await a.locator("#update-source").click();
  await a.locator("#op-status").getByText(/409/).waitFor();
  success("Mac stale revision blocks blind overwrite with 409",
   conn.prepare("SELECT COUNT(*) AS n FROM sync_revisions").get().n===3);
  await a.locator("#fetch-source").click();
  await a.locator("#selected-meta").getByText("2",{exact:true}).waitFor();
  await a.locator("#read-history").click();
  await a.locator("#history").getByText(/"revision": 2/).waitFor();
  success("Mac recovers latest remote revision and immutable history",true);
  // Download cloud original is explicit; then delete another synthetic card.
  await fileInput(a,1,0);
  await a.locator("#fetch-source").click();
  const cloudDownload=a.waitForEvent("download");
  await a.locator("#download-cloud").click();
  const archive=await cloudDownload;
  const file="/tmp/radar-phase15b-cloud-backup-original.json";
  await archive.saveAs(file);
  const original=JSON.parse(readFileSync(file,"utf8"));
  success("Remote full JSON backup has fixed demo ID",
   original.id==="src_f1500000000000000000000000000002");
  a.on("dialog",dlg=>dlg.accept());
  await a.locator("#delete-source").click();
  await a.locator("#op-status").getByText(/合成來源及有效歷史已刪除/).waitFor();
  success("Deleting only fixture2 cascades history; source1 remains",
   conn.prepare("SELECT COUNT(*) AS n FROM sync_documents").get().n===1
   &&conn.prepare("SELECT COUNT(*) AS n FROM sync_revisions").get().n===2
   &&conn.prepare("SELECT COUNT(*) AS n FROM sync_events").get().n===2);
  await b.locator("#refresh-list").click();
  await b.waitForFunction(()=>!document.querySelector("#cloud-list")?.textContent?.includes(
   "src_f1500000000000000000000000000002"),null,{timeout:9000});
  success("iPhone refresh retains latest cloud while deleted second absent",
   (await b.locator("#cloud-list").innerText()).includes("Revision 2")
   &&!(await b.locator("#cloud-list").innerText()).includes("src_f1500000000000000000000000000002"));
  for(const width of [390,768,1280]){
   await b.setViewportSize({width,height:844});
   const dimensions=await b.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    client:document.documentElement.clientWidth,
   }));
   if(dimensions.scroll>dimensions.client+1){
    const info=await b.evaluate(()=>[...document.querySelectorAll("body *")].map(el=>{
      const box=el.getBoundingClientRect();
      return {tag:el.tagName,className:el.className||"",right:Math.round(box.right),
       left:Math.round(box.left),scroll:el.scrollWidth,client:el.clientWidth};
    }).filter(x=>x.right>document.documentElement.clientWidth+2).slice(0,18));
    console.log("OVERFLOW_DEBUG",width,dimensions,info);
   }
   success("No horizontal overflow at width "+width,dimensions.scroll<=dimensions.client+1);
  }
  success("All browser requests same origin",requests.every(r=>new URL(r.url).origin===host));
  success("No browser JS exceptions",errors.length===0);
  console.log("PHASE15B_MULTI_ARTICLE_CROSS_DEVICE_REAL_BROWSER_ALL_PASS");
 }catch(error){
  console.error("PHASE15B_E2E_FAILED",error.stack);process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  if(serverInstance)await new Promise(resolve=>serverInstance.close(resolve));
  conn.close();
 }
})();
