"use strict";
// Protected synthetic-only same-origin gateway. No real text fields or auto-sync.
const $ = id => document.getElementById(id);
const summaries = [
  "Synthetic source: students requested more practice.",
  "Synthetic revised source: student requests remained unverified in a real study.",
];
const prefix = "radar-phase12c2-gateway-draft-v1:";
const validId = /^qa12_[A-Za-z0-9_-]{6,70}$/;
let ready = false, fixture = null, daily = null, local = null, remote = null;
let selected = null, backed = null, busy = false;
const say = message => { $("message").textContent = message; };
const digest = record => JSON.stringify(record);
const confirmed = () => Boolean(local && backed === digest(local.record) && $("confirm-backup").checked);
const same = () => Boolean(local && remote && local.record.id === remote.source_id);
const stale = () => Boolean(same() && local.revision !== null && local.revision !== remote.revision);
function validateRecord(record) {
  if (!record || !validId.test(record.id) || record.record_version !== 2 ||
      !fixture || record.raw_text !== fixture.raw_text ||
      record.source_url !== fixture.source_url || record.title !== fixture.title ||
      !summaries.includes(record.summary) || !Array.isArray(record.evidence))
    throw Error("僅限完整合成 SourceRecord；不允許真實正文。");
  return record;
}
function save() {
  if (local) localStorage.setItem(prefix + local.record.id,
    JSON.stringify({version:1, record:local.record, revision:local.revision}));
}
function draftFrom(record, revision=null) {
  const copy = structuredClone(validateRecord(record));
  copy.review_status = "needs_review"; copy.approval_status = "not_approved";
  return {record:copy, revision};
}
function draw() {
  $("local-id").textContent = local?.record.id ?? "—";
  $("local-state").textContent = local ? "本機合成資料" : "—";
  $("ack-revision").textContent = local?.revision ?? "尚未同步";
  $("title").value = local?.record.title ?? "";
  $("body").value = local?.record.raw_text ?? "";
  $("summary").value = local?.record.summary ?? summaries[0];
  $("local-json").textContent = local ? JSON.stringify(local.record,null,2) : "";
  $("revision").textContent = remote?.revision ?? "—";
  $("review").textContent = remote ? (remote.approvals.reviewed ? "已 Review" : "待 Review") : "—";
  $("daily").textContent = remote ? (remote.approvals.daily ? "已批准" : "未批准") : "—";
  $("reuse").textContent = remote ? (remote.approvals.reuse ? "已批准" : "未批准") : "—";
  const active = ready && !busy;
  for (const id of ["new-local","remote-list","select-id"]) $(id).disabled = !active;
  $("refresh-remote").disabled = !active || !selected;
  for (const id of ["save-local","download","summary"]) $(id).disabled = !active || !local;
  $("confirm-backup").disabled = !active || !local || backed !== digest(local.record);
  $("upload").disabled = !active || !confirmed() || !local ||
    (remote && (!same() || stale() || remote.record.summary === local.record.summary)) ||
    (!remote && local.revision !== null);
  $("mark-reviewed").disabled = !active || !remote || stale() || remote.approvals.reviewed;
  $("approve-daily").disabled = !active || !remote || stale() || !remote.approvals.reviewed || remote.approvals.daily;
  $("approve-library").disabled = !active || !remote || stale() || !remote.approvals.reviewed || remote.approvals.reuse;
  $("show-library").disabled = $("show-history").disabled = !active || !remote;
  $("conflict").hidden = !(remote && (!local || stale() || same() && local.revision === null));
  $("use-remote").disabled = !active || !remote || Boolean(local && !confirmed());
}
async function api(path, method="GET", body) {
  if (path !== "/api/cloud/capabilities" && !ready) throw Error("Gateway 能力未通過。");
  if (!path.startsWith("/api/cloud/")) throw Error("拒絕跨域來源。");
  const response = await fetch(path,{
    method,credentials:"same-origin",cache:"no-store",redirect:"manual",
    headers:{"Accept":"application/json",...(method==="GET"?{}:{"Content-Type":"application/json"})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  const data = await response.json().catch(()=>null);
  if (!data || typeof data !== "object") throw Error("伺服器回應不是 JSON，請重新登入。");
  return {status:response.status,data};
}
function checkCapabilities(data) {
  const expected = {gateway_version:1,api_version:1,source_record_version:2,source_library_version:4,
    access_enforced:true,same_origin_required:true,synthetic_only:true,real_sources_opt_in:false,
    expected_revision_required:true,human_approval_required:true,scope:"protected_owner_synthetic_preview"};
  if (location.protocol !== "https:" && !["localhost","127.0.0.1"].includes(location.hostname))
    throw Error("需要 HTTPS。");
  for (const [k,v] of Object.entries(expected)) if (data?.[k] !== v) throw Error("能力不符合："+k);
  if (!Number.isInteger(data.max_record_bytes) || data.max_record_bytes<1024 || data.max_record_bytes>100000)
    throw Error("不支援的來源長度上限");
}
async function listRemote(showNotice=true) {
  const r = await api("/api/cloud/records");
  if (r.status!==200 || !Array.isArray(r.data.records)) throw Error("來源列表讀取失敗。");
  const select=$("select-id"), prev=selected;select.replaceChildren(new Option("請選擇雲端來源",""));
  for (const item of r.data.records) if (validId.test(item.source_id))
    select.add(new Option(item.source_id+" · v"+item.revision,item.source_id));
  if (prev && [...select.options].some(o=>o.value===prev)) select.value=prev;
  if (showNotice) say("讀回 "+r.data.records.length+" 筆來源；沒有覆寫本機草稿。");
}
async function readRemote(id) {
  if (!validId.test(id)) throw Error("來源 ID 無效。");
  const r=await api("/api/cloud/records/"+id);
  if (r.status===404) {remote=null;draw();return null;}
  if (r.status!==200 || r.data.source_id!==id || r.data.record?.id!==id)
    throw Error("讀取雲端來源失敗（"+r.status+"）。");
  validateRecord(r.data.record);remote=r.data;selected=id;draw();return remote;
}
async function init() {
  try {
    const cap=await api("/api/cloud/capabilities");
    if (cap.status!==200) throw Error("能力端點拒絕："+cap.status);
    checkCapabilities(cap.data);ready=true;
    const f=await api("/api/cloud/fixture");
    if(f.status!==200 || f.data.record?.record_version!==2)throw Error("合成來源範本不可用。");
    fixture=f.data.record;daily=f.data.daily;
    $("auth").textContent="Cloudflare Access 身份已驗證";
    $("capabilities").textContent="同源 SourceRecord v2／Library v4／Synthetic-only";
    await listRemote(false);
    say("受保護 Gateway 已就緒。可建立本機合成來源或讀取雲端測試資料。");
  }catch(e) {
    ready=false;$("auth").textContent="拒絕／需重新登入";
    $("capabilities").textContent=e.message;say("無法啟用雲端："+e.message);
  } finally {draw();}
}
function newDraft() {
  const id="qa12_"+Date.now().toString(36)+"_"+crypto.randomUUID().replaceAll("-","").slice(0,12);
  const source=structuredClone(fixture);source.id=id;
  selected=id;remote=null;local=draftFrom(source);backed=null;$("confirm-backup").checked=false;
  save();draw();say("新建合成來源 v2 本機草稿。請先下載最新 JSON 備份。");
}
function download() {
  if(!local)return;
  const json=JSON.stringify({format:"radar-gateway-synthetic-v1",version:1,
    saved_at:new Date().toISOString(),synthetic_only:true,
    record:local.record,ack_revision:local.revision},null,2);
  const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="radar-gateway-"+local.record.id+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  backed=digest(local.record);$("confirm-backup").checked=false;draw();
  say("已觸發完整本機合成草稿備份下載。確認檔案存在後，才可勾選並上傳。");
}
async function upload() {
  if(!local || !confirmed() || selected!==local.record.id) return;
  busy=true;draw();
  try {
    const id=local.record.id, current=await api("/api/cloud/records/"+id);
    if (current.status!==200 && current.status!==404) throw Error("雲端 Preflight 失敗");
    if(current.status===200) {
      remote=current.data;
      if (local.revision===null || local.revision!==remote.revision) {
        say("版本衝突（HTTP 409）。本機草稿保留，請人工選擇。");return;
      }
      if(local.record.summary===remote.record.summary) {
        say("雲端內容一致，不需要新增版本。");return;
      }
    } else if(local.revision!==null) throw Error("雲端已不存在；禁止直接重建。");
    const create=current.status===404;
    const r=await api(create?"/api/cloud/records":"/api/cloud/records/"+id,
      create?"POST":"PUT",create?{source_id:id,record:local.record}:
      {expectedRevision:local.revision,record:local.record});
    if(r.status===409) {
      const changed=await api("/api/cloud/records/"+id);
      if(changed.status===200)remote=changed.data;
      say("HTTP 409：另一裝置已更新，沒有覆寫。");return;
    }
    if (![200,201].includes(r.status)) throw Error("拒絕寫入（HTTP "+r.status+"）："+(r.data.code||""));
    validateRecord(r.data.record);
    remote=r.data;local.revision=r.data.revision;save();
    backed=null;$("confirm-backup").checked=false;
    await listRemote(false);
    say("同源上傳與讀回成功，Revision "+remote.revision+"；未自動 Review 或 Approval。");
  } catch(e){say(e.message)}
  finally {busy=false;draw()}
}
async function action(path,label,extra={}) {
  if(!remote||stale())return say("本機版本需要重新核對。");
  busy=true;draw();
  try {
    const r=await api("/api/cloud/records/"+remote.source_id+path,"POST",
      {expectedRevision:remote.revision,...extra});
    if(r.status===409) {
      await readRemote(remote.source_id);
      say("版本衝突 409：另一裝置已修改，請人工核對。");return;
    }
    if(r.status!==200)throw Error("人工步驟被拒絕（HTTP "+r.status+"）："+r.data.code);
    remote=r.data;
    if(local?.record.id===remote.source_id){local.revision=remote.revision;save()}
    say(label+" 成功，Revision "+remote.revision);
  }catch(e){say(e.message)}
  finally{busy=false;draw()}
}

function stageRemote() {
  if(!remote)return;
  if(local && !confirmed())return say("請先保存最新本機草稿 JSON 並確認，避免覆寫。");
  if(local && local.record.id!==remote.source_id)return say("不同來源不可自動合併。");
  local=draftFrom(remote.record,remote.revision);
  selected=remote.source_id;backed=null;$("confirm-backup").checked=false;
  save();draw();say("已人工採用雲端版本作為本機新草稿；雲端資料沒有更動，審批沒有複製。");
}
$("new-local").addEventListener("click",()=>{try{newDraft()}catch(e){say(e.message)}});
$("remote-list").addEventListener("click",()=>void listRemote().catch(e=>say(e.message)));
$("refresh-remote").addEventListener("click",()=>selected&&void readRemote(selected)
  .then(result=>say(result?"已讀取雲端 Revision "+result.revision+"；未覆寫本機。":"找不到雲端來源。"))
  .catch(e=>say(e.message)));
$("select-id").addEventListener("change",async event=>{
  const id=event.currentTarget.value;if(!id)return;
  selected=id;remote=null;
  try{
    await readRemote(id);
    if(!local){
      const raw=localStorage.getItem(prefix+id);
      if(raw){
        const cached=JSON.parse(raw);
        if(cached.version!==1||cached.record?.id!==id||raw.length>110000)throw Error("本機緩存損壞");
        local=draftFrom(cached.record,cached.revision); 
      }
    }
    draw();say("已選擇雲端來源，資料只讀；必要時請明確採用為本機草稿。");
  }catch(e){say("資料檢查失敗："+e.message)}
});
$("summary").addEventListener("change",event=>{
  if(!local||!summaries.includes(event.currentTarget.value))return;
  local.record.summary=event.currentTarget.value;
  backed=null;$("confirm-backup").checked=false;
  save();draw();say("本機摘要已修改，之前的備份確認失效；雲端未改動。");
});
$("save-local").addEventListener("click",()=>{save();say("合成草稿只存在此瀏覽器；未上傳。")});
$("download").addEventListener("click",download);
$("confirm-backup").addEventListener("change",draw);
$("upload").addEventListener("click",()=>void upload());
$("mark-reviewed").addEventListener("click",()=>void action("/review","人工 Review"));
$("approve-daily").addEventListener("click",()=>void action("/approve-daily","Daily Approval",{daily}));
$("approve-library").addEventListener("click",()=>void action("/approve-reuse","Source Library Approval"));
$("show-history").addEventListener("click",async()=>{
  if(!remote)return;
  try{const r=await api("/api/cloud/records/"+remote.source_id+"/history");
    $("cloud-json").textContent=JSON.stringify(r.data,null,2);
    say("唯讀事件歷史（HTTP "+r.status+"）。")
  }catch(e){say(e.message)}
});
$("show-library").addEventListener("click",async()=>{
  if(!remote)return;
  try{
    const r=await api("/api/cloud/records/"+remote.source_id+"/library");
    $("cloud-json").textContent=JSON.stringify(r.data,null,2);
    say(r.status===200?"已讀取當前可重用 Library v4":
      r.status===409?"舊快照失效 409；不能當成目前批准。":"目前未批准，HTTP "+r.status);
  }catch(e){say(e.message)}
});
$("keep-local").addEventListener("click",()=>say("已保留本機來源；沒有自動覆寫。"));
$("use-remote").addEventListener("click",stageRemote);
init();
