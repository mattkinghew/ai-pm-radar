"use strict";
const $=id=>document.getElementById(id);
let selected=null,records=[],dailyFixture=null,busy=false;
const summaries=[
 "Synthetic source: students requested more practice.",
 "Synthetic revised source: student requests remained unverified in a real study."
];
function status(message){$("status").textContent=message;}
function show(data){$("audit").textContent=JSON.stringify(data,null,2);}
function ready(){
 const has=!!selected,reviewed=selected?.approvals.reviewed===true;
 for(const k of ["review","daily","reuse","edit","stale"])$(k).disabled=busy||!has;
 $("review").disabled=busy||!has||reviewed;
 $("daily").disabled=busy||!reviewed||selected.approvals.daily;
 $("reuse").disabled=busy||!reviewed||selected.approvals.reuse;
}
async function request(path,method="GET",body){
 const init={method,headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store"};
 if(body!==undefined)init.body=JSON.stringify(body);
 const response=await fetch(path,init);
 let data;try{data=await response.json()}catch{throw Error("HTTP "+response.status+" 非 JSON 回應，請重新登入。")}
 return {status:response.status,data};
}
function render(){
 const region=$("records");region.replaceChildren();
 for(const item of records){
  const btn=document.createElement("button");btn.type="button";btn.className="record";
  btn.setAttribute("aria-current",String(item.source_id===selected?.source_id));
  const id=document.createElement("span");id.textContent=item.source_id;
  const rev=document.createElement("span");rev.className="statuspill";rev.textContent="v"+item.revision;
  btn.append(id,rev);btn.addEventListener("click",()=>void loadOne(item.source_id));
  region.appendChild(btn);
 }
 $("revision").textContent=selected?String(selected.revision):"—";
 $("review-status").textContent=selected?(selected.approvals.reviewed?"已審核":"待審核"):"—";
 $("daily-status").textContent=selected?(selected.approvals.daily?"已批准":"未批准"):"—";
 $("reuse-status").textContent=selected?(selected.approvals.reuse?"已批准":"未批准"):"—";
 $("record").textContent=selected?JSON.stringify(selected.record,null,2):"";
 ready();
}
async function loadOne(id){
 const r=await request("/api/cloud/records/"+encodeURIComponent(id));
 if(r.status!==200)throw Error("讀取來源失敗，HTTP "+r.status);
 selected=r.data;render();
}
async function refresh(target){
 try{
  const result=await request("/api/cloud/records");
  if(result.status!==200)throw Error("HTTP "+result.status+" "+(result.data.code??""));
  records=result.data.records;
  if(records.length){
   const preferred=target&&records.some(r=>r.source_id===target)?target:
      selected&&records.some(r=>r.source_id===selected.source_id)?selected.source_id:records[0].source_id;
   await loadOne(preferred);
  }else{selected=null;render()}
  status("已從 D1 讀取 "+records.length+" 筆合成來源"+(selected?"；目前 Revision "+selected.revision:"。"));
 }catch(err){status("讀取失敗："+err.message)}
}
async function act(label,path,method="POST",body){
 if(busy)return;busy=true;ready();
 try{
  const r=await request(path,method,body);
  if(r.status===409){
   status("版本衝突（HTTP 409）：另一裝置已更新。請按「從雲端重新讀取」，不會自動覆寫。");
   show(r.data);return r;
  }
  if(r.status!==200&&r.status!==201){
   status(label+" 被拒絕（HTTP "+r.status+"）："+(r.data.code??"未知錯誤"));show(r.data);return r;
  }
  await refresh(r.data.source_id);
  status(label+"：成功（HTTP "+r.status+"）。最新 Revision "+r.data.revision);
  return r;
 }catch(err){status(label+"：錯誤 "+err.message)}
 finally{busy=false;ready()}
}
$("refresh").addEventListener("click",()=>void refresh());
$("create").addEventListener("click",async()=>{
 try{
  const fixture=await request("/api/cloud/fixture");
  if(fixture.status!==200)throw Error("範本無法載入");
  dailyFixture=fixture.data.daily;
  const id="qa12_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
  const record={...fixture.data.record,id};
  await act("建立完整 SourceRecord","/api/cloud/records","POST",{source_id:id,record});
 }catch(err){status("建立失敗："+err.message)}
});
$("review").addEventListener("click",()=>selected&&void act("人工 Review","/api/cloud/records/"+selected.source_id+"/review","POST",{expectedRevision:selected.revision}));
$("daily").addEventListener("click",async()=>{
 if(!selected)return;
 if(!dailyFixture){const fixture=await request("/api/cloud/fixture");if(fixture.status!==200){status("取得 Daily 合成資料失敗");return;}dailyFixture=fixture.data.daily;}
 await act("Daily Approval","/api/cloud/records/"+selected.source_id+"/approve-daily","POST",{expectedRevision:selected.revision,daily:dailyFixture});
});
$("reuse").addEventListener("click",()=>selected&&void act("Source Library v4 Approval","/api/cloud/records/"+selected.source_id+"/approve-reuse","POST",{expectedRevision:selected.revision}));
$("edit").addEventListener("click",async()=>{
 if(!selected)return;
 const other=selected.record.summary===summaries[0]?summaries[1]:summaries[0];
 await act("修改摘要及重設兩類 Approval","/api/cloud/records/"+selected.source_id,"PUT",{expectedRevision:selected.revision,record:{...selected.record,summary:other}});
});
$("stale").addEventListener("click",async()=>{
 if(!selected)return;
 const response=await request("/api/cloud/records/"+selected.source_id,"PUT",
   {expectedRevision:Math.max(1,selected.revision-1),record:selected.record});
 status(response.status===409?"PASS：舊版請求已拒絕（HTTP 409）":"未達預期："+response.status);
 show(response.data);
});
$("history").addEventListener("click",async()=>{
 if(!selected){status("請先選擇來源");return}
 try{const r=await request("/api/cloud/records/"+selected.source_id+"/history");show(r.data);status("已載入只讀事件紀錄（HTTP "+r.status+"）")}
 catch(err){status(err.message)}
});
$("library").addEventListener("click",async()=>{
 if(!selected){status("請先選擇來源");return}
 try{
  const r=await request("/api/cloud/records/"+selected.source_id+"/library");
  show(r.data);
  if(r.status===200)status("已讀取目前獲准重用的 Library v4 快照");
  else if(r.status===409)status("舊 Library 快照仍在歷史紀錄，但目前批准已失效，不能重用（HTTP 409）。請先重新 Review 和批准。");
  else status("此來源尚無正式 Library 快照（HTTP "+r.status+"）");
 }catch(err){status(err.message)}
});
refresh();
