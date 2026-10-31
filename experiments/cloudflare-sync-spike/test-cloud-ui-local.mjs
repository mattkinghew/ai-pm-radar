import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync,spawn} from "node:child_process";
import {createRequire} from "node:module";
import assert from "node:assert/strict";

const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const dir=dirname(fileURLToPath(import.meta.url));
const w=process.env.WRANGLER_BIN;
assert.ok(w,"WRANGLER_BIN required");
const temp=mkdtempSync(join(tmpdir(),"radar-cloud-ui12-"));
const env={...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"};
const cfg=["--config","wrangler-context-local.jsonc"];
const url="http://127.0.0.1:8802/cloud-sync/";
let server,browser;const logs=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function startup(){
 for(let n=0;n<50;n++){await sleep(240);if(server.exitCode!==null)break;
  try{if((await fetch(url,{signal:AbortSignal.timeout(1500)})).status===200)return;}
  catch{}
 }
 throw Error("Wrangler not ready: "+logs.slice(-5).join(" | "));
}
async function awaitStatus(page,regexp){await page.locator("#status").getByText(regexp).waitFor({timeout:15000})}
async function clickResult(page,id,prefix){
 await page.locator("#"+id).click();
 await page.waitForFunction((value)=>document.querySelector("#status").textContent.startsWith(value),prefix,{timeout:15000});
}
async function selected(page){return page.locator("#record").textContent().then(t=>t?JSON.parse(t):null)}
try{
 for(const sql of ["schema.sql","schema-v12.sql"]){
  execFileSync(process.execPath,[w,"d1","execute","DB","--local","--persist-to",temp,"--file",sql,"--yes",...cfg],{cwd:dir,env,stdio:"pipe",timeout:60000});
 }
 server=spawn(process.execPath,[w,"dev","--local","--ip","127.0.0.1","--port","8802","--persist-to",temp,...cfg],{cwd:dir,env,stdio:["ignore","pipe","pipe"]});
 server.stdout.on("data",b=>logs.push(String(b).slice(0,400)));
 server.stderr.on("data",b=>logs.push(String(b).slice(0,400)));
 await startup();
 browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
 const errors=[];
 const phone=await browser.newContext({viewport:{width:390,height:844}});
 const phonePage=await phone.newPage();
 phonePage.on("pageerror",e=>errors.push(e.message));
 await phonePage.goto(url,{waitUntil:"domcontentloaded"});
 await phonePage.getByRole("heading",{name:"AI PM Radar — 雲端來源同步驗收"}).waitFor();
 await phonePage.locator("#create").click();
 await awaitStatus(phonePage,/建立完整 SourceRecord：成功/);
 assert.equal(await phonePage.locator("#revision").innerText(),"1");
 console.log("PASS phone 390px full SourceRecord create");
 const first=await selected(phonePage);assert.equal(first.record_version,2);
 const id=first.id;
 await phonePage.locator("#review").click();
 await awaitStatus(phonePage,/人工 Review：成功/);
 assert.equal(await phonePage.locator("#revision").innerText(),"2");
 console.log("PASS phone explicit Review");
 await phonePage.locator("#daily").click();
 await awaitStatus(phonePage,/Daily Approval：成功/);
 assert.equal(await phonePage.locator("#daily-status").innerText(),"已批准");
 assert.equal(await phonePage.locator("#reuse-status").innerText(),"未批准");
 console.log("PASS Daily distinct from Library");
 await phonePage.locator("#reuse").click();
 await awaitStatus(phonePage,/Source Library v4 Approval：成功/);
 assert.equal(await phonePage.locator("#reuse-status").innerText(),"已批准");
 await phonePage.locator("#library").click();
 await awaitStatus(phonePage,/已讀取目前獲准重用的 Library v4/);
 assert.match(await phonePage.locator("#audit").textContent(),/approved_at/);
 console.log("PASS phone v4 Library immutable snapshot");
 const desktop=await browser.newContext({viewport:{width:1280,height:800}});
 const desktopPage=await desktop.newPage();desktopPage.on("pageerror",e=>errors.push(e.message));
 await desktopPage.goto(url,{waitUntil:"domcontentloaded"});
 await desktopPage.waitForFunction(()=>document.querySelector("#records").children.length>0,{timeout:15000});
 assert.equal(await desktopPage.locator("#revision").innerText(),"4");
 assert.equal((await selected(desktopPage)).id,id);
 console.log("PASS new Mac browser reads same D1 SourceRecord");
 await phonePage.locator("#edit").click();
 await awaitStatus(phonePage,/修改摘要及重設兩類 Approval：成功/);
 assert.equal(await phonePage.locator("#revision").innerText(),"5");
 assert.equal(await phonePage.locator("#daily-status").innerText(),"未批准");
 assert.equal(await phonePage.locator("#reuse-status").innerText(),"未批准");
 console.log("PASS cross-device edit invalidates both approvals");
 await desktopPage.locator("#edit").click();
 await awaitStatus(desktopPage,/版本衝突（HTTP 409）/);
 console.log("PASS stale Mac revision 409 without overwrite");
 await desktopPage.locator("#refresh").click();
 await desktopPage.waitForFunction(()=>document.querySelector("#revision").textContent==="5",{timeout:10000});
 assert.equal(await desktopPage.locator("#daily-status").innerText(),"未批准");
 console.log("PASS Mac refresh sees iPhone revision v5");
 await desktopPage.locator("#history").click();
 await awaitStatus(desktopPage,/已載入只讀事件紀錄/);
 assert.match(await desktopPage.locator("#audit").textContent(),/approved_for_reuse/);
 await phonePage.reload({waitUntil:"domcontentloaded"});
 await phonePage.waitForFunction(()=>document.querySelector("#revision").textContent==="5",{timeout:15000});
 console.log("PASS independent reload persists cloud event history");
 for(const width of [390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"AI PM Radar — 雲端來源同步驗收"}).waitFor();
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(size.scroll<=size.client+1,"overflow "+width+" "+JSON.stringify(size));
  if(width===390)await page.screenshot({path:"/tmp/radar-phase12b-cloud-mobile-390.png",fullPage:true});
  console.log("PASS responsive/no horizontal overflow "+width);
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log("CLOUD12_UI_CROSS_DEVICE_LOCAL_PASS");
}catch(e){console.error("CLOUD12_UI_LOCAL_FAIL",e.stack);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(server){server.kill("SIGTERM");await sleep(400);if(server.exitCode===null)server.kill("SIGKILL")}
 rmSync(temp,{recursive:true,force:true});
}
