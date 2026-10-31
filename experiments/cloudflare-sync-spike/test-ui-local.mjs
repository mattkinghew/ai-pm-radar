import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require=createRequire(import.meta.url);
const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const dir=dirname(fileURLToPath(import.meta.url));
const wrangler=process.env.WRANGLER_BIN;
if(!wrangler)throw Error("WRANGLER_BIN must point to already installed local Wrangler.");
const persist=mkdtempSync(join(tmpdir(),"radar-cf-ui-"));
const env={...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"};
const cfg=["--config","wrangler-context-local.jsonc"];
let server, browser;
const messages=[];
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function ready(){
 for(let i=0;i<40;i++){
  await sleep(250);
  if(server.exitCode!==null)throw Error("Wrangler server exited: "+messages.slice(-3).join(" | "));
  try {const r=await fetch("http://127.0.0.1:8798/");if(r.status===200)return;} catch {}
 }
 throw Error("Local authenticated test Worker never became ready.");
}
async function progress(page,text){
 const output=page.locator("#output");
 await page.waitForFunction(val=>document.querySelector("#output").textContent.includes(val),text,{timeout:8000});
 return output.innerText();
}
try{
 execFileSync(process.execPath,[wrangler,"d1","execute","DB","--local","--persist-to",persist,"--file","schema.sql","--yes",...cfg],{cwd:dir,env,stdio:"pipe",timeout:90000});
 server=spawn(process.execPath,[wrangler,"dev","--local","--ip","127.0.0.1","--port","8798","--persist-to",persist,...cfg],{cwd:dir,env,stdio:["ignore","pipe","pipe"]});
 server.stdout.on("data",b=>messages.push(String(b).slice(0,500)));
 server.stderr.on("data",b=>messages.push(String(b).slice(0,500)));
 await ready();
 browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const page=await ctx.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8798/",{waitUntil:"domcontentloaded",timeout:12000});
 await page.getByRole("heading",{name:"AI PM Radar 跨裝置同步測試"}).waitFor();
 await page.locator("#create").click();
 assert.match(await progress(page,'"revision": 1'),/needs_review/);
 console.log("PASS UI create synthetic record");
 await page.locator("#review").click();
 assert.match(await progress(page,'"revision": 2'),/"review_status": "reviewed"/);
 console.log("PASS UI explicit review");
 await page.locator("#approve").click();
 assert.match(await progress(page,'"revision": 3'),/"approved": true/);
 console.log("PASS UI explicit approve");
 await page.locator("#stale").click();
 await page.getByText(/舊版本被拒絕（HTTP 409）/).waitFor();
 console.log("PASS UI stale CAS conflict");
 await page.locator("#edit").click();
 const v4=await progress(page,'"revision": 4');
 assert.match(v4,/"approved": false/);
 assert.match(v4,/"review_status": "needs_review"/);
 console.log("PASS UI edit invalidates approval");
 await page.reload({waitUntil:"domcontentloaded"});
 assert.match(await progress(page,'"revision": 4'),/"approved": false/);
 console.log("PASS UI reload persists");
 const ctx2=await browser.newContext({viewport:{width:1280,height:800}});
 const page2=await ctx2.newPage();page2.on("pageerror",e=>errors.push(e.message));
 await page2.goto("http://127.0.0.1:8798/",{waitUntil:"domcontentloaded"});
 assert.match(await progress(page2,'"revision": 4'),/"needs_review"/);
 console.log("PASS separate browser context sees same D1");
 const invalid=await page.evaluate(async()=>{
   const record={record_version:2,id:"real_record",raw_text:"Private material",source_url:"https://private.example",
     key_claims:[{claim:"A",evidence:[{text_reference:"A"}]}]};
   const response=await fetch("/api/records",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source_id:"real_record",record})});
   return response.status;
 });
 assert.equal(invalid,422);
 console.log("PASS synthetic-only prevents real source upload");
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert.ok(width.scroll<=width.client+1,JSON.stringify(width));
 assert.deepEqual(errors,[]);
 console.log("PASS 390px no overflow/no page errors");
 console.log("UI_PLAYWRIGHT_8_OF_8_PASS");
}catch(e){console.error("UI_TEST_FAILED",e.stack);process.exitCode=1}
finally{
 if(browser)await browser.close();
 if(server){server.kill("SIGTERM");await sleep(400);if(server.exitCode===null)server.kill("SIGKILL")}
 rmSync(persist,{recursive:true,force:true});
}
