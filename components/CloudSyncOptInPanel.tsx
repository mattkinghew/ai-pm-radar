"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceRecord } from "@/lib/source-inbox";
import { useLanguage } from "@/components/LanguageProvider";
import { sourceRecordFingerprint } from "@/lib/source-library";
import {
  acknowledgeCloudSync, decideCloudSync, newCloudBinding, prepareWorkbenchSource, validCloudBinding,
  type CloudSyncBinding,
} from "@/lib/cloud-workbench-sync";
import { acknowledgeCloudBinding, readCloudBinding, storeCloudBinding } from "@/lib/cloud-sync-local-store";
import { planExplicitCloudWrite, requireCloudCapabilities, type CloudSyncCapabilities } from "@/lib/cloud-sync-capability-gate";

type Preparation = Awaited<ReturnType<typeof prepareWorkbenchSource>>;
type RemoteRecord = {
  source_id: string;
  revision: number;
  fingerprint: string;
  purge_due_at: string;
  record: SourceRecord;
};
type CloudReply = { status: number; data: Record<string, unknown> };

async function cloudRequest(path: string, method = "GET", body?: unknown): Promise<CloudReply> {
  if (!path.startsWith("/api/cloud/")) throw new Error("只允許使用目前網站的安全保存服務。");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json", ...(method === "GET" ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw new Error("保存服務逾時；本機草稿未受影響，可稍後重試。");
    throw new Error("無法連接保存服務；本機草稿未受影響。");
  } finally {
    window.clearTimeout(timeout);
  }
  if (response.status === 401) throw new Error("登入已逾期；請重新登入後再試。草稿仍保存在本機。");
  if (response.status >= 300 && response.status < 400) throw new Error("登入狀態需要更新；請重新登入後再檢查保存服務。");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (response.status === 403 && !contentType.includes("application/json")) {
    throw new Error("登入已逾期或此帳戶沒有保存權限；草稿仍保存在本機。");
  }
  if (!contentType.includes("application/json")) {
    throw new Error(response.status === 404
      ? "跨裝置保存服務尚未啟用；草稿仍保存在目前瀏覽器。"
      : "保存服務回應格式無法辨識；本機草稿未受影響。");
  }
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("保存服務回應無效；本機草稿未受影響。");
  return { status: response.status, data: value as Record<string, unknown> };
}

function parseRemoteRecord(data: Record<string, unknown>, expectedId: string): RemoteRecord {
  const record = data.record as SourceRecord | undefined;
  if (data.source_id !== expectedId || !Number.isSafeInteger(data.revision) || Number(data.revision) < 1
    || typeof data.fingerprint !== "string" || !/^[0-9a-f]{64}$/u.test(data.fingerprint)
    || typeof data.purge_due_at !== "string" || !Number.isFinite(Date.parse(data.purge_due_at))
    || !record || record.id !== expectedId || record.review_status !== "needs_review"
    || record.approval_status !== "not_approved") {
    throw new Error("雲端資料身份或核對狀態不符；沒有套用或覆寫本機草稿。");
  }
  return { source_id: expectedId, revision: Number(data.revision), fingerprint: data.fingerprint,
    purge_due_at: data.purge_due_at, record };
}

function cloudBlockerLabels(blockers: string[]) {
  return [...new Set(blockers.map((item) => {
    if (item === "source_text_missing") return "素材沒有正文或逐字稿。";
    if (item === "source_not_captured") return "素材尚未完成擷取。";
    if (item === "analysis_in_progress") return "AI 整理仍在進行，請完成或取消後再保存。";
    if (item === "evidence_missing") return "至少需要一條可在原文定位的證據。";
    if (item === "reviewed_claims_missing") return "尚未整理可核對的核心主張。";
    if (item === "source_too_large") return "素材超出雲端保存大小限制。";
    if (item.startsWith("SourceRecord invalid:")) return "來源欄位或證據格式需要修正。";
    return "來源資料完整性檢查未通過。";
  }))];
}
type PanelProps = {
  materialId: string | null;
  record: SourceRecord;
  localSaved: boolean;
  onBackup: () => Promise<void>;
};

