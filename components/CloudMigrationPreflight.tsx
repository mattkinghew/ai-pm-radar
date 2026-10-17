"use client";

import { useRef, useState } from "react";
import {
  inspectCloudMigrationBackups,
  MAX_MIGRATION_BACKUP_BYTES,
  type CloudMigrationManifest,
} from "@/lib/cloud-migration-preflight";

const reasons: Record<CloudMigrationManifest["decisions"][number]["code"], string> = {
  invalid_backup: "備份格式無法辨識；請重新匯出正確 JSON。",
  unsupported_version: "備份版本尚未支援；不可直接遷移。",
  invalid_item: "資料缺少必要內容或結構不完整，必須逐項核對。",
  duplicate_id: "發現重複 ID，不能自動合併。",
  global_approval_ambiguous: "舊版審批狀態只屬於整個工作台，不能推斷每篇文章已批准。",
  over_limit: "資料量超出目前 16MiB／1000 筆的保護限制。",
  library_ineligible: "Source Library 紀錄未通過現有 Evidence／Approval 驗證。",
  active_item_missing: "目前選中的素材沒有相應紀錄，需要手動修復。",
};

export function CloudMigrationPreflight() {
  const draftInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CloudMigrationManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scan = async () => {
    // Read DOM file inputs at the moment of the click: two rapid file changes
    // must not race React state updates and silently omit one backup.
    const draftFile = draftInputRef.current?.files?.[0] ?? null;
    const libraryFile = libraryInputRef.current?.files?.[0] ?? null;
    setError("");
    setResult(null);
    if (!draftFile && !libraryFile) {
      setError("請至少選擇一份已由 Radar 匯出的 JSON 備份。");
      return;
    }
    if ([draftFile, libraryFile].some((file) => file && file.size > MAX_MIGRATION_BACKUP_BYTES)) {
      setError("檔案超出 16MiB 上限；本頁不會讀取或上傳。");
      return;
    }
    setBusy(true);
    try {
      const [draftBackupJson, libraryBackupJson] = await Promise.all([
        draftFile?.text(),
        libraryFile?.text(),
      ]);
      const manifest = inspectCloudMigrationBackups({ draftBackupJson, libraryBackupJson });
      setResult(manifest);
    } catch {
      setError("無法在此瀏覽器讀取備份；原始檔案未被修改。");
    } finally {
      setBusy(false);
    }
  };

  const exportReport = () => {
    if (!result) return;
    const data = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "radar-cloud-migration-dryrun-manifest.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="container section stack-lg">
      <section className="workbench-intro">
        <p className="eyebrow">AI PM Radar v2.1 · Phase 1.2</p>
        <h1>雲端資料遷移預檢</h1>
        <p className="lead">只檢查你主動選擇的現有 JSON 備份，統計可重用來源、草稿及需要人工處理的阻塞。</p>
        <p className="workbench-notice">
          <strong>純本機 Dry Run：</strong>此頁不會連接雲端資料庫、不會呼叫 Gemini，也不會將備份內容上傳。
          分析結果只包括筆數及錯誤分類，不含文章正文、URL、作者或來源 ID。
        </p>
      </section>
      <section className="radar-review-essentials" aria-label="選擇備份">
        <h2>1. 選擇現有備份</h2>
        <p className="field-hint">可以只選一種。Source Inbox 草稿備份通常以 source-inbox-draft 開頭；Source Library 備份通常由研究資料庫匯出功能產生。</p>
        <label htmlFor="cloud-draft-file"><strong>Source Inbox 草稿 JSON（選填）</strong></label>
        <input id="cloud-draft-file" ref={draftInputRef} type="file" accept=".json,application/json"
          onChange={() => setResult(null)} />
        <label htmlFor="cloud-library-file"><strong>Source Library JSON（選填）</strong></label>
        <input id="cloud-library-file" ref={libraryInputRef} type="file" accept=".json,application/json"
          onChange={() => setResult(null)} />
        <div className="action-row">
          <button type="button" className="primary-button" onClick={() => void scan()} disabled={busy}>
            {busy ? "正在本機檢查…" : "2. 執行 Dry Run"}
          </button>
        </div>
        {error && <p className="blocked-message" role="alert">{error}</p>}
      </section>
      {result && (
        <section className="radar-reading-card" aria-label="遷移預檢結果">
          <p className="radar-reading-eyebrow">3. 只讀檢查結果</p>
          <h2>尚未授權雲端上傳</h2>
          <p className="radar-reading-disclaimer">這份清單不能直接執行遷移。下一步仍需備份校驗、逐筆審批狀態核對及人工批准。</p>
          <div className="radar-reading-group">
            <p>草稿工作台：<strong>{result.draft_workbenches}</strong></p>
            <p>素材總數：<strong>{result.total_materials}</strong></p>
            <p>結構可解析的草稿素材：<strong>{result.eligible_draft_materials}</strong></p>
            <p>通過現有 Library 驗證的來源：<strong>{result.reusable_library_entries}</strong></p>
            <p>需人工核對的資料／狀態數：<strong>{result.quarantined_entries}</strong></p>
          </div>
          <div className="radar-reading-group">
            <h3>阻塞及核對項目</h3>
            {result.decisions.length ? (
              <ul>{result.decisions.map((item, index) => (
                <li key={index}><strong>{item.count} 項</strong> — {reasons[item.code]}</li>
              ))}</ul>
            ) : <p>未發現已識別的結構問題；仍需正式資料備份與人工確認，才可進行雲端匯入。</p>}
          </div>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={exportReport}>下載不含正文的 Dry Run 報告</button>
          </div>
        </section>
      )}
    </main>
  );
}
