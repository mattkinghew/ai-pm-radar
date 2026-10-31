"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import type {SourceRecord} from "@/lib/source-inbox";
import {sourceRecordFingerprint} from "@/lib/source-library";
import {
  prepareSyntheticFullRecord,assertSyntheticFullRecord,syntheticAlternateValues,
  SYNTHETIC_MUTABLE_FIELDS,
} from "@/lib/synthetic-full-field";

type CloudHead = {
  source_id:string;revision:number;fingerprint:string;record:SourceRecord;
  approvals:{reviewed:boolean;daily:boolean;reuse:boolean};
};
type Fixture={record:SourceRecord;daily:unknown};
type CloudSyncState="local"|"pending"|"cloud_saved"|"failed"|"conflict";
const ID=/^qa12_[A-Za-z0-9_-]{6,70}$/;
const SUMMARIES=[
  "Synthetic source: students requested more practice.",
  "Synthetic revised source: student requests remained unverified in a real study.",
];
const ACK_KEY="radar-phase12c3-source-ack:";
const api=async(path:string,method="GET",body?:unknown)=>{
  if(!path.startsWith("/api/cloud/"))throw Error("Cloud API origin not permitted.");
  const res=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
    redirect:"manual",headers:{Accept:"application/json",...(method==="GET"?{}:{"content-type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data:unknown=await res.json().catch(()=>null);
  if(!data||typeof data!=="object")throw Error("Cloud Access session expired or invalid API response.");
  return {status:res.status,data:data as Record<string,unknown>};
};
type Props={
  record:SourceRecord;materialId:string|null;localSaved:boolean;
  onLoadSynthetic:(record:SourceRecord)=>void;
  onBackup:()=>Promise<void>;
};
export function SyntheticActualWorkbenchCloudPanel({record,materialId,localSaved,onLoadSynthetic,onBackup}:Props){
 const [fixture,setFixture]=useState<Fixture|null>(null);
 const [enabled,setEnabled]=useState(false);
 const [sources,setSources]=useState<Array<{source_id:string;revision:number}>>([]);
 const [cloud,setCloud]=useState<CloudHead|null>(null);
 const [selected,setSelected]=useState<string>("");
 const [ack,setAck]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [syncState,setSyncState]=useState<CloudSyncState>("local");
 const [notice,setNotice]=useState("正在驗證同源 Cloudflare Access Gateway…");
 const [backupHash,setBackupHash]=useState<string|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const formFingerprint=useMemo(()=>sourceRecordFingerprint(record),[record]);
 const unchangedBackup=backupHash===formFingerprint;
 const localMatches=Boolean(fixture && record.source_url===fixture.record.source_url
   && record.raw_text===fixture.record.raw_text && record.title===fixture.record.title
   && record.creator===fixture.record.creator);
 // The legacy Source Inbox uses a content-derived internal record.id;
 // cloud identity must instead be the independently bound material card ID.
 const mapped=localMatches && materialId===selected && Boolean(selected);
 const prepared=useMemo(()=>{
   if(!fixture || !mapped)return null;
   return prepareSyntheticFullRecord(record,fixture.record,selected);
 },[record,fixture,mapped,selected]);
 const fieldBlockers=prepared?.blockers??[];
 const sourceChanged=Boolean(cloud&&prepared&&
   sourceRecordFingerprint(prepared.record)!==sourceRecordFingerprint(cloud.record));
 const conflict=Boolean(cloud&&ack!==null&&cloud.revision!==ack);
 const writeable=enabled && mapped && prepared && fieldBlockers.length===0 && localSaved
   && unchangedBackup && confirmed && !busy &&
   (!cloud&&ack===null || Boolean(cloud&&ack!==null&&!conflict&&sourceChanged));

 const list=useCallback(async()=>{
  const r=await api("/api/cloud/records");
  if(r.status!==200||!Array.isArray(r.data.records))throw Error("Cloud list unavailable");
  const list=r.data.records as Array<{source_id:string;revision:number}>;
  setSources(list.filter(item=>ID.test(item.source_id)));
 },[]);
 const read=useCallback(async(id:string)=>{
  if(!ID.test(id))throw Error("Invalid synthetic source ID");
  const r=await api("/api/cloud/records/"+id);
  if(r.status===404){setCloud(null);return null}
  if(r.status!==200||r.data.source_id!==id)throw Error("Cloud source not available");
  const remote=r.data as unknown as CloudHead;
  if(remote.record.source_url!=="https://example.invalid/synthetic")throw Error("Remote is not synthetic");
  setCloud(remote);return remote;
 },[]);

 useEffect(()=>{
  let cancelled=false;
  void (async()=>{
   const capability=await api("/api/cloud/capabilities");
   const c=capability.data;
   if(capability.status!==200||c.gateway_version!==1||c.access_enforced!==true
     ||c.same_origin_required!==true||c.synthetic_only!==true||c.real_sources_opt_in!==false
     ||c.expected_revision_required!==true||c.source_record_version!==2||c.source_library_version!==4
     ||c.full_field_synthetic_version!==1)
     throw Error("Cloud gateway policy is not synthetic-only.");
   const f=await api("/api/cloud/fixture");
   if(f.status!==200||(f.data.record as SourceRecord)?.record_version!==2)throw Error("Synthetic fixture unavailable.");
   if(cancelled)return;
   setFixture(f.data as unknown as Fixture);
   setEnabled(true);
   setNotice("同源安全閘道就緒。可建立合成文章，並使用現有 Source Inbox 真實表單核對 Evidence。");
   await list();
  })().catch(err=>{if(!cancelled){setEnabled(false);setNotice("雲端功能鎖定："+err.message)}});
  return()=>{cancelled=true};
 },[list]);

 useEffect(()=>{
  setBackupHash(null);setConfirmed(false);
  setSyncState("local");
 },[materialId,formFingerprint]);

 const start=()=>{
  if(!fixture||!enabled||busy)return;
  const id="qa12_"+Date.now().toString(36)+"_"+crypto.randomUUID().replaceAll("-","").slice(0,12);
  const synthetic=structuredClone(fixture.record);synthetic.id=id;
  setSelected(id);setCloud(null);setAck(null);
  setSyncState("local");
  setBackupHash(null);setConfirmed(false);
  onLoadSynthetic(synthetic);
  setNotice("已將完整合成 SourceRecord v2 載入真正的 Source Inbox 表單（只在本機）。");
 };
 const choose=async(id:string)=>{
  if(!id||!enabled)return;
  setSelected(id);setCloud(null);setBackupHash(null);setConfirmed(false);
  setSyncState("local");
  try{
   const remote=await read(id);
   if(!remote)return;
   const stored=window.localStorage.getItem(ACK_KEY+id);
   setAck(stored&&Number.isSafeInteger(Number(stored))?Number(stored):null);
   setNotice("已讀取雲端 v"+remote.revision+"，沒有覆寫目前的本機 Source Inbox 草稿。");
  }catch(err){setNotice((err as Error).message)}
 };
 const backup=async()=>{
  if(!mapped||!localSaved||busy)return;
  setBusy(true);setConfirmed(false);
  try{
   await onBackup();
   setBackupHash(sourceRecordFingerprint(record));
   setNotice("已下載真正的 Source Inbox 工作台 JSON 備份；請確認檔案存在。");
  }catch{setNotice("備份失敗；禁止上雲。")}
  finally{setBusy(false)}
 };
 const stageRemote=()=>{
  if(!cloud||busy)return;
  if(materialId && (!unchangedBackup || !confirmed)){
   setNotice("採用遠端版本前，請先下載並核對本機工作台備份。");return;
  }
  setAck(cloud.revision);window.localStorage.setItem(ACK_KEY+cloud.source_id,String(cloud.revision));
  onLoadSynthetic(cloud.record);
  setBackupHash(null);setConfirmed(false);
  setSyncState("local");
  setNotice("已明確將雲端合成文章載入真正 Source Inbox 表單；本機與雲端 Approval 不互相冒認。");
 };
 const write=async()=>{
  if(!writeable||!fixture)return;
  setBusy(true);
  setSyncState("pending");
  try{
   const id=selected;
   const preflight=await api("/api/cloud/records/"+id);
   if(preflight.status!==200&&preflight.status!==404)throw Error("Preflight failed HTTP "+preflight.status);
   if((preflight.status===200&&(ack===null||(preflight.data.revision as number)!==ack))
      ||preflight.status===404&&ack!==null){
    if(preflight.status===200){
     const observed=await read(id);
     if(ack===null&&prepared&&observed
       &&sourceRecordFingerprint(observed.record)===sourceRecordFingerprint(prepared.record)){
      setAck(observed.revision);window.localStorage.setItem(ACK_KEY+id,String(observed.revision));
      setSyncState("cloud_saved");
      await list().catch(()=>undefined);
      setNotice("先前寫入已由伺服器讀回確認；採用既有 Revision "+observed.revision+"，沒有重複建立。");return;
     }
    }
    setSyncState("conflict");
    setNotice("409：雲端版本已變更；拒絕覆寫，請人工選擇保留或採用遠端。");return;
   }
   // Every mutable field comes from the ACTUAL React Workbench SourceRecord.
   // The pure profile guards all schema fields; server independently verifies
   // the canonical synthetic fixture and rejects non-whitelisted strings.
   if(!prepared||prepared.blockers.length)throw Error("Structured synthetic field validation failed.");
   const canon=structuredClone(prepared.record);
   if(assertSyntheticFullRecord(canon,{...fixture.record,id}).length)
     throw Error("Synthetic field policy mismatch.");
   const create=preflight.status===404;
   const result=await api(create?"/api/cloud/records":"/api/cloud/records/"+id,
    create?"POST":"PUT",create?{source_id:id,record:canon}:{expectedRevision:ack,record:canon});
   if(result.status===409){
    await read(id);setSyncState("conflict");setNotice("HTTP 409：另一裝置已更新，沒有覆寫。");return;
   }
   if(result.status!==200&&result.status!==201)throw Error("Cloud refused "+result.status+" "+result.data.code);
   const saved=result.data as unknown as CloudHead;
   if(saved.source_id!==id||!Number.isSafeInteger(saved.revision)
     ||sourceRecordFingerprint(saved.record)!==sourceRecordFingerprint(canon))
    throw Error("Server acknowledgement did not match the submitted source.");
   const verified=await read(id);
   if(!verified||verified.source_id!==id||verified.revision!==saved.revision
     ||sourceRecordFingerprint(verified.record)!==sourceRecordFingerprint(canon))
    throw Error("Server read-back did not match the submitted source.");
   setCloud(verified);setAck(verified.revision);setSelected(id);
   window.localStorage.setItem(ACK_KEY+id,String(verified.revision));
   setBackupHash(null);setConfirmed(false);
   await list().catch(()=>undefined);
   setSyncState("cloud_saved");
   setNotice("完整 SourceRecord v2 已取得伺服器逐筆讀回確認：Revision "+verified.revision+"；修改後必須重新人工 Review／Approval。");
  }catch(err){setSyncState("failed");setNotice((err as Error).message)}
  finally{setBusy(false)}
 };
 const applyPreset=()=>{
   if(!fixture||!selected||busy)return;
   const alt=syntheticAlternateValues();
   const source=structuredClone(fixture.record);
   source.id=selected;
   for(const field of SYNTHETIC_MUTABLE_FIELDS){
     if(field in alt)(source as unknown as Record<string,unknown>)[field]=structuredClone(
       (alt as Record<string,unknown>)[field]
     );
   }
   source.analysis.source_facts=[...alt.analysis_source_facts];
   source.analysis.inferences=[...alt.analysis_inferences];
   source.analysis.method_or_teaching_points=[...alt.analysis_methods];
   onLoadSynthetic(source);
   setBackupHash(null);setConfirmed(false);
   setSyncState("local");
   setNotice("已把 16 個來源欄位及 3 個分析欄位的合成替代版本載入真正 React 表單；請檢查 Evidence，再備份確認。");
 };
 const approve=async(path:string,label:string)=>{
  if(!cloud||conflict||busy)return;
  setBusy(true);
  try{
   const result=await api("/api/cloud/records/"+cloud.source_id+path,"POST",
     {expectedRevision:cloud.revision,...(path==="/approve-daily"?{daily:fixture?.daily}:{})});
   if(result.status===409){
    await read(cloud.source_id);setNotice("HTTP 409：其他裝置已更新；重新核對後才能審批。");return;
   }
   if(result.status!==200)throw Error(label+" blocked: "+result.data.code);
   const next=result.data as unknown as CloudHead;
   setCloud(next);
   setAck(next.revision);window.localStorage.setItem(ACK_KEY+next.source_id,String(next.revision));
   setNotice(label+" PASS，雲端 Revision "+next.revision+"。");
  }catch(err){setNotice((err as Error).message)}
  finally{setBusy(false)}
 };
 return <section className="workbench-section stack-md" data-testid="synthetic-actual-cloud-panel">
  <div className="workbench-section-heading"><div>
    <h2>☁ Phase 1.2C-4 — Full-field SourceRecord v2 Sync</h2>
    <p>原有 React 表單完整合成欄位同步：Key Claims／Evidence、摘要、Key Points、Implications、Tags、Evidence Grade／Confidence 及分析欄位。只允許內建合成內容值；正文及來源身份不可任意改寫。</p>
   </div></div>
  <p className="workbench-notice"><strong>隔離測試。</strong> 非合成文章、其他 URL、模型 API、背景收集及自動上傳均不可用。
    此頁的工作台草稿使用獨立 IndexedDB，不會載入正式 Radar 的草稿。</p>
  <div className="action-row">
   <button type="button" className="primary-button" onClick={start} disabled={!enabled||busy}>1. 載入合成文章到 Source Inbox</button>
   <button type="button" className="secondary-button" onClick={applyPreset} disabled={!enabled||!selected||busy}>
    套用完整合成欄位測試版本
   </button>
   <button type="button" className="secondary-button" onClick={()=>void list()} disabled={!enabled||busy}>重新讀取雲端來源清單</button>
  </div>
  <label>雲端合成來源（跨裝置選相同 ID）
   <select aria-label="選擇合成雲端 SourceRecord" value={sources.some(s=>s.source_id===selected)?selected:""}
     onChange={event=>void choose(event.target.value)} disabled={!enabled||busy}>
    <option value="">只讀選擇雲端紀錄</option>
    {sources.map(item=><option key={item.source_id} value={item.source_id}>{item.source_id} · v{item.revision}</option>)}
   </select>
  </label>
  <div className="status-row">
   <span>Source ID：{selected||"—"}</span>
   <span>本機備份：{confirmed&&unchangedBackup?"已確認":"未確認"}</span>
   <span>雲端 Revision：{cloud?.revision??"尚未建立"}</span>
   <span>已確認本機 Revision：{ack??"無"}</span>
  </div>
  <p role="status" aria-live="polite" data-testid="cloud-sync-state" data-state={syncState}>
   <strong>{syncState==="local"?"Local":syncState==="pending"?"Pending":syncState==="cloud_saved"?"Cloud Saved":syncState==="failed"?"Failed":"Conflict"}</strong>
   {syncState==="cloud_saved"&&cloud?" · Revision "+cloud.revision:""}
  </p>
  <p>React SourceRecord 本機結構：{!mapped?(materialId?"身份或來源不符合，禁止上雲":"尚未載入來源"):
   fieldBlockers.length?"合成欄位校驗 BLOCKED（"+fieldBlockers.join("；")+"）":"全欄位合成驗證 PASS"}。</p>
  {prepared?<p className="field-hint" data-testid="full-field-sync-stats">同步版本：Schema v2／合成 Full-field v1，合成欄位 {SYNTHETIC_MUTABLE_FIELDS.length} 項＋Analysis 3 項；與雲端比較：{sourceChanged?"內容已變更":"無待同步修改"}。</p>:null}

  <div className="action-row">
   <button type="button" className="secondary-button" onClick={()=>void backup()} disabled={!mapped||!localSaved||busy}>2. 下載並儲存真正 Source Inbox JSON</button>
  </div>
  <label className="checkbox-field"><input type="checkbox" checked={confirmed} disabled={!unchangedBackup||busy}
     onChange={event=>setConfirmed(event.target.checked)}/>我已核對最新備份 JSON 可在本機找到</label>
  <div className="action-row">
   <button type="button" className="primary-button" onClick={()=>void write()} disabled={!writeable}>3. 逐筆明確上傳／更新合成 SourceRecord</button>
   <button type="button" className="secondary-button" onClick={()=>selected&&void read(selected).then(res=>setNotice(res?"已讀取最新雲端版本 v"+res.revision+"；未覆寫本機。":"遠端不存在。"))}
     disabled={!selected||busy}>讀取雲端最新版本</button>
  </div>
  <div className="action-row">
   <button type="button" className="secondary-button" onClick={()=>void approve("/review","雲端人工 Review")}
     disabled={!cloud||busy||conflict||cloud.approvals.reviewed}>Review</button>
   <button type="button" className="secondary-button" onClick={()=>void approve("/approve-daily","Daily Approval")}
     disabled={!cloud||busy||conflict||!cloud.approvals.reviewed||cloud.approvals.daily}>批准 Daily</button>
   <button type="button" className="secondary-button" onClick={()=>void approve("/approve-reuse","Library Approval")}
     disabled={!cloud||busy||conflict||!cloud.approvals.reviewed||cloud.approvals.reuse}>批准 Library</button>
  </div>
  <p>雲端審核：{cloud?.approvals.reviewed?"已 Review":"未 Review"}；
    Daily：{cloud?.approvals.daily?"已批准":"未批准"}；
    Library：{cloud?.approvals.reuse?"已批准":"未批准"}。</p>
  {cloud&&(!mapped||conflict||ack===null)?<div className="radar-review-essentials">
   <strong>人工衝突／恢復決策</strong>
   <p>雲端 v{cloud.revision}；本機上次確認 v{ack??"無"}。不採用 last-write-wins。</p>
   <button type="button" className="secondary-button" onClick={()=>setNotice("保留本機，不會覆寫雲端。")}>保留本機草稿</button>
   <button type="button" className="secondary-button" onClick={stageRemote} disabled={busy||Boolean(materialId&&!confirmed)}>
    已備份：明確將遠端版本載入 React Source Inbox
   </button>
  </div>:null}
  {cloud?<details><summary>查看雲端資料版本／Evidence</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(cloud,null,2)}</pre></details>:null}
  <p role="status" className="field-hint" data-testid="synthetic-cloud-status">{notice}</p>
 </section>;
}
