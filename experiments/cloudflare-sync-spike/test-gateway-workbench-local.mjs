import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync,spawn} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const dir=dirname(fileURLToPath(import.meta.url));
const w=process.env.WRANGLER_BIN;
assert.ok(w,"WRANGLER_BIN required");
const db=mkdtempSync(join(tmpdir(),"radar-gateway-"));
const host="http://127.0.0.1:8802";
const env={...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"};
const cfg=["--config","wrangler-context-local.jsonc"];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser;
const errors=[],network=[];
function ok(name,condition){assert.ok(condition,name);console.log("PASS",name)}
async function text(page,pattern){await page.locator("#message").getByText(pattern).waitFor({timeout:14000})}
function track(page) {
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>network.push(r.url()));
}
async function saveCopy(page,name) {
 const ready=page.waitForEvent("download",{timeout:12000});
 await page.locator("#download").click();
 const dl=await ready;
 const path="/tmp/radar-gateway-"+name+"-synthetic.json";
 await dl.saveAs(path);
 const data=JSON.parse(readFileSync(path,"utf8"));
 ok("full synthetic backup JSON readback "+name,data.record.record_version===2
   &&data.synthetic_only===true&&data.record.evidence.length===1);
 await page.locator("#confirm-backup").check();
}
try{
 for(const schema of ["schema.sql","schema-v12.sql"])
  execFileSync(process.execPath,[w,"d1","execute","DB","--local","--persist-to",db,"--file",schema,"--yes",...cfg],{cwd:dir,env,timeout:60000,stdio:"pipe"});
 server=spawn(process.execPath,[w,"dev","--local","--ip","127.0.0.1","--port","8802","--persist-to",db,...cfg],{cwd:dir,env,stdio:"ignore"});
 let live=false;
 for(let i=0;i<50;i++){await pause(200);if(server.exitCode!==null)break;
  try{live=(await fetch(host+"/api/cloud/capabilities")).status===200;if(live)break}catch{}
 }
 ok("same origin Wrangler D1+Gateway live",live);
 const cap=await fetch(host+"/api/cloud/capabilities").then(r=>r.json());
 ok("synthetic-only Access capabilities fail closed for real data",
  cap.synthetic_only===true&&cap.real_sources_opt_in===false&&cap.access_enforced===true&&cap.same_origin_required===true);
 browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
 const mac=await browser.newContext({viewport:{width:1280,height:850},acceptDownloads:true});
 const phone=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const a=await mac.newPage(),b=await phone.newPage();
 track(a);track(b);
 await a.goto(host+"/gateway-workbench/",{waitUntil:"domcontentloaded"});
 await text(a,/受保護 Gateway 已就緒/);
 ok("Gateway handshake enables synthetic only UI",await a.locator("#new-local").isEnabled());
 await a.locator("#new-local").click();
 await text(a,/新建合成來源 v2 本機草稿/);
 ok("local draft cannot upload without backup",await a.locator("#upload").isDisabled());
 const id=await a.locator("#local-id").innerText();
 assert.match(id,/^qa12_/);
 await saveCopy(a,"mac-initial");
 await a.locator("#upload").click();
 await text(a,/同源上傳與讀回成功/);
 ok("full v2 SourceRecord created, revision 1",await a.locator("#revision").innerText()==="1");
 await a.locator("#mark-reviewed").click();await text(a,/人工 Review 成功/);
 await a.locator("#approve-daily").click();await text(a,/Daily Approval 成功/);
 ok("Daily approved, Library still false",await a.locator("#daily").innerText()==="已批准"
   &&await a.locator("#reuse").innerText()==="未批准");
 await a.locator("#approve-library").click();await text(a,/Source Library Approval 成功/);
 ok("independent Library approval rev4",await a.locator("#revision").innerText()==="4"
   &&await a.locator("#reuse").innerText()==="已批准");
 await a.locator("#show-library").click();await text(a,/當前可重用 Library v4/);
 await b.goto(host+"/gateway-workbench/",{waitUntil:"domcontentloaded"});
 await text(b,/受保護 Gateway 已就緒/);
 await b.locator("#select-id").selectOption(id);
 await b.waitForFunction(()=>document.querySelector("#revision").textContent==="4",{timeout:12000});
 ok("separate phone sees Mac revision 4",await b.locator("#review").innerText()==="已 Review");
 await b.locator("#use-remote").click();
 await text(b,/已人工採用雲端版本作為本機新草稿/);
 ok("phone stages local draft without transferring remote approvals",await b.locator("#local-id").innerText()===id);
 await b.locator("#summary").selectOption("Synthetic revised source: student requests remained unverified in a real study.");
 ok("changed local draft invalidated backup",await b.locator("#upload").isDisabled());
 await saveCopy(b,"phone-revision");
 await b.locator("#upload").click();await text(b,/同源上傳與讀回成功/);
 ok("phone revision 5 and review approvals invalidated",
   await b.locator("#revision").innerText()==="5"
   &&await b.locator("#daily").innerText()==="未批准"&&await b.locator("#reuse").innerText()==="未批准");
 await b.locator("#show-library").click();await text(b,/舊快照失效 409/);
 await a.locator("#summary").selectOption("Synthetic revised source: student requests remained unverified in a real study.");
 await saveCopy(a,"mac-stale");
 await a.locator("#upload").click();await text(a,/版本衝突（HTTP 409）/);
 ok("Mac stale revision refused with no overwrite",await a.locator("#revision").innerText()==="5");
 await a.locator("#keep-local").click();await text(a,/已保留本機來源/);
 await a.locator("#use-remote").click();await text(a,/已人工採用雲端版本作為本機新草稿/);
 ok("explicit conflict resolution updates local ACK",await a.locator("#ack-revision").innerText()==="5");
 await a.locator("#show-history").click();await text(a,/唯讀事件歷史/);
 const history=JSON.parse(await a.locator("#cloud-json").textContent());
 ok("immutable audit trail contains 5 events",history.events.length===5);
 await b.reload({waitUntil:"domcontentloaded"});await text(b,/受保護 Gateway 已就緒/);
 await b.locator("#select-id").selectOption(id);
 await b.waitForFunction(()=>document.querySelector("#local-id").textContent!=="—",{timeout:12000});
 ok("phone reload keeps its own local saved synthetic draft",await b.locator("#ack-revision").innerText()==="5");
 for(const width of [390,768,1280]){
   await b.setViewportSize({width,height:844});
   const size=await b.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   ok("no horizontal overflow "+width,size.scroll<=size.client+1);
   if(width===390)await b.screenshot({path:"/tmp/radar-gateway-workbench-390-synthetic.png",fullPage:true});
 }
 const forged=await fetch(host+"/api/cloud/records",{method:"POST",
  headers:{"content-type":"application/json","origin":host},
  body:JSON.stringify({source_id:"qa12_private_test",record:{...JSON.parse(readFileSync("/tmp/radar-gateway-mac-initial-synthetic.json","utf8")).record,
   id:"qa12_private_test",raw_text:"A secret non-synthetic article"}})});
 ok("non-synthetic article rejected",(await forged.json()).code==="synthetic_record_required"&&forged.status===422);
 ok("browser requests stay on exact same protected origin",network.every(u=>new URL(u).origin===host));
 ok("browser script without runtime errors",errors.length===0);
 console.log("GATEWAY_WORKBENCH_SYNTHETIC_CROSS_DEVICE_LOCAL_PASS");
}catch(error){console.error("GATEWAY_WORKBENCH_TEST_FAILURE",error.stack);process.exitCode=1}
finally{
 if(browser)await browser.close();
 if(server){server.kill("SIGTERM");await pause(400);if(server.exitCode===null)server.kill("SIGKILL")}
 rmSync(db,{recursive:true,force:true});
}
