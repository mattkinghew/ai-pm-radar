"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceRecord } from "@/lib/source-inbox";
import { sourceRecordFingerprint } from "@/lib/source-library";
import {
  newCloudBinding, prepareWorkbenchSource, validCloudBinding,
  type CloudSyncBinding,
} from "@/lib/cloud-workbench-sync";
import { readCloudBinding, storeCloudBinding } from "@/lib/cloud-sync-local-store";

const PREVIEW_URL = "https://radar-phase11-preview-locked.lamms280.workers.dev/cloud-sync/";

type Preparation = Awaited<ReturnType<typeof prepareWorkbenchSource>>;
type PanelProps = {
  materialId: string | null;
  record: SourceRecord;
  localSaved: boolean;
  onBackup: () => Promise<void>;
};

export function CloudSyncOptInPanel({materialId,record,localSaved,onBackup}:PanelProps) {
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

  useEffect(()=>{
    let cancelled=false;
    setBinding(null);setPreparation(null);setBackupConfirmed(false);setPendingRestore(null);
    setBackupDownloaded(false);setBackupSnapshotFingerprint(null);setNotice("");
    if(!materialId)return;
    setLoading(true);
    void readCloudBinding(materialId).then((result)=>{
      if(!cancelled)setBinding(result);
    }).catch(()=>{
      if(!cancelled)setNotice("本機同步識別讀取失敗；請先備份及檢查 IndexedDB，不要嘗試同步。");
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

  const backup = useCallback(async()=>{
    if(!localSaved){setNotice("請等待工作台本機儲存完成後再備份。");return}
    setBusy(true);setBackupConfirmed(false);setBackupDownloaded(false);
    try {
      await onBackup();
      setBackupSnapshotFingerprint(sourceRecordFingerprint(record));
      setBackupDownloaded(true);
      setNotice("已要求下載工作台完整 JSON 備份。請確認檔案已在本機保存，才勾選核對。");
    } catch {
      setNotice("備份失敗；Cloud ID 不會建立。請先排查本機儲存。");
    } finally {setBusy(false)}
  },[localSaved,onBackup,record]);

  const prepare = async()=>{
    if(!materialId||!backupConfirmed||!backupIsCurrent||!localSaved||busy||loading||binding)return;
    if(!globalThis.crypto?.randomUUID){
      setNotice("此瀏覽器沒有安全隨機 UUID；無法產生 Cloud ID。");return;
    }
    setBusy(true);
    try {
      const entry=newCloudBinding(materialId,"src_"+crypto.randomUUID().replaceAll("-",""));
      await storeCloudBinding(entry);
      setBinding(entry);
      setNotice("Cloud ID 只保存在本機；未連線、未上傳文章，也未複製 Approval。");
    } catch {
      setNotice("建立本機 Cloud ID 失敗；請確認 IndexedDB 可用。");
    } finally {setBusy(false)}
  };

  const inspectRestore = async(file:File)=>{
    setPendingRestore(null);
    if(file.size>65_536){setNotice("Cloud ID 對應表超過 64 KiB，拒絕讀取。");return}
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
      setNotice("對應表格式有效、Material ID 相同。請再次確認 Cloud ID 後，手動匯入本機 IndexedDB。");
    }catch {
      setNotice("對應表無效、Material ID 不一致或已存在不同 Cloud ID；未修改任何資料。");
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
        setNotice("既有 Cloud ID 已符合對應表；沒有覆寫。");
      }else{
        // Insert-only transaction prevents overwriting another tab's ID.
        await storeCloudBinding(pendingRestore);
        setBinding(pendingRestore);
        setNotice("只恢復本機 Cloud ID 對應表；文章、審核和批准未上傳。");
      }
      setPendingRestore(null);
    }catch{
      setNotice("Cloud ID 恢復失敗或與另一分頁衝突；未覆寫既有資料。");
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
      setNotice("只下載本機 Cloud ID 對應表；無文章正文、無 Access Token、無雲端上傳。");
    }catch{setNotice("無法核對本機 Cloud ID，停止匯出。")}
  };

  return <details className="workbench-details advanced-tools" data-testid="cloud-optin-panel">
    <summary>☁ 跨裝置同步 · Phase 1.2C（本機準備／預設停用）</summary>
    <div className="workbench-section stack-md">
      <p className="field-hint"><strong>目前仍以本機 IndexedDB 為準。</strong> 現有 Cloudflare Preview 只接受合成資料，
        不能把這篇真實文章傳入雲端。此處只建立本機、逐篇的同步識別與資料檢查；不會呼叫任何遠端 API。</p>
      <div className="status-row">
        <span>本機草稿：{localSaved?"已儲存":"請先儲存"}</span>
        <span>Cloud ID：{binding?"已在本機預留":"未建立"}</span>
        <span>雲端：未連接／不會自動同步</span>
      </div>
      {!materialId?<p role="status">請先在來源工作台建立或選擇一篇文章。</p>:null}
      {materialId && !binding?<div className="stack-sm">
        <p className="field-hint">請先下載完整工作台備份、確認檔案存在，再建立此素材的固定 Cloud ID。這不會標記文章已 Review 或 Approved。</p>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void backup()} disabled={!localSaved||busy||loading}>1. 儲存並下載本機工作台備份</button>
        </div>
        <label><input type="checkbox" checked={backupConfirmed} onChange={e=>setBackupConfirmed(e.target.checked)}
          disabled={busy||loading||!backupIsCurrent}/> 我已自行核對備份 JSON 可在本機找到</label>
        {backupDownloaded && !backupIsCurrent ? <p role="status" className="field-hint">來源內容已變動，請重新下載最新備份才能建立 Cloud ID。</p> : null}
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void prepare()}
            disabled={!backupConfirmed||!backupIsCurrent||!localSaved||busy||loading}>2. 為此篇建立本機 Cloud ID</button>
        </div>
        <div className="radar-review-essentials">
          <p><strong>從另一裝置的備份恢復 Cloud ID（選填）</strong></p>
          <p className="field-hint">先匯入該裝置的 Source Inbox 工作台備份，再選取同一篇素材及 Cloud ID 對應表。只讀本機檔案、不會覆寫現有識別。</p>
          <label>選擇 Cloud ID 對應表 JSON
            <input type="file" accept=".json,application/json" onChange={event=>{
              const file=event.currentTarget.files?.[0];
              if(file)void inspectRestore(file);
              event.currentTarget.value="";
            }} disabled={busy||loading}/>
          </label>
          {pendingRestore?<div>
            <p className="field-hint">候選 Cloud ID：<code>{pendingRestore.cloud_source_id}</code></p>
            <p className="field-hint">上次已知雲端 Revision：{pendingRestore.last_remote_revision ?? "尚未同步"}</p>
            <button type="button" className="secondary-button" disabled={busy||loading}
              onClick={()=>void restore()}>確認恢復本機 Cloud ID</button>
            <button type="button" className="secondary-button" onClick={()=>setPendingRestore(null)}>取消恢復</button>
          </div>:null}
        </div>
      </div>:null}
      {binding?<div className="stack-sm">
        <p className="field-hint">此篇已擁有穩定的本機映射識別，往後修改摘要不會產生另一個 Cloud ID。</p>
        <p className="field-hint">Cloud ID：<code>{binding.cloud_source_id}</code></p>
        {preparation?<div className="radar-review-essentials">
          <p>完整 SourceRecord v2：{preparation.blockers.length?"需要補正":"結構預檢通過（不等於事實已獲核實）"}</p>
          <p>候選大小：{preparation.approx_bytes.toLocaleString()} bytes</p>
          <p>Fingerprint：<code>{preparation.fingerprint.slice(0,16)}…</code></p>
          {preparation.blockers.length?<ul>{preparation.blockers.slice(0,8).map((reason,i)=><li key={i}>{reason}</li>)}</ul>:null}
          <p className="field-hint">舊工作台的 Review／Approval 不會被移轉；未來雲端首次建檔必須重新人工審核。</p>
        </div>:null}
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={()=>void downloadMetadata()}>下載 Cloud ID 對應表（不含文章）</button>
        </div>
      </div>:null}
      <p className="field-hint">要體驗已驗證的雲端 Review／Approval，可在另一分頁開啟
        {" "}<a href={PREVIEW_URL} target="_blank" rel="noopener noreferrer">受保護的合成資料測試版</a>。
        與正式來源工作台之間尚未建立跨域認證橋接。</p>
      <p className="field-hint"><strong>下一關卡：</strong>完成同源身分驗證／最小權限的安全 Gateway、逐篇比對與 409 選擇、備份還原測試，
        再另行取得你的真實資料雲端上傳授權。</p>
      {notice?<p role="status" className="workbench-notice">{notice}</p>:null}
    </div>
  </details>;
}