export function CloudSyncOptInPanel({materialId,record,localSaved,onBackup}:PanelProps) {
  const { messages } = useLanguage();
  const [binding,setBinding]=useState<CloudSyncBinding|null>(null);
  const [preparation,setPreparation]=useState<Preparation|null>(null);
  const [busy,setBusy]=useState(false);
  const [pendingRestore,setPendingRestore]=useState<CloudSyncBinding|null>(null);
  const [backupConfirmed,setBackupConfirmed]=useState(false);
  const [backupSnapshotFingerprint,setBackupSnapshotFingerprint]=useState<string|null>(null);
  const [backupDownloaded,setBackupDownloaded]=useState(false);
  const backupIsCurrent=backupDownloaded && backupSnapshotFingerprint===sourceRecordFingerprint(record);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(false);
  const [capabilities,setCapabilities]=useState<CloudSyncCapabilities|null>(null);
  const [gatewayChecked,setGatewayChecked]=useState(false);
  const [remoteRecord,setRemoteRecord]=useState<RemoteRecord|null>(null);
  const [remoteChecked,setRemoteChecked]=useState(false);
  const [rightsConfirmed,setRightsConfirmed]=useState(false);
  const [retentionConfirmed,setRetentionConfirmed]=useState(false);
  const [residualConfirmed,setResidualConfirmed]=useState(false);
  const localFingerprint=sourceRecordFingerprint(record);

  useEffect(()=>{
    let cancelled=false;
    setBinding(null);setPreparation(null);setBackupConfirmed(false);setPendingRestore(null);
    setBackupDownloaded(false);setBackupSnapshotFingerprint(null);setNotice("");
    if(!materialId)return;
    setLoading(true);
    void readCloudBinding(materialId).then((result)=>{
      if(!cancelled)setBinding(result);
    }).catch(()=>{
      if(!cancelled)setNotice("無法讀取本機跨裝置識別；請先下載備份，不要繼續保存。");
    }).finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[materialId]);

  useEffect(()=>{
    let cancelled=false;
    if(!binding){setPreparation(null);return}
    void prepareWorkbenchSource(record,binding)
      .then((result)=>{if(!cancelled)setPreparation(result)})
      .catch(()=>{if(!cancelled){setPreparation(null);setNotice("來源資料驗證失敗；請保持本機操作，勿遷移。")}});
    return ()=>{cancelled=true};
  },[record,binding]);

  useEffect(()=>{
    if(!backupIsCurrent)setBackupConfirmed(false);
  },[backupIsCurrent]);

  useEffect(()=>{
    setRemoteRecord(null);setRemoteChecked(false);
    setBackupConfirmed(false);setBackupDownloaded(false);setBackupSnapshotFingerprint(null);
    setRightsConfirmed(false);setRetentionConfirmed(false);setResidualConfirmed(false);
  },[localFingerprint]);

  const checkGateway=async()=>{
    setBusy(true);setGatewayChecked(false);setCapabilities(null);setNotice("");
    try{
      const result=await cloudRequest("/api/cloud/capabilities");
      if(result.status!==200)throw new Error("目前無法確認跨裝置保存權限；草稿仍在本機。");
      const endpoint=new URL("/api/cloud/capabilities",window.location.origin).toString();
      let checked:CloudSyncCapabilities;
      try{checked=requireCloudCapabilities(window.location.origin,endpoint,result.data)}
      catch{throw new Error("跨裝置保存目前尚未開通；草稿仍只保存在本機。")}
      setCapabilities(checked);setGatewayChecked(true);
      setNotice("安全保存服務已就緒。只有你按下保存並確認後，這篇素材才會傳送；不會自動同步。");
    }catch(error){
      setNotice((error as Error).message||"無法連接跨裝置保存服務；草稿仍只保存在目前瀏覽器。");
    }finally{setBusy(false)}
  };

  const checkRemote=async()=>{
    if(!binding||!capabilities||busy)return;
    setBusy(true);setRemoteChecked(false);setRemoteRecord(null);
    try{
      const result=await cloudRequest(`/api/cloud/records/${binding.cloud_source_id}`);
      if(result.status===404){
        setRemoteChecked(true);
        setNotice("雲端尚未有這篇素材。確認本機備份與保存條件後，才可明確建立雲端副本。");
        return;
      }
      if(result.status!==200)throw new Error("雲端讀取未成功；本機草稿沒有變更。");
      const loaded=parseRemoteRecord(result.data,binding.cloud_source_id);
      setRemoteRecord(loaded);setRemoteChecked(true);
      setNotice(`已從安全服務讀取第 ${loaded.revision} 版。內容只顯示供核對，不會覆寫目前草稿。`);
    }catch(error){
      setNotice((error as Error).message||"雲端讀取失敗；本機草稿沒有變更。");
    }finally{setBusy(false)}
  };

  const saveCloud=async()=>{
    if(!materialId||!binding||!capabilities||!localSaved||!backupIsCurrent||!backupConfirmed
      ||!rightsConfirmed||!retentionConfirmed||!residualConfirmed||busy)return;
    setBusy(true);setRemoteChecked(false);
    try{
      const prepared=await prepareWorkbenchSource(record,binding);
      if(prepared.blockers.length){
        setNotice(`尚有 ${prepared.blockers.length} 項資料完整性問題，不能保存至雲端。請先在核對區補齊。`);return;
      }
      const latest=await cloudRequest(`/api/cloud/records/${binding.cloud_source_id}`);
      let remote:RemoteRecord|null=null;
      if(latest.status===200)remote=parseRemoteRecord(latest.data,binding.cloud_source_id);
      else if(latest.status!==404)throw new Error("保存前無法核對最新雲端版本；沒有發出寫入。");
      setRemoteRecord(remote);setRemoteChecked(true);
      if(remote&&binding.last_remote_revision===null&&remote.fingerprint===prepared.fingerprint){
        const recovered=acknowledgeCloudSync(binding,{source_id:remote.source_id,
          revision:remote.revision,fingerprint:remote.fingerprint},new Date().toISOString());
        await acknowledgeCloudBinding(binding,recovered);
        setBinding(recovered);
        setNotice("已讀回與本機完全相同的既有雲端副本，完成對應確認；沒有重複上傳。");return;
      }
      const decision=decideCloudSync({binding,localFingerprint:prepared.fingerprint,
        localBlockers:prepared.blockers,
        remote:remote?{source_id:remote.source_id,revision:remote.revision,fingerprint:remote.fingerprint}:null});
      if(decision.kind==="in_sync"){
        setNotice("本機內容與已確認的雲端版本一致，沒有重複保存。");return;
      }
      if(decision.kind!=="create_requires_consent"&&decision.kind!=="push_requires_consent"){
        setNotice("雲端版本或本機對應關係有變動；為避免覆蓋，已停止保存。請先備份並人工核對兩邊內容。");return;
      }
      const requestedAt=new Date().toISOString();
      const plan=await planExplicitCloudWrite({record:prepared.record,binding,
        localFingerprint:prepared.fingerprint,approxBytes:prepared.approx_bytes,decision,capabilities,
        consent:{granted:true,cloud_source_id:binding.cloud_source_id,local_fingerprint:prepared.fingerprint,
          verified_local_backup:true,rights_confirmed:true,seven_day_retention_accepted:true,
          time_travel_residual_accepted:true,requested_at:requestedAt},now:requestedAt});
      const response=await cloudRequest(plan.path,plan.method,plan.body);
      if(response.status===409)throw new Error("雲端版本剛有更新；沒有覆蓋。請重新讀取並核對。");
      if(response.status!==200&&response.status!==201)throw new Error("安全服務拒絕保存（"+String(response.data.code??response.status)+"）；本機草稿仍保留。");
      if(response.data.source_id!==binding.cloud_source_id||response.data.fingerprint!==prepared.fingerprint
        ||!Number.isSafeInteger(response.data.revision))throw new Error("保存確認與送出的草稿不一致；停止標示已保存。");
      const verifiedReply=await cloudRequest(`/api/cloud/records/${binding.cloud_source_id}`);
      if(verifiedReply.status!==200)throw new Error("保存後讀回未成功；請重新檢查，暫不標示雲端已保存。");
      const verified=parseRemoteRecord(verifiedReply.data,binding.cloud_source_id);
      if(verified.revision!==response.data.revision||verified.fingerprint!==prepared.fingerprint){
        throw new Error("伺服器讀回內容與本機草稿不一致；沒有套用遠端內容。");
      }
      const acknowledged=acknowledgeCloudSync(binding,{source_id:verified.source_id,
        revision:verified.revision,fingerprint:verified.fingerprint},new Date().toISOString());
      await acknowledgeCloudBinding(binding,acknowledged);
      setBinding(acknowledged);setRemoteRecord(verified);
      setNotice(`已保存並逐筆讀回確認（第 ${verified.revision} 版）。此雲端副本仍待人工審核；不代表已核實或批准。`);
    }catch(error){
      setNotice((error as Error).message||"雲端保存未完成；本機草稿已保留，可重新核對後再試。");
    }finally{setBusy(false)}
  };

  const backup = useCallback(async()=>{
    if(!localSaved){setNotice("請等待工作台本機儲存完成後再備份。");return}
    setBusy(true);setBackupConfirmed(false);setBackupDownloaded(false);
    try {
      await onBackup();
      setBackupSnapshotFingerprint(sourceRecordFingerprint(record));
      setBackupDownloaded(true);
      setNotice("已要求下載工作台完整 JSON 備份。請確認檔案已在本機保存，才勾選核對。");
    } catch {
      setNotice("備份失敗；尚未建立跨裝置識別。請先確認本機保存狀態。");
    } finally {setBusy(false)}
  },[localSaved,onBackup,record]);

  const prepare = async()=>{
    if(!materialId||!backupConfirmed||!backupIsCurrent||!localSaved||busy||loading||binding)return;
    if(!globalThis.crypto?.randomUUID){
      setNotice("此瀏覽器無法安全建立跨裝置識別；目前仍可本機使用。");return;
    }
    setBusy(true);
    try {
      const entry=newCloudBinding(materialId,"src_"+crypto.randomUUID().replaceAll("-",""));
      await storeCloudBinding(entry);
      setBinding(entry);
      setNotice("識別只保存在本機；文章沒有上傳，審核狀態沒有改變。");
    } catch {
      setNotice("建立跨裝置識別失敗；請確認本機保存功能可用。");
    } finally {setBusy(false)}
  };

  const inspectRestore = async(file:File)=>{
    setPendingRestore(null);
    if(file.size>65_536){setNotice("識別備份超過允許大小，無法讀取。");return}
    try {
      const parsed:unknown=JSON.parse(await file.text());
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("invalid");
      const data=parsed as Record<string,unknown>;
      if(data.format!=="radar-cloud-binding-v1"||data.version!==1
        ||!validCloudBinding(data.binding)
        ||data.binding.material_id!==materialId)throw Error("mismatch");
      if(binding && binding.cloud_source_id!==data.binding.cloud_source_id){
        throw Error("binding_collision");
      }
      setPendingRestore(data.binding);
      setNotice("識別備份與目前素材相符；確認後只恢復本機對應資料。");
    }catch {
      setNotice("識別備份不相符，或目前素材已有其他識別；沒有修改任何資料。");
    }
  };

  const restore = async()=>{
    if(!pendingRestore||!materialId||pendingRestore.material_id!==materialId||busy)return;
    setBusy(true);
    try{
      const existing=await readCloudBinding(materialId);
      if(existing){
        if(existing.cloud_source_id!==pendingRestore.cloud_source_id)throw Error("binding_collision");
        setBinding(existing);
        setNotice("既有跨裝置識別已相符，沒有覆寫。");
      }else{
        // Insert-only transaction prevents overwriting another tab's ID.
        await storeCloudBinding(pendingRestore);
        setBinding(pendingRestore);
        setNotice("只恢復本機識別；文章、審核和批准沒有上傳。");
      }
      setPendingRestore(null);
    }catch{
      setNotice("識別恢復失敗或與另一分頁衝突；沒有覆寫既有資料。");
    }finally{setBusy(false)}
  };

  const downloadMetadata = async()=>{
    if(!binding)return;
    // Read back from the durable IndexedDB store before exporting.
    try{
      const saved=await readCloudBinding(binding.material_id);
      if(!saved || saved.cloud_source_id!==binding.cloud_source_id)throw Error("binding changed");
      const file=new Blob([JSON.stringify({
        format:"radar-cloud-binding-v1",version:1,created_for:"local_only_restore",
        binding:saved,warning:"Does not contain source text or any cloud approval. This is not an upload authorization.",
      },null,2)],{type:"application/json"});
      const url=URL.createObjectURL(file);
      const anchor=document.createElement("a");
      anchor.download="radar-cloud-binding-metadata.json";
      anchor.href=url;anchor.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice("只下載跨裝置識別備份；不包含文章、登入資料或上傳授權。");
    }catch{setNotice("無法核對本機識別，停止下載。")}
  };

  return <details className="workbench-details advanced-tools" data-testid="cloud-optin-panel">
    <summary>☁ {messages.sourceInbox.cloudSyncSummary}</summary>
    <div className="workbench-section stack-md">
      <p className="field-hint"><strong>目前草稿先保存在這個瀏覽器。</strong> 跨裝置保存需要受保護的服務已啟用，
        而且必須由你逐篇確認備份、使用權及保存期限。檢查服務不會傳送文章內容；只有按下保存才會傳送這篇 SourceRecord。</p>
      <div className="status-row">
        <span>本機草稿：{localSaved?"已儲存":"請先儲存"}</span>
        <span>跨裝置識別：{binding?"已建立":"尚未建立"}</span>
        <span>跨裝置保存：{capabilities?"已就緒，等待你確認":"尚未連接"}</span>
      </div>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={()=>void checkGateway()} disabled={busy||loading}>
          檢查跨裝置保存服務
        </button>
      </div>
      {gatewayChecked&&capabilities?<p className="field-hint">服務要求登入、逐篇確認，且雲端草稿最多保存 7 日；過期後可能仍有備份保留期。</p>:null}
      {!materialId?<p role="status">請先在來源工作台建立或選擇一篇文章。</p>:null}
      {materialId && !binding?<div className="stack-sm">
        <p className="field-hint">建立跨裝置識別前，請先下載並核對本機備份。這不會上傳文章，也不會改變審核或批准狀態。</p>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void backup()} disabled={!localSaved||busy||loading}>下載本機工作台備份</button>
        </div>
        <label><input type="checkbox" checked={backupConfirmed} onChange={e=>setBackupConfirmed(e.target.checked)}
          disabled={busy||loading||!backupIsCurrent}/> 我已確認備份檔案存在</label>
        {backupDownloaded && !backupIsCurrent ? <p role="status" className="field-hint">來源內容已變動，請重新下載最新備份才能建立識別。</p> : null}
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void prepare()}
            disabled={!backupConfirmed||!backupIsCurrent||!localSaved||busy||loading}>建立跨裝置識別</button>
        </div>
        <div className="radar-review-essentials">
          <p><strong>在另一裝置恢復跨裝置識別（選填）</strong></p>
          <p className="field-hint">先匯入同一篇 Source Inbox 備份，再選擇識別備份。只更新本機對應資料，不會覆寫文章。</p>
          <label>選擇識別備份
            <input type="file" accept=".json,application/json" onChange={event=>{
              const file=event.currentTarget.files?.[0];
              if(file)void inspectRestore(file);
              event.currentTarget.value="";
            }} disabled={busy||loading}/>
          </label>
          {pendingRestore?<div>
            <p className="field-hint">識別備份與目前素材相符。確認後只恢復本機對應資料。</p>
            <button type="button" className="secondary-button" disabled={busy||loading}
              onClick={()=>void restore()}>確認恢復識別</button>
            <button type="button" className="secondary-button" onClick={()=>setPendingRestore(null)}>取消恢復</button>
          </div>:null}
        </div>
      </div>:null}
      {binding?<div className="stack-sm">
        <p className="field-hint">此篇使用固定識別；修改內容不會自動上傳。</p>
      {preparation?<div className="radar-review-essentials">
          <p>素材完整性：{preparation.blockers.length?"需補齊資料":"可進行保存檢查（不代表來源事實已獲核實）"}</p>
          {preparation.blockers.length?<ul>{cloudBlockerLabels(preparation.blockers).map((reason)=> <li key={reason}>{reason}</li>)}</ul>:null}
          <p className="field-hint">雲端副本會重新設為待審核、未批准；本機審核狀態不會移轉。</p>
        </div>:null}
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void checkRemote()} disabled={!gatewayChecked||busy||loading}>
            從雲端讀取這篇素材
          </button>
          <button type="button" className="secondary-button" onClick={()=>void backup()} disabled={!localSaved||busy||loading}>
            下載最新本機備份
          </button>
        </div>
        <label><input type="checkbox" checked={backupConfirmed} onChange={e=>setBackupConfirmed(e.target.checked)}
          disabled={busy||loading||!backupIsCurrent}/> 我已確認最新備份檔案存在</label>
        {backupDownloaded&&!backupIsCurrent?<p role="status" className="field-hint">內容已修改；請重新下載備份，再核對保存。</p>:null}
        {gatewayChecked?<div className="radar-review-essentials stack-sm">
          <p><strong>逐篇保存確認</strong></p>
          <p className="field-hint">按保存後，這篇 SourceRecord（包括正文、摘要、證據與人工筆記）會傳送至受保護的 Radar 雲端，最多保存 7 日。你可隨時保留本機副本；到期刪除後，服務備份仍可能暫時保留。</p>
          <label><input type="checkbox" checked={rightsConfirmed} onChange={e=>setRightsConfirmed(e.target.checked)} disabled={busy}/>
            我確認有權把這篇素材保存至此服務</label>
          <label><input type="checkbox" checked={retentionConfirmed} onChange={e=>setRetentionConfirmed(e.target.checked)} disabled={busy}/>
            我接受最多 7 日保存期限</label>
          <label><input type="checkbox" checked={residualConfirmed} onChange={e=>setResidualConfirmed(e.target.checked)} disabled={busy}/>
            我了解刪除／到期後，服務備份可能在保留期內仍存在</label>
          <button type="button" className="primary-button" onClick={()=>void saveCloud()}
            disabled={!localSaved||!preparation||preparation.blockers.length>0||!backupConfirmed||!backupIsCurrent||!rightsConfirmed||!retentionConfirmed||!residualConfirmed||busy}>
            確認保存並核對雲端讀回
          </button>
          <p className="field-hint">如果其他裝置已修改，系統會停止保存並保留兩邊內容，避免自動覆蓋。</p>
        </div>:null}
        {remoteChecked&&remoteRecord?<details className="workbench-details">
          <summary>查看已讀取的雲端素材</summary>
          <div className="stack-sm">
            <h3>{remoteRecord.record.title||"未命名素材"}</h3>
            <p>{remoteRecord.record.source_url||"來源網址未提供"}</p>
            <p>雲端副本：待審核、未批准 · {new Date(remoteRecord.purge_due_at).toLocaleDateString()}</p>
            {remoteRecord.record.summary?<p>{remoteRecord.record.summary}</p>:null}
            <details><summary>查看原文與證據</summary>
              <pre className="source-text-preview">{remoteRecord.record.raw_text||remoteRecord.record.transcript||"沒有保存正文"}</pre>
              <ul>{remoteRecord.record.evidence.map((item,index)=><li key={`${item.source}-${index}`}>{item.text_reference}</li>)}</ul>
            </details>
            <p className="field-hint">只讀核對，不會覆寫目前工作台素材或轉移審核批准。</p>
          </div>
        </details>:null}
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void downloadMetadata()}>下載跨裝置識別備份</button>
        </div>
      </div>:null}
      {!capabilities?<p className="field-hint">雲端服務未連接時，貼文、分析、審核及本機備份仍可使用；草稿不會自動同步到其他裝置。</p>:null}
      {notice?<p role="status" className="workbench-notice">{notice}</p>:null}
    </div>
  </details>;
}
