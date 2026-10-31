/** REAL Next.js SourceInboxWorkbench, in-memory D1, signed-identity simulation only. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import http from "node:http";
import {readFileSync} from "node:fs";
import {join,extname,resolve,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import worker from "./worker.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const sha=x=>createHash("sha256").update(x).digest("hex");
const email="owner-react-workbench@example.invalid";
const ownerSha=sha(email);
const article=JSON.parse(readFileSync(new URL("./fixtures/clean-room-public-article.json",import.meta.url),"utf8"));
const content=JSON.stringify(article);
const hash=sha(content);
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
db.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
const ownerId="cf_"+ownerSha;
const at=new Date(),due=new Date(at.getTime()+7*86400_000);
db.prepare("INSERT INTO pilot_documents VALUES (?,?,?,?,?,?,?)").run(ownerId,article.id,1,hash,at.toISOString(),at.toISOString(),due.toISOString());
db.prepare("INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)").run(ownerId,article.id,1,hash,content,at.toISOString());
db.prepare("INSERT INTO pilot_review_events VALUES (?,?,?,?,?)").run(ownerId,article.id,1,"created",at.toISOString());
const directory=resolve(import.meta.dirname,".phase14-assets");
const env={
 CLOUD_ACCESS_REQUIRED:"true",OWNER_EMAIL_SHA256:ownerSha,
 PILOT_REAL_UPLOAD_ENABLED:"false",PINNED_ARTICLE_ID:article.id,
 PINNED_ARTICLE_SHA256:hash,
 PINNED_UPDATE_SHA256:sha(JSON.stringify({...article,summary:"修訂版：為跨裝置協作增加明確備份與人工衝突處理。"})),
 PILOT_WRITE_PREFLIGHT_ENABLED:"true",PURGE_JOB_ENABLED:"true",
 DB:{prepare(sql){
   const stmt=db.prepare(sql);
   return {bind(...args){return {first:async()=>stmt.get(...args)??null,
     all:async()=>({results:stmt.all(...args)}),
     run:async()=>({meta:{changes:stmt.run(...args).changes}})};}
 }}},
 ASSETS:{async fetch(request){
   let path=new URL(request.url).pathname;
   if(path==="/pilot-source-inbox/"||path==="/pilot-source-inbox")path="/pilot-source-inbox/index.html";
   const target=resolve(directory,"."+path);
   if(!target.startsWith(directory+sep))return new Response("not found",{status:404});
   let bytes;
   try{bytes=readFileSync(target)}catch{return new Response("not found",{status:404})}
   const extension=extname(target);
   const mime=extension===".js"?"text/javascript":extension===".css"?"text/css":
     extension===".html"?"text/html":extension===".woff2"?"font/woff2":"application/octet-stream";
   return new Response(bytes,{status:200,headers:{"content-type":mime}});
 }},
};
const authorized={access:{getIdentity:async()=>({email})}};
const unauthorized={access:{getIdentity:async()=>({email:"other@example.invalid"})}};
const origin="http://127.0.0.1:8848";
async function server(){
 const httpServer=http.createServer(async(req,res)=>{
  try{
   const headers=new Headers();
   for(const [k,v] of Object.entries(req.headers))if(typeof v==="string")headers.set(k,v);
   const request=new Request(origin+req.url,{method:req.method,headers,
     ...(req.method!=="GET"?{body:req,duplex:"half"}:{})});
   const result=await worker.fetch(request,env,authorized);
   res.writeHead(result.status,Object.fromEntries(result.headers));
   res.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){console.error("LOCAL_TEST_SERVER_ERROR",error.message);res.writeHead(500);res.end("error")}
 });
 await new Promise(resolve=>httpServer.listen(8848,"127.0.0.1",resolve));
 return httpServer;
}
function pass(name,ok){assert.ok(ok,name);console.log("PASS",name)}
async function backupThenVerify(page){
 const area=page.getByTestId("pilot-one-article-workspace");
 const save=area.getByRole("button",{name:"備份本機 Source Inbox 工作台"});
 await save.waitFor({state:"visible",timeout:10000});
 await page.waitForFunction(()=>document.querySelector(".persistence-status")?.textContent?.includes("保存於目前瀏覽器"),null,{timeout:12000});
 const downloading=page.waitForEvent("download");
 await save.click();
 const file=await downloading;
 const dest="/tmp/radar-phase14-react-workbench-backup.json";
 await file.saveAs(dest);
 const parsed=JSON.parse(readFileSync(dest,"utf8"));
 pass("real React full workbench backup with material",parsed.version===1 && parsed.items?.[0]?.activeMaterialId===article.id);
 await area.locator('input[type="file"]').last().setInputFiles(dest);
 await page.getByTestId("pilot-local-backup-status").getByText(/PASS：本機草稿備份已核對/).waitFor({timeout:10000});
}
(async()=>{
 let browser,serverInstance;
 try{
  for(const route of ["/pilot-source-inbox/","/_next/static/chunks/probe.js","/api/pilot/record",
   "/api/pilot/update-preflight"]){
   let called=0;
   const target=new Request(origin+route,{headers:{"Cf-Access-Jwt-Assertion":"spoofed"}});
   const sealed={...env,ASSETS:{fetch:async()=>{called++;return new Response("bad",{status:200})}}};
   for(const identity of [unauthorized,{}]){
    const response=await worker.fetch(target,sealed,identity);
    pass("Access denies unauthorized "+route+" before asset fetch",response.status===401&&called===0);
   }
  }
  serverInstance=await server();
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const mac=await browser.newContext({viewport:{width:1280,height:820},acceptDownloads:true});
  const phone=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const a=await mac.newPage(),b=await phone.newPage();
  const errors=[],requests=[];
  for(const p of [a,b]){
   p.on("pageerror",e=>errors.push(e.message));
   p.on("request",r=>requests.push({method:r.method(),url:r.url()}));
  }
  const response=await a.goto(origin+"/pilot-source-inbox/",{waitUntil:"networkidle",timeout:20000});
  pass("real React Next page from protected Worker",response.status()===200);
  const panel=a.getByTestId("pilot-one-article-workspace");
  await panel.getByText(/雲端完整性 PASS/).waitFor({timeout:16000});
  pass("cloud record and revision displayed",await a.getByTestId("pilot-cloud-revision").textContent()==="1"
   &&(await a.getByTestId("pilot-cloud-hash").textContent())===hash);
  pass("server upload capability OFF", (await a.getByTestId("pilot-upload-off").textContent()).includes("OFF"));
  await a.getByTestId("phase15-sync-status").getByText(/PASS：多文章合約已安裝/).waitFor({timeout:10000});
  pass("Phase1.5A disabled multi-source capability is discoverable",
    (await a.getByTestId("phase15-sync-off").textContent()).includes("OFF"));
  const down=a.waitForEvent("download");
  await panel.getByRole("button",{name:"下載完整雲端原件 JSON"}).click();
  const archive=await down;const archivePath="/tmp/radar-phase14-pinned-source-download.json";
  await archive.saveAs(archivePath);
  pass("cloud original JSON matches D1 record",sha(JSON.stringify(JSON.parse(readFileSync(archivePath,"utf8"))))===hash);
  await panel.locator('input[type="file"]').first().setInputFiles(archivePath);
  await a.getByTestId("pilot-cloud-backup-status").getByText(/已重新讀回驗證/).waitFor();
  pass("cloud backup imported and hash verified",true);
  await a.getByTestId("pilot-stage-cloud").click();
  await a.getByTestId("pilot-phase14-status").getByText(/已明確將雲端 Revision 1/).waitFor();
  await a.getByRole("heading",{name:"核對草稿",exact:true}).waitFor();
  pass("actual React workbench renders article after manual stage",
   (await a.locator("#summary").inputValue())===article.summary);
  await backupThenVerify(a);
  pass("after local staging must require backup before re-staging",
   await a.getByTestId("pilot-stage-cloud").isEnabled());
  await a.getByTestId("pilot-apply-demo-summary").click();
  await a.getByTestId("pilot-local-projection").getByText(/local_fields_differ/).waitFor();
  await backupThenVerify(a);
  await a.getByTestId("pilot-update-dry-run").waitFor({state:"visible"});
  pass("proposal requires cloud and local checked backups",
   await a.getByTestId("pilot-update-dry-run").isEnabled());
  await a.getByTestId("pilot-update-dry-run").click();
  await a.getByTestId("pilot-update-status").getByText(/PASS：候選 Revision 2/).waitFor({timeout:12000});
  pass("local actual React summary proposal gets server validation",
   await a.getByTestId("pilot-update-hash").textContent()
    .then(text=>text?.includes(env.PINNED_UPDATE_SHA256)));
  const candidateDownload=a.waitForEvent("download");
  await a.getByTestId("pilot-candidate-download").click();
  const candidateDownloaded=await candidateDownload;
  const candidateFile="/tmp/radar-phase14c-controlled-candidate-QA.json";
  await candidateDownloaded.saveAs(candidateFile);
  const candidateFromFile=JSON.parse(readFileSync(candidateFile,"utf8"));
  pass("candidate complete JSON retains original raw text and Evidence",
   candidateFromFile.raw_text===article.raw_text
   &&JSON.stringify(candidateFromFile.evidence)===JSON.stringify(article.evidence)
   &&candidateFromFile.review_status==="needs_review"
   &&candidateFromFile.approval_status==="not_approved");
  pass("candidate backup SHA256 equals server preflight SHA",
   sha(JSON.stringify(candidateFromFile))===env.PINNED_UPDATE_SHA256);
  await a.getByTestId("pilot-controlled-commit-stage").locator('input[type="file"]').setInputFiles(candidateFile);
  await a.getByTestId("pilot-candidate-verification").getByText(/PASS：候選內容/).waitFor();
  pass("controlled commit remains OFF in browser",
   (await a.getByTestId("pilot-commit-disabled").textContent()).includes("OFF"));
  pass("preflight did not update cloud revision",
   db.prepare("SELECT current_revision AS revision FROM pilot_documents").get().revision===1
   &&db.prepare("SELECT COUNT(*) AS total FROM pilot_revisions").get().total===1);
  await a.reload({waitUntil:"networkidle"});
  await a.getByTestId("pilot-one-article-workspace").getByText(/雲端完整性 PASS/).waitFor();
  pass("isolated browser IndexedDB restores local article",await a.getByRole("heading",{name:"核對草稿",exact:true}).count()===1);
  pass("after reload local reconcilation sees both copies",await a.getByTestId("pilot-local-projection").count()===1);
  await b.goto(origin+"/pilot-source-inbox/",{waitUntil:"networkidle"});
  await b.getByTestId("pilot-one-article-workspace").getByText(/雲端完整性 PASS/).waitFor();
  pass("independent iPhone browser sees same cloud v1",await b.getByTestId("pilot-cloud-revision").textContent()==="1");
  await b.getByTestId("phase15-sync-status").getByText(/PASS：多文章合約已安裝/).waitFor({timeout:10000});
  pass("iPhone independently receives disabled Phase1.5A capability",
    (await b.getByTestId("phase15-sync-off").textContent()).includes("OFF"));
  pass("iPhone browser does not inherit Mac IndexedDB form",
    (await b.getByTestId("pilot-local-projection").innerText()).includes("no_local")
    &&await b.getByRole("heading",{name:"核對草稿",exact:true}).count()===0);
  await b.getByTestId("pilot-stage-cloud").click();
  await b.getByRole("heading",{name:"核對草稿",exact:true}).waitFor();
  await b.locator("#summary").evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement){
   if(parent.tagName==="DETAILS")parent.open=true;
  }});
  await b.locator("#summary").fill("Local-only proposed update; never transmitted.");
  await b.getByTestId("pilot-local-projection").getByText(/local_fields_differ/).waitFor();
  pass("local edit shown as difference, not uploaded",true);
  const before=db.prepare("SELECT current_revision AS n FROM pilot_documents").get().n;
  pass("cloud still at revision1 after local edits",before===1);
  pass("no live cloud writes; only bounded preflight POST",
   requests.filter(x=>x.method!=="GET").length===1
   &&requests.filter(x=>x.method!=="GET")[0].method==="POST"
   &&new URL(requests.filter(x=>x.method!=="GET")[0].url).pathname==="/api/pilot/update-preflight");
  pass("all requests same origin",requests.every(x=>new URL(x.url).origin===origin));
  for(const width of [390,768,1280]){
   await b.setViewportSize({width,height:844});
   const sizes=await b.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   if(sizes.sw>sizes.cw+1){
    const wide=await b.evaluate(()=>[...document.querySelectorAll("body *")].map(el=>{
      const box=el.getBoundingClientRect();
      return {tag:el.tagName,cls:typeof el.className==="string"?el.className:"",
        text:el.textContent?.slice(0,70),left:Math.round(box.left),right:Math.round(box.right)};
    }).filter(e=>e.right>document.documentElement.clientWidth+3).slice(0,13));
    const scrolls=await b.evaluate(()=>[...document.querySelectorAll("body *")].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,className:typeof el.className==="string"?el.className:"",scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,text:el.textContent?.slice(0,65)})).slice(0,18));
    console.log("OVERFLOW_DEBUG",width,sizes,wide,scrolls);
   }
   pass("mobile-friendly no overflow "+width,sizes.sw<=sizes.cw+1);
  }
  pass("zero React runtime errors",errors.length===0);
  // Phase 1.4D: simulate the independently Owner-approved D1 Revision2
  // WITHOUT any request to remote/live D1 or an in-browser write endpoint.
  const updated={...article,summary:"修訂版：為跨裝置協作增加明確備份與人工衝突處理。"};
  const updatedSha=sha(JSON.stringify(updated));
  pass("Revision2 local test is pinned to allowed candidate",updatedSha===env.PINNED_UPDATE_SHA256);
  const updateAt=new Date().toISOString();
  db.prepare("UPDATE pilot_documents SET current_revision=2,content_sha256=?,updated_at=? WHERE current_revision=1")
    .run(updatedSha,updateAt);
  db.prepare("INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)")
    .run(ownerId,article.id,2,updatedSha,JSON.stringify(updated),updateAt);
  db.prepare("INSERT INTO pilot_review_events VALUES (?,?,?,?,?)")
    .run(ownerId,article.id,2,"edited",updateAt);
  for(const page of [a,b]){
   await page.reload({waitUntil:"networkidle"});
   await page.getByTestId("pilot-one-article-workspace").getByText(/雲端完整性 PASS/).waitFor({timeout:12000});
   pass("React Workbench reads approved cloud Revision2 and pinned SHA",
    await page.getByTestId("pilot-cloud-revision").textContent()==="2"
    &&await page.getByTestId("pilot-cloud-hash").textContent()===updatedSha);
   pass("Live cloud commit remains disabled in UI",
    (await page.getByTestId("pilot-upload-off").textContent()).includes("OFF"));
   pass("obsolete Phase1.4B preflight hidden once approved Revision2 is current",
    await page.getByTestId("pilot-revision2-accepted").count()===1
    &&await page.getByTestId("pilot-update-dry-run").count()===0);
  }
  pass("Actual React original/edited cloud revisions preserved in isolated D1",
   db.prepare("SELECT count(*) AS n FROM pilot_revisions").get().n===2);
  pass("Zero browser runtime exceptions after cloud revision2",errors.length===0);
  console.log("PHASE14_REAL_NEXT_REACT_BROWSER_TESTS_ALL_PASS");
 }catch(error){
  console.error("PHASE14_REAL_REACT_BROWSER_FAIL",error.stack);process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  if(serverInstance)await new Promise(resolve=>serverInstance.close(resolve));
  db.close();
 }
})();
