"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {PHASE14_PINNED_CLOUD_ID,reconcileLocalWithPinnedCloud} from "@/lib/pilot-source-reconciliation";
import type {SourceRecord} from "@/lib/source-inbox";
import {PILOT_ALLOWED_ALTERNATE_SUMMARY,proposeControlledSummaryUpdate}
 from "@/lib/pilot-controlled-update";

type CloudView={record:SourceRecord;revision:number;content_sha256:string;purge_due_at:string};
type Capabilities={
  pilot_version:number;access_required:boolean;isolated_database:boolean;owner_scoped:boolean;
  pinned_article_id:string;pinned_article_sha256:string;
  pinned_update_sha256:string;
  real_upload_enabled:boolean;max_retention_days:number;
  cloud_write_enabled?:boolean;controlled_update_preflight_only?:boolean;
  controlled_commit_enabled?:boolean;
};
type MultiSourceCapability={
 version:number;source_record_version:number;enabled:boolean;real_sources_allowed:boolean;
 synthetic_only:boolean;access_required:boolean;owner_scoped:boolean;
 max_articles:number;max_revisions:number;max_retention_days:number;
 backups_before_overwrite:boolean;human_review_required:boolean;
};
type Props={
 record:SourceRecord;materialId:string|null;localSaved:boolean;
 onLoad:(record:SourceRecord)=>void;onBackup:()=>Promise<void>;onApplyDemoSummary:()=>void;
};
async function digest(record:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(record));
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function cloudFetch(path:string){
 if(!path.startsWith("/api/pilot/"))throw Error("非同源試點 API");
 const response=await fetch(path,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"manual",
   headers:{"accept":"application/json"}});
 if(!response.headers.get("content-type")?.includes("application/json"))
   throw Error("Cloudflare Access 登入失效或 API 非 JSON");
 return {status:response.status,data:await response.json() as Record<string,unknown>};
}
export function OneArticleCloudWorkspacePanel({record,materialId,localSaved,onLoad,onBackup,onApplyDemoSummary}:Props){
 const [cap,setCap]=useState<Capabilities|null>(null);
 const [multiSync,setMultiSync]=useState<MultiSourceCapability|null>(null);
 const [multiSyncMessage,setMultiSyncMessage]=useState("正在確認 Phase 1.5A 的 Cloudflare Access 同步能力…");
 const [cloud,setCloud]=useState<CloudView|null>(null);
 const [status,setStatus]=useState("正在確認 Access、Owner 權限、單篇來源及雲端唯讀限制…");
 const [busy,setBusy]=useState(false);
 const [downloaded,setDownloaded]=useState(false);
 const [confirmedHash,setConfirmedHash]=useState("");
 const [localBackupFingerprint,setLocalBackupFingerprint]=useState("");
 const [localBackupReady,setLocalBackupReady]=useState(false);
 const [candidateBackupVerified,setCandidateBackupVerified]=useState(false);
 const [preflight,setPreflight]=useState<{
  proposed_sha256:string;base_revision:number;persisted:false;touched_fields:string[]
 }|null>(null);
 const localSignature=useMemo(()=>JSON.stringify({
  materialId,raw_text:record.raw_text,title:record.title,summary:record.summary,
  evidence:record.evidence,key_claims:record.key_claims,
  key_points:record.key_points,analysis:record.analysis,
 }),[record,materialId]);
 const projection=useMemo(()=>cloud?reconcileLocalWithPinnedCloud(
  materialId?record:null,materialId,cloud.record):null,[cloud,record,materialId]);
 const needsBackup=Boolean(materialId);
 const localBackupCurrent=localBackupReady&&localBackupFingerprint===localSignature;
 const canStage=Boolean(cloud&&!busy&&(!needsBackup||localBackupCurrent)&&(!needsBackup||localSaved));
 const ready=Boolean(cap&&cloud);
 const canPropose=Boolean(cloud && cap?.controlled_update_preflight_only===true
   && cap.cloud_write_enabled===false
   && cloud.revision===1 && cloud.content_sha256===cap.pinned_article_sha256
   && materialId===PHASE14_PINNED_CLOUD_ID
   && record.raw_text===cloud.record.raw_text
   && record.title===cloud.record.title
   && record.summary===PILOT_ALLOWED_ALTERNATE_SUMMARY
   && localSaved && !busy && localBackupCurrent
   && confirmedHash===cloud.content_sha256);

 const getCloud=useCallback(async()=>{
  const c=await cloudFetch("/api/pilot/capabilities");
  const raw=c.data as unknown as Capabilities;
  if(c.status!==200||raw.pilot_version!==1||raw.access_required!==true
    ||raw.isolated_database!==true||raw.owner_scoped!==true
    ||raw.pinned_article_id!==PHASE14_PINNED_CLOUD_ID
    ||raw.real_upload_enabled!==false||raw.max_retention_days!==7
    ||raw.cloud_write_enabled!==false
    ||!/^([a-f0-9]{64})$/.test(raw.pinned_update_sha256??""))
    throw Error("安全能力檢查失敗；頁面已鎖定");
  const r=await cloudFetch("/api/pilot/record");
  if(r.status===404)throw Error("雲端文章不存在，暫停本輪同步");
  if(r.status===410)throw Error("文章已到期，不可再讀取");
  if(r.status!==200)throw Error("雲端讀取 HTTP "+r.status);
  const item=r.data as unknown as CloudView;
  if(!item.record||item.record.id!==PHASE14_PINNED_CLOUD_ID
    ||!Number.isSafeInteger(item.revision)||item.revision<1
    ||item.record.record_version!==2
    ||item.content_sha256!==await digest(item.record)
    ||(item.revision===1&&item.content_sha256!==raw.pinned_article_sha256)
    ||(item.revision===2&&item.content_sha256!==raw.pinned_update_sha256)
    ||item.revision>2)
    throw Error("雲端資料指紋、Revision 或 SourceRecord 不一致");
  if(Date.parse(item.purge_due_at)<=Date.now())
    throw Error("已超過有效保留期");
  const all=[...item.record.evidence,...item.record.key_claims.flatMap(k=>k.evidence)];
  if(!all.length||!all.every(e=>e.text_reference && item.record.raw_text.includes(e.text_reference)))
    throw Error("雲端 Evidence 無法逐字核對");
  setCap(raw);setCloud(item);setStatus("雲端完整性 PASS。Revision "+item.revision+"、逐字 Evidence "+all.length+
    " 處；沒有修改任何雲端資料。");
  return item;
 },[]);
 useEffect(()=>{
  let active=true;
  void getCloud().catch(error=>{if(active){setCap(null);setCloud(null);setStatus("BLOCKED："+(error as Error).message)}});
  return()=>{active=false};
 },[getCloud]);
 useEffect(()=>{
  let active=true;
  const check=async()=>{
   const response=await fetch("/api/source-sync/v1/capabilities",{
    method:"GET",credentials:"same-origin",cache:"no-store",
    redirect:"manual",headers:{accept:"application/json"}
   });
   if(response.status!==200||!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Phase 1.5A 能力檢查被拒絕");
   const c=await response.json() as MultiSourceCapability;
   if(c.version!==1||c.source_record_version!==2||c.access_required!==true
     ||c.owner_scoped!==true||c.real_sources_allowed!==false
     ||c.synthetic_only!==true||typeof c.enabled!=="boolean"
     ||c.backups_before_overwrite!==true||c.human_review_required!==true
     ||c.max_articles!==5||c.max_retention_days!==7)throw Error("同步能力未符合安全配置，禁止使用");
   if(active){setMultiSync(c);setMultiSyncMessage(c.enabled
    ? "PASS：獨立合成資料庫已啟用跨裝置試點；真實 SourceRecord 同步仍保持 OFF。"
    : "PASS：多文章合約已安裝；目前僅可查詢能力，雲端實際同步保持 OFF。");}
  };
  void check().catch(error=>{if(active){setMultiSync(null);setMultiSyncMessage("BLOCKED："+(error as Error).message)}});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  setLocalBackupReady(false);setPreflight(null);setCandidateBackupVerified(false);
 },[localSignature]);
 const recheck=async()=>{
  setBusy(true);setPreflight(null);setCandidateBackupVerified(false);
  try{await getCloud()}catch(e){setCloud(null);setStatus("BLOCKED："+(e as Error).message)}
  finally{setBusy(false)}
 };
 const downloadCloud=()=>{
  if(!cloud)return;
  const json=JSON.stringify(cloud.record,null,2)+"\n";
  const href=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  const a=document.createElement("a");a.href=href;a.download="radar-phase14-cloud-revision-"+cloud.revision+".json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
  setDownloaded(true);setConfirmedHash("");
  setStatus("已下載受保護 D1 的完整 SourceRecord。請重新選擇該 JSON，驗證 SHA-256。");
 };
 const verifyDownloadedCloud=async(file:File|null)=>{
  if(!file||!cloud||file.size>100_000)return;
  try{
   const parsed=JSON.parse(await file.text()) as SourceRecord;
   const actual=await digest(parsed);
   if(actual!==cloud.content_sha256||parsed.id!==PHASE14_PINNED_CLOUD_ID)
     throw Error("雲端備份 SHA-256／來源 ID 不符");
   setConfirmedHash(actual);
   setStatus("雲端完整 JSON 已下載並讀回：SHA-256 PASS。");
  }catch(e){setConfirmedHash("");setStatus("BLOCKED："+(e as Error).message)}
 };
 const backupLocal=async()=>{
  if(!needsBackup||busy||!localSaved)return;
  setBusy(true);setLocalBackupReady(false);
  try{
   await onBackup();
   setLocalBackupFingerprint(localSignature);
   setStatus("已下載真正 React Source Inbox 工作台備份；須重新匯入該 JSON 以核對。");
  }catch{setLocalBackupFingerprint("");setStatus("本機草稿備份失敗，禁止覆蓋。")}
  finally{setBusy(false)}
 };
 const verifyLocalBackup=async(file:File|null)=>{
  if(!file||!materialId||file.size>1_000_000||localBackupFingerprint!==localSignature)return;
  try{
   const raw=JSON.parse(await file.text()) as {version:number;items:Array<{
    activeMaterialId:string;form:{body:string;sourceTitle:string;summary:string}
   }>};
   const item=raw.items?.[0];
   if(raw.version!==1||!item||item.activeMaterialId!==materialId
     ||item.form?.body!==record.raw_text||item.form?.summary!==(record.summary??"")
     ||item.form?.sourceTitle!==(record.title??""))
     throw Error("與現時已儲存的本機草稿不相同");
   setLocalBackupReady(true);
   setStatus("真正 Source Inbox 工作台 JSON 已讀回：本機草稿核對 PASS。可人工採用雲端版本。");
  }catch(e){setLocalBackupReady(false);setStatus("BLOCKED："+(e as Error).message)}
 };
 const stageCloud=async()=>{
  if(!canStage||!cloud)return;
  setBusy(true);
  try{
   const remote=await getCloud();
   if(remote.revision!==cloud.revision||remote.content_sha256!==cloud.content_sha256){
    setStatus("409：雲端來源版本已變更。未修改本機，請重新核對及備份。");
    setLocalBackupReady(false);return;
   }
   onLoad(structuredClone(remote.record));
   setLocalBackupReady(false);
   setStatus("已明確將雲端 Revision "+remote.revision+
    " 的資料載入獨立 React 工作台，本機草稿仍需保存。未繼承雲端／本機 Approval，亦沒有任何雲端寫入。");
  }catch(e){setStatus("BLOCKED："+(e as Error).message)}
  finally{setBusy(false)}
 };
 const prepareUpdate=async()=>{
  if(!canPropose||!cloud||!cap)return;
  setBusy(true);setPreflight(null);
  try{
   const remote=await getCloud();
   if(remote.revision!==cloud.revision || remote.content_sha256!==cloud.content_sha256)
    throw Error("409：雲端版本已變更，請重新備份及人工核對");
   const plan=proposeControlledSummaryUpdate(remote.record,materialId,record.summary??"");
   if(!plan.ready||!plan.record)throw Error("修訂摘要不在已批准的合成測試範圍");
   const computed=await digest(plan.record);
   // The server receives ONLY the fixed allowlisted summary and CAS metadata.
   // No Workbench backup, raw source text, provider data or unsaved fields.
   const response=await fetch("/api/pilot/update-preflight",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"manual",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({
     expectedRevision:remote.revision,
     expectedSha256:remote.content_sha256,
     summary:PILOT_ALLOWED_ALTERNATE_SUMMARY,
    }),
   });
   if(!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Access 驗證失效或預檢回應異常");
   const data=await response.json() as Record<string,unknown>;
   if(response.status===409)throw Error("409：另一裝置已更新雲端，禁止直接覆寫");
   if(response.status!==200||data.ready!==true||data.persisted!==false
      ||data.cloud_write_enabled!==false
      ||data.proposed_sha256!==computed || data.base_revision!==remote.revision
      ||!Array.isArray(data.touched_fields)
      ||data.touched_fields.join(",")!=="summary"
      ||data.purge_due_at!==remote.purge_due_at)
    throw Error("雲端預檢未通過／指紋或過期時間不符");
   setCandidateBackupVerified(false);
   setPreflight({
    proposed_sha256:computed,base_revision:remote.revision,
    persisted:false,touched_fields:["summary"],
   });
   setStatus("Phase 1.4B 更新預檢 PASS：只會修改指定摘要（如將來另行批准寫入）；伺服器沒有寫入、Revision 保持 "
     +remote.revision+"，到期日沒有延長。");
  }catch(e){setPreflight(null);setStatus("BLOCKED："+(e as Error).message)}
  finally{setBusy(false)}
 };
 const downloadCandidate=async()=>{
  if(!preflight||!cloud)return;
  const proposed=proposeControlledSummaryUpdate(cloud.record,materialId,PILOT_ALLOWED_ALTERNATE_SUMMARY);
  if(!proposed.ready||!proposed.record ||
    await digest(proposed.record)!==preflight.proposed_sha256){
    setStatus("BLOCKED：候選文章的指紋不符；沒有產生備份。");return;
  }
  const blob=new Blob([JSON.stringify(proposed.record,null,2)+"\n"],{type:"application/json"});
  const href=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=href;a.download="radar-phase14c-controlled-candidate-revision2-NOT-COMMITTED.json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
  setCandidateBackupVerified(false);
  setStatus("已下載尚未提交的完整 SourceRecord v2 候選備份；請重新選擇核對。");
 };
 const verifyCandidate=async(file:File|null)=>{
  if(!file||file.size>100_000||!preflight||!cloud)return;
  try{
   const candidate=JSON.parse(await file.text()) as SourceRecord;
   const hash=await digest(candidate);
   const proposal=proposeControlledSummaryUpdate(cloud.record,materialId,PILOT_ALLOWED_ALTERNATE_SUMMARY);
   if(!proposal.ready||!proposal.record||hash!==preflight.proposed_sha256
    ||JSON.stringify(candidate)!==JSON.stringify(proposal.record))
    throw Error("候選 JSON 指紋、原始欄位或 Summary 不符");
   setCandidateBackupVerified(true);
   setStatus("Phase 1.4C 候選完整 JSON 已核對 PASS；此檔案仍未提交到雲端。");
  }catch(e){setCandidateBackupVerified(false);setStatus("BLOCKED："+(e as Error).message)}
 };
 return <section className="workbench-section stack-md" data-testid="pilot-one-article-workspace">
  <h2>Phase 1.4A — One-article Source Inbox 對照工作台</h2>
  <p>保護原件、逐筆核對、下載及恢復。本頁只可使用已授權的 Clean-room 文章，並保留獨立本機 IndexedDB；<strong>雙向寫入、AI 分析及正式 Radar 的資料匯入全部停用。</strong></p>
  <p className="workbench-notice">雲端完整 SourceRecord 是參考原件；真正 React 表單僅為可編輯的本機工作副本。某些 Provenance、Provider／歷史批准欄位未完整映射，不能當作全欄位同步完成。</p>
  <dl className="metadata" style={{minWidth:0,maxWidth:"100%",display:"grid",gridTemplateColumns:"minmax(0,1fr)",overflowWrap:"anywhere",wordBreak:"break-word"}}>
   <dt>Cloud ID</dt><dd style={{margin:0,minWidth:0,overflowWrap:"anywhere"}} data-testid="pilot-cloud-id">{cap?.pinned_article_id??"待驗證"}</dd>
   <dt>Revision</dt><dd style={{margin:0,minWidth:0}} data-testid="pilot-cloud-revision">{cloud?.revision??"—"}</dd>
   <dt>完整指紋</dt><dd style={{margin:0,minWidth:0,overflowWrap:"anywhere"}}><code data-testid="pilot-cloud-hash" style={{overflowWrap:"anywhere"}}>{cloud?.content_sha256??"—"}</code></dd>
   <dt>到期（香港時間）</dt><dd style={{margin:0,minWidth:0}}>{cloud?new Date(cloud.purge_due_at).toLocaleString("zh-Hant",{timeZone:"Asia/Hong_Kong",hour12:false}):"—"}</dd>
   <dt>上傳能力</dt><dd style={{margin:0,minWidth:0}} data-testid="pilot-upload-off">OFF（伺服器及介面均禁止寫入）</dd>
  </dl>
  <div className="action-row">
   <button type="button" onClick={()=>void recheck()} disabled={busy}>重新取得雲端最新 Revision</button>
   <button type="button" onClick={downloadCloud} disabled={!ready||busy}>下載完整雲端原件 JSON</button>
  </div>
  <label>核對剛下載的雲端原件
   <input style={{display:"block",width:"100%",minWidth:0}} type="file" accept=".json,application/json" disabled={!downloaded||busy}
    onChange={e=>{const f=e.currentTarget.files?.[0]??null;e.currentTarget.value="";void verifyDownloadedCloud(f)}}/>
  </label>
  <p data-testid="pilot-cloud-backup-status">雲端原件備份：{confirmedHash===cloud?.content_sha256?"已重新讀回驗證":"尚未驗證"}</p>
  {projection?<div className="workbench-notice" data-testid="pilot-local-projection">
    <strong>本機與雲端欄位比較：</strong> {projection.status}；相同 {projection.unchanged_fields.length} 項、不同 {projection.changed_fields.length} 項。
    {projection.changed_fields.length?<p>有差異：{projection.changed_fields.join("、")}</p>:null}
    <p>未宣稱完整映射：{projection.ignored_cloud_fields.join("；")}。本機審批不能當作雲端審批。</p>
  </div>:null}
  {needsBackup?<div className="stack-sm">
    <p>本機已有來源卡。為防止覆寫資料，請先下載並重新讀取完整工作台 JSON。</p>
    <button type="button" onClick={()=>void backupLocal()} disabled={!localSaved||busy}>備份本機 Source Inbox 工作台</button>
    <label>重新選擇剛下載的 Source Inbox 工作台 JSON
      <input style={{display:"block",width:"100%",minWidth:0}} type="file" accept=".json,application/json"
        disabled={!localBackupFingerprint||busy} onChange={e=>{const f=e.currentTarget.files?.[0]??null;e.currentTarget.value="";void verifyLocalBackup(f)}}/>
    </label>
    <p data-testid="pilot-local-backup-status">{localBackupCurrent?"PASS：本機草稿備份已核對":"尚未核對本機草稿備份"}</p>
  </div>:null}
  <button type="button" className="primary-button" onClick={()=>void stageCloud()} disabled={!canStage} data-testid="pilot-stage-cloud">
    手動將雲端 SourceRecord 載入獨立 React 工作台（不回寫）
  </button>
  <div className="workbench-notice stack-sm" data-testid="phase15-sync-readiness">
   <h3>Phase 1.5A — 多文章雲端同步能力（安全預備）</h3>
   <p>現有 Revision 2 已經正式提交並通過驗收。下一步是不同文章各自授權、完整備份、Revision 409 衝突及來源級刪除。
   新的 Schema 與同步服務已在隔離合成資料測試；<strong>尚未遷移到此雲端資料庫，也沒有接收私人或其他真實文章。</strong></p>
   <dl className="metadata" style={{minWidth:0,maxWidth:"100%",overflowWrap:"anywhere"}}>
    <dt>多文章雲端寫入</dt><dd data-testid="phase15-sync-off">{multiSync?.enabled
     ? "合成測試 ON／真實資料 OFF（獨立 D1）"
     : "OFF（只讀能力查詢）"}</dd>
    <dt>已測試安全上限</dt><dd>{multiSync?String(multiSync.max_articles)+" 篇／每篇 "+multiSync.max_revisions+" 個版本":"待核對"}</dd>
    <dt>最長保留</dt><dd>{multiSync?String(multiSync.max_retention_days)+" 日；不得以更新延長":"待核對"}</dd>
    <dt>適用資料</dt><dd>只准合成資料驗證；正式同步須另行授權</dd>
   </dl>
   <p role="status" data-testid="phase15-sync-status">{multiSyncMessage}</p>
   {multiSync?.enabled?<p><a href="/multi-source-pilot/" data-testid="phase15b-link">
    開啟 Phase 1.5B 固定合成文章跨裝置試點（Mac／iPhone）
   </a></p>:null}
  </div>
  <div className="workbench-notice stack-sm" data-testid="phase15c-governance-entry">
   <h3>Phase 1.5C — Real-source Governance & Readiness</h3>
   <p>先在完全本機的治理審查頁核對 SourceRecord v2 的來源、Evidence、疑似敏感資料、權利聲明及完整 JSON 備份。
   不論治理審查結果是否 PASS，真實雲端同步仍未獲授權。</p>
   <p><a href="/real-source-readiness/" data-testid="phase15c-governance-link">
    開啟本機唯讀治理審查工作台（不會上傳文章內容）
   </a></p>
   <p><a href="/real-source-approval/" data-testid="phase15d-shadow-approval-link">
    Phase 1.5D — 開啟逐篇 Shadow Approval（離線、不可上傳）
   </a></p>
  </div>
  {(!cloud||cloud.revision===1)?<>
  <div className="workbench-notice stack-sm" data-testid="pilot-update-preflight">
   <h3>Phase 1.4B — 指定文章單欄更新預檢（不會寫入）</h3>
   <p>這個試點只能示範一項固定的 Clean-room 摘要修改。使用的是雲端原件作基底，保留所有原始正文、Evidence、Provenance 和審批狀態；
   目前不能提交其他文章或任意文字，亦不會自動發布。</p>
   <p><strong>示範摘要：</strong> {PILOT_ALLOWED_ALTERNATE_SUMMARY}</p>
   <button type="button" disabled={!ready||materialId!==PHASE14_PINNED_CLOUD_ID||busy}
    onClick={()=>{onApplyDemoSummary();setPreflight(null);}}
    data-testid="pilot-apply-demo-summary">
    將固定修訂摘要填入原有 Source Inbox 表單（僅本機）
   </button>
   <p>必須先重新驗證雲端原件下載，以及本機完整工作台備份，再開始預檢。伺服器只接收這句固定摘要及 Revision／SHA-256，不接收整份私人工作台。</p>
   <button type="button" disabled={!canPropose} onClick={()=>void prepareUpdate()}
     data-testid="pilot-update-dry-run">
     伺服器預檢摘要更新（不提交、不延長七日保留）
   </button>
   <p data-testid="pilot-update-status">{preflight
     ? "PASS：候選 Revision "+(preflight.base_revision+1)+"，僅 summary 欄位；雲端沒有修改（persisted=false）。"
     : "待預檢：請核對完整雲端備份及本機備份。"}</p>
   {preflight?<p data-testid="pilot-update-hash">候選 SHA-256：<code style={{overflowWrap:"anywhere"}}>{preflight.proposed_sha256}</code></p>:null}
   {preflight?<div className="stack-sm" data-testid="pilot-controlled-commit-stage">
    <h4>Phase 1.4C — 候選完整備份與正式提交權限</h4>
    <p>只容許原有文章固定的摘要修訂。候選 Revision 2 的其餘欄位均由雲端原件保留，任何修改都須另行審批。</p>
    <button type="button" onClick={()=>void downloadCandidate()} disabled={busy} data-testid="pilot-candidate-download">
      下載完整候選 Revision 2 JSON（尚未提交）
    </button>
    <label>重新選擇剛下載的候選 JSON 以核對
      <input style={{display:"block",width:"100%",minWidth:0}} type="file"
        accept=".json,application/json" disabled={busy} onChange={e=>{
         const f=e.currentTarget.files?.[0]??null;e.currentTarget.value="";void verifyCandidate(f);
        }}/>
    </label>
    <p data-testid="pilot-candidate-verification">{candidateBackupVerified?
      "PASS：候選內容、來源欄位、SHA-256 已讀回核對；雲端仍未寫入。":
      "候選完整備份尚未讀回驗證"}</p>
    <p data-testid="pilot-commit-disabled"><strong>正式提交功能：OFF。</strong> 
      此頁不提供提交動作。需再次獲 Owner 明確批准固定候選摘要後，才可啟動受控雲端寫入。</p>
   </div>:null}
  </div>
  </>:<div data-testid="pilot-revision2-accepted" className="workbench-notice">
   <strong>Revision 2 已提交。</strong> 不會重新顯示舊版 Rev1→Rev2 的提交預檢。
   如需保存現有雲端原件，請使用上方「下載完整雲端原件 JSON」並核對 SHA-256。
   下一輪多文章同步開關目前為 OFF。
  </div>}
  <p className="field-hint" role="status" data-testid="pilot-phase14-status">{status}</p>
 </section>;
}
