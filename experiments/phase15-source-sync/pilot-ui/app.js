"use strict";
(()=>{
 const base="/api/source-sync/v1/";
 const $=id=>document.getElementById(id);
 let fixtures=[],selected=null,remote=null,consentHash="",backupVerified=false;
 let capabilities=null;
 const status=(id,msg,warning=false)=>{
  const el=$(id);el.textContent=msg;
  el.className=warning?"notice dangerNotice":"notice";
 };
 const sha=async v=>{
  const bytes=new TextEncoder().encode(JSON.stringify(v));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 };
 const getBody=async response=>{
  if(!response.headers.get("content-type")?.includes("application/json"))
   throw Error("Cloudflare Access 未登入或非 JSON 回應");
  const data=await response.json();
  if(!response.ok)throw Error("HTTP "+response.status+" : "+(data.code||"unknown"));
  return data;
 };
 const api=async(path,method="GET",body)=>{
  if(!path||path.startsWith("/")||path.includes(".."))throw Error("不合法來源 API");
  const response=await fetch(base+path,{method,credentials:"same-origin",cache:"no-store",
   redirect:"manual",headers:{"accept":"application/json",...(body?{"content-type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  return getBody(response);
 };
 const fixture=()=>selected?.versions[Number($("variant").value)]??null;
 const invalidate=()=>{
  backupVerified=false;consentHash="";$("verify-json").value="";
  status("backup-status","候選備份已失效；請重新下載完整 JSON 並核對。");
 };
 const resetRemote=()=>{
  remote=null;$("selected-meta").textContent="";$("history").textContent="未讀取版本歷史";
 };
 const line=(parent,k,v)=>{
  const key=document.createElement("dt"),val=document.createElement("dd");
  key.textContent=k;val.textContent=String(v);
  parent.append(key,val);
 };
 const refresh=async()=>{
  try{
   const data=await api("records");
   $("cloud-list").textContent=data.records.length?
     data.records.map(r=>r.source_id+" · Revision "+r.current_revision+" · "+r.content_sha256.slice(0,14)+"…").join("\n"):
     "目前沒有合成文章。";
   status("connection","Cloudflare Access 通過；多文章同步可用。仍只接受六個固定合成來源。");
  }catch(e){status("connection","BLOCKED："+e.message,true)}
 };
 const updateSelected=()=>{
  invalidate();
  const record=fixture();$("selected-info").textContent=record?
   record.title+"／"+record.summary:"請先選擇來源。";
  $("source-preview").textContent=record?JSON.stringify({
   id:record.id,title:record.title,summary:record.summary,
   raw_text:record.raw_text,evidence:record.evidence,review_status:record.review_status,
   approval_status:record.approval_status,
  },null,2):"—";
 };
 const select=(f)=>{
  selected=f;resetRemote();
  for(const button of $("fixture-cards").children){
   button.classList.toggle("selected",button.dataset.id===f.id);
  }
  $("variant").value="0";updateSelected();
 };
 const fetchRemote=async()=>{
  if(!selected)throw Error("請先選擇文章");
  try{
   const data=await api("records/"+selected.id);
   if(data.source_id!==selected.id||data.record.id!==selected.id||
      await sha(data.record)!==data.sha256)throw Error("雲端 SourceRecord SHA-256 不一致");
   remote=data;
   const meta=$("selected-meta");meta.replaceChildren();
   line(meta,"Cloud Revision",data.revision);
   line(meta,"SHA-256",data.sha256);
   line(meta,"到期時間 (UTC)",data.purge_due_at);
   line(meta,"雲端摘要",data.record.summary);
   line(meta,"Review／Approval",data.record.review_status+" / "+data.record.approval_status);
   status("op-status","雲端版本已讀取。選擇新版摘要及備份後可以嘗試 CAS 更新。");
  }catch(e){
   resetRemote();status("op-status","無法取得雲端文章："+e.message,true);
   throw e;
  }
 };
 const download=(record,prefix)=>{
  if(!record)throw Error("尚未選擇來源");
  const blob=new Blob([JSON.stringify(record,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=prefix+"-"+record.id+".json";document.body.appendChild(link);
  link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 };
 const verifiedConsent=async()=>{
  const chosen=fixture();
  if(!chosen||!backupVerified)throw Error("候選完整 JSON 尚未下載及驗證");
  const candidateHash=await sha(chosen);
  if(candidateHash!==consentHash)throw Error("候選備份與目前摘要版本不一致");
  if(!$("approve-rights").checked||!$("approve-retention").checked||!$("approve-residual").checked)
   throw Error("請完成逐篇權利、七日保留及 Time Travel 風險確認");
  return {
   record:chosen,
   authorization:{source_id:chosen.id,content_sha256:candidateHash,
    backup_verified:true,rights_confirmed:true,seven_day_retention_accepted:true,
    time_travel_residual_acknowledged:true},
  };
 };
 const handle=async(fn)=>{
  for(const b of ["create-source","update-source","delete-source"])$(b).disabled=true;
  try{await fn()}catch(e){status("op-status","BLOCKED："+e.message,true)}
  finally{for(const b of ["create-source","update-source","delete-source"])$(b).disabled=false}
 };
 $("refresh-list").addEventListener("click",()=>void refresh());
 $("variant").addEventListener("change",updateSelected);
 $("fetch-source").addEventListener("click",()=>void handle(fetchRemote));
 $("read-history").addEventListener("click",()=>void handle(async()=>{
  if(!selected)throw Error("請先選擇");
  const data=await api("records/"+selected.id+"/history");
  $("history").textContent=JSON.stringify(data,null,2);
  status("op-status","不可變 Revision 歷史已核對。");
 }));
 $("download-selected").addEventListener("click",()=>void handle(async()=>{
  const chosen=fixture();download(chosen,"radar-synthetic-candidate");
  invalidate();status("backup-status","已下載本篇完整候選 JSON；請重新選擇它以驗證。");
 }));
 $("download-cloud").addEventListener("click",()=>void handle(async()=>{
  if(!remote)throw Error("請先讀取現有雲端文章，再備份");
  download(remote.record,"radar-synthetic-cloud-revision-"+remote.revision);
  status("op-status","已下載既有雲端原件，請妥善保留以便人工差異復原。");
 }));
 $("verify-json").addEventListener("change",()=>void handle(async()=>{
  const file=$("verify-json").files?.[0];
  if(!file||file.size>85000)throw Error("只支援單篇 JSON（最多 85 KB）");
  const parsed=JSON.parse(await file.text()),actual=await sha(parsed),chosen=fixture();
  const expected=chosen&&await sha(chosen);
  if(!chosen||actual!==expected||JSON.stringify(parsed)!==JSON.stringify(chosen))
   throw Error("文件不是目前內建合成文章的完整候選版本");
  consentHash=actual;backupVerified=true;
  status("backup-status","PASS：完整 SourceRecord JSON 已讀回核對，SHA-256 "+actual);
 }));
 $("create-source").addEventListener("click",()=>void handle(async()=>{
  const body=await verifiedConsent();
  const result=await api("records","POST",body);
  resetRemote();await fetchRemote();await refresh();
  status("op-status","已建立合成文章 Revision 1；SHA-256 "+result.sha256);
 }));
 $("update-source").addEventListener("click",()=>void handle(async()=>{
  if(!remote)throw Error("先按從雲端讀取目前 Revision，才能更新");
  const body={...await verifiedConsent(),expectedRevision:remote.revision,expectedSha256:remote.sha256};
  try{
   const result=await api("records/"+selected.id,"PUT",body);
   if(result.purge_due_at!==remote.purge_due_at)throw Error("到期日期出現非預期變更");
   resetRemote();await fetchRemote();await refresh();
   status("op-status","成功提交合成修訂 Revision "+result.revision+
    "。人工 Approval 已失效，原有七日到期日未變。");
  }catch(e){
   if(e.message.includes("409"))status("op-status",
    "HTTP 409：另一裝置已更新。已保留你本機選擇的摘要；請先備份，再按雲端重新讀取人工處理差異。",true);
   throw e;
  }
 }));
 $("delete-source").addEventListener("click",()=>void handle(async()=>{
  if(!selected||!remote)throw Error("請先讀取雲端版本");
  if(!backupVerified||!consentHash)throw Error("刪除前請完成候選 JSON 下載／讀回。另建議下載雲端原件");
  const accepted=window.confirm("確認只刪除這篇虛構合成文章及其有效版本歷史？原有真實文章不受影響。");
  if(!accepted)return;
  const result=await api("records/"+selected.id,"DELETE",{
   confirmation:"DELETE_THIS_SOURCE",source_id:selected.id,expectedRevision:remote.revision,
  });
  if(!result.deleted)throw Error("刪除未確認");
  resetRemote();invalidate();await refresh();
  status("op-status","合成來源及有效歷史已刪除。D1 Time Travel 可能暫時保留備份副本。");
 }));
 (async()=>{
  try{
   capabilities=await api("capabilities");
   if(!capabilities.enabled||capabilities.synthetic_only!==true||
    capabilities.real_sources_allowed!==false||!capabilities.owner_scoped||
    capabilities.max_articles!==5||capabilities.max_revisions!==8||
    capabilities.max_retention_days!==7)throw Error("同步能力不符合安全要求");
   const list=await api("fixtures");
   fixtures=list.fixtures;
   if(fixtures.length!==3||fixtures.some(x=>!x.title.startsWith("SYNTHETIC ")))
    throw Error("合成資料不符合固定 allowlist");
   const caps=$("cap-display");
   line(caps,"安全模式","SYNTHETIC ONLY");
   line(caps,"Owner","Cloudflare Access authenticated");
   line(caps,"最多文章","5 篇");
   line(caps,"每篇最多版本","8 個");
   line(caps,"最長有效保留","7 日（不延長）");
   for(const f of fixtures){
    const button=document.createElement("button");
    button.type="button";button.className="card";button.dataset.id=f.id;
    button.textContent=f.title+" ／ 點擊測試兩種摘要";
    button.addEventListener("click",()=>select(f));
    $("fixture-cards").appendChild(button);
   }
   select(fixtures[0]);
   await refresh();
  }catch(e){
   status("connection","BLOCKED："+e.message,true);
   for(const button of document.querySelectorAll("button"))button.disabled=true;
  }
 })();
})();
