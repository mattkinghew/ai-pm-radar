const {chromium}=require("/Users/mattgor/.npm/_npx/31e32ef8478fbf80/node_modules/playwright");
const assert=require("node:assert/strict"),fs=require("node:fs");
const host=process.env.GATEWAY_TEST_ORIGIN||"http://127.0.0.1:8815";
const url=host+"/preview-source-inbox/";
function pass(name,ok){assert.ok(ok,name);console.log("PASS",name)}
async function waitStatus(page,regex){await page.getByTestId("synthetic-cloud-status").getByText(regex).waitFor({timeout:16000})}
async function backup(page,filepath){
 const panel=page.getByTestId("synthetic-actual-cloud-panel");
 await page.getByTestId("synthetic-actual-cloud-panel").getByRole("button",{name:/下載並儲存真正 Source Inbox JSON/}).waitFor({state:"visible",timeout:12000});
 await page.waitForFunction(()=>document.querySelector(".persistence-status")?.textContent?.includes("保存於目前瀏覽器"),{timeout:12000});
 const promised=page.waitForEvent("download",{timeout:15000});
 await panel.getByRole("button",{name:/下載並儲存真正 Source Inbox JSON/}).click();
 const download=await promised;await download.saveAs(filepath);
 const data=JSON.parse(fs.readFileSync(filepath,"utf8"));
 pass("actual React Workbench full backup",data.version===1&&data.items?.[0]?.materials?.[0]?.form?.body.includes("Synthetic AI PM Radar practice"));
 await panel.getByRole("checkbox",{name:/我已核對最新備份 JSON/}).check();
 return data;
}
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const errors=[],calls=[];
let mac,iphone;
try{
 mac=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
 iphone=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const a=await mac.newPage(),b=await iphone.newPage();
 for(const page of [a,b]){
  page.on("pageerror",error=>errors.push(error.message));
  page.on("request",request=>calls.push([request.method(),request.url()]));
 }
 await a.goto(url,{waitUntil:"networkidle"});
 await waitStatus(a,/同源安全閘道就緒/);
 pass("loaded actual SourceInboxWorkbench safely",await a.getByTestId("synthetic-actual-cloud-panel").count()===1);
 const panelA=a.getByTestId("synthetic-actual-cloud-panel");
 await panelA.getByRole("button",{name:/載入合成文章到 Source Inbox/}).click();
 await waitStatus(a,/已將完整合成/);
 await a.getByRole("heading",{name:"核對草稿",exact:true}).waitFor();
 const id=await panelA.locator(".status-row").innerText().then(t=>/Source ID：(\S+)/.exec(t)?.[1]);
 pass("synthetic source mapped into original React form",/^qa12_/.test(id)
  &&(await panelA.innerText()).includes("符合合成來源／可審查")
  &&(await a.getByText("Nine students requested additional practice.",{exact:false}).count())>0);
 pass("initial cloud upload requires backup",await panelA.getByRole("button",{name:/逐筆明確上傳／更新/}).isDisabled());
 await backup(a,"/tmp/radar-phase12c3-mac-workbench-synthetic.json");
 await panelA.getByRole("button",{name:/逐筆明確上傳／更新/}).click();
 await waitStatus(a,/讀回 v1/);
 pass("real React workbench -> protected D1 v1", (await panelA.innerText()).includes("雲端 Revision：1"));
 await panelA.getByRole("button",{name:"Review",exact:true}).click();await waitStatus(a,/雲端人工 Review PASS/);
 await panelA.getByRole("button",{name:"批准 Daily",exact:true}).click();await waitStatus(a,/Daily Approval PASS/);
 pass("daily approved and library not auto-approved", (await panelA.innerText()).includes("Daily：已批准")&&(await panelA.innerText()).includes("Library：未批准"));
 await panelA.getByRole("button",{name:"批准 Library",exact:true}).click();await waitStatus(a,/Library Approval PASS/);
 pass("independent source library approval reached v4",(await panelA.innerText()).includes("雲端 Revision：4"));
 await b.goto(url,{waitUntil:"networkidle"});await waitStatus(b,/同源安全閘道就緒/);
 const panelB=b.getByTestId("synthetic-actual-cloud-panel");
 await panelB.getByRole("combobox",{name:/選擇合成雲端 SourceRecord/}).selectOption(id);
 await b.waitForFunction(()=>document.querySelector('[data-testid="synthetic-actual-cloud-panel"]').textContent.includes("雲端 Revision：4"),{timeout:12000});
 pass("iPhone gets same remote v4 before adopting locally",await panelB.getByRole("button",{name:/已備份：明確將遠端版本載入/}).isEnabled());
 await panelB.getByRole("button",{name:/已備份：明確將遠端版本載入/}).click();
 await waitStatus(b,/已明確將雲端合成文章載入真正 Source Inbox/);
 await b.getByRole("heading",{name:"核對草稿",exact:true}).waitFor();
 pass("remote v4 material staged in real React form", (await panelB.innerText()).includes("全欄位合成驗證 PASS"));
 // Change summary inside original React review form (not standalone Gateway UI).
 await b.locator("#summary").evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true});
 const summaryInput=b.locator("textarea").filter({hasNot:b.locator("input")});
 
 for(const t of await b.locator("textarea").all()){
   const val=await t.inputValue();
   if(val==="Synthetic source: students requested more practice."){
     await t.fill("Synthetic revised source: student requests remained unverified in a real study.");
     break;
   }
 }
 await b.waitForTimeout(450);
 pass("real React manual summary change invalidates previous backup",await panelB.getByRole("button",{name:/逐筆明確上傳／更新/}).isDisabled());
 await backup(b,"/tmp/radar-phase12c3-phone-workbench-synthetic.json");
 await panelB.getByRole("button",{name:/逐筆明確上傳／更新/}).click();
 await waitStatus(b,/讀回 v5/);
 pass("phone edits via real React form revoke two approvals",
  (await panelB.innerText()).includes("雲端 Revision：5") &&
  (await panelB.innerText()).includes("Daily：未批准")&&(await panelB.innerText()).includes("Library：未批准"));
 // Simulate Mac stale edit with React form and upload preflight.
 await a.locator("#summary").evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true});
 for(const t of await a.locator("textarea").all()){
   const val=await t.inputValue();
   if(val==="Synthetic source: students requested more practice."){
    await t.fill("Synthetic revised source: student requests remained unverified in a real study.");break;
   }
 }
 await backup(a,"/tmp/radar-phase12c3-mac-stale-synthetic.json");
 await panelA.getByRole("button",{name:/逐筆明確上傳／更新/}).click();
 await waitStatus(a,/409：雲端版本已變更/);
 pass("Mac stale expectedRev4 fails closed on Rev5", (await panelA.innerText()).includes("雲端 Revision：5"));
 await panelA.getByRole("button",{name:/已備份：明確將遠端版本載入/}).click();
 await waitStatus(a,/已明確將雲端合成文章載入真正 Source Inbox/);
 pass("explicit remote restore resets ACK only after backup", (await panelA.innerText()).includes("已確認本機 Revision：5"));
 await b.reload({waitUntil:"networkidle"});await waitStatus(b,/同源安全閘道就緒/);
 await panelB.getByRole("combobox",{name:/選擇合成雲端 SourceRecord/}).selectOption(id);
 await b.waitForFunction(()=>document.querySelector('[data-testid="synthetic-actual-cloud-panel"]').textContent.includes("雲端 Revision：5"),{timeout:12000});
 pass("cloud remains independently readable after phone reload",true);
 for(const width of [390,768,1280]){
  await b.setViewportSize({width,height:844});
  const sizes=await b.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  pass("real React protected preview responsive "+width,sizes.sw<=sizes.cw+1);
  if(width===390)await b.screenshot({path:"/tmp/radar-phase12c3-real-react-390-synthetic.png",fullPage:true});
 }
 pass("no client errors",errors.length===0);
 pass("all request origins identical protected origin",calls.every(([,u])=>new URL(u).origin===host));
 console.log("PHASE12C3_ACTUAL_REACT_SOURCE_INBOX_LOCAL_PASS");
}catch(error){console.error("PHASE12C3_TEST_FAILURE",error.stack);process.exitCode=1}
finally{await browser.close()}
})();
