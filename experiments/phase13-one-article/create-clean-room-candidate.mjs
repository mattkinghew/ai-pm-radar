import {writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {normaliseSourceInput,validateSourceRecord} from "../../lib/source-inbox.ts";
import {getReusableSourceBlockers,sourceRecordFingerprint} from "../../lib/source-library.ts";

// Original clean-room article authored for THIS pilot, without copying private
// documents, customer records, personal data or third-party webpage text.
const content = [
  "AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度",
  "研究資料若只有 AI 生成摘要，讀者很難知道結論是否與來源一致。來源紀錄應保存原始文字、來源時間、關鍵主張和對應的逐字證據。",
  "在來源記錄中，每一個需要驗證的關鍵主張，都應連結至可在原始文字找到的證據。若找不到對應內容，就應標示待核對，而不應視為已證實。",
  "人工審核和發布批准是兩個不同決策。人工審核代表有人檢查證據；發布批准則表示該版本獲准供指定用途使用。若文章內容改動，原有批准不應自動延續。",
  "在兩部裝置協作時，版本號可以阻止舊裝置覆蓋較新的編輯。遇到衝突，使用者應保留本機備份，再決定採用雲端版本或手動合併。",
  "這篇文章是為 AI PM Radar 雲端遷移試點新寫的公開示範內容，不涉及真實客戶、業務成效、機密資料或個人資料。"
].join("\n\n");
const id="src_"+createHash("sha256").update("radar-phase13-clean-room-article-v1").digest("hex").slice(0,32);
const at="2026-10-15T00:00:00.000Z";
const {record:base}=normaliseSourceInput({
  value:content,kind:"paste_text",title:"AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度",
  creator:"AI-assisted clean-room pilot",language:"zh-Hant",capturedAt:at,
},{now:at});
const evidence=[
 "在來源記錄中，每一個需要驗證的關鍵主張，都應連結至可在原始文字找到的證據。",
 "人工審核和發布批准是兩個不同決策。",
 "在兩部裝置協作時，版本號可以阻止舊裝置覆蓋較新的編輯。"
].map(text_reference=>({source:"owner-authored-clean-room",timestamp:null,text_reference}));
const record={
 ...base,id,
 description:"2026-10-15 AI PM Radar 雲端資料治理之原創教學文章（AI 輔助撰寫）；尚未對外發佈",
 summary:"以來源證據、獨立人工審核及版本衝突控制，示範 AI 研究工作流的資料治理。",
 key_points:["保存來源及逐字引用證據","人工 Review 與 Approval 必須分離","編輯後須重新核准，跨裝置衝突不得自動覆寫"],
 key_claims:[
  {claim:"關鍵主張應連結可在原文找到的證據",evidence:[evidence[0]]},
  {claim:"人工審核與發布批准是不同決策",evidence:[evidence[1]]},
  {claim:"版本號可阻止舊裝置覆寫新資料",evidence:[evidence[2]]},
 ],
 evidence,
 evidence_grade:"B",confidence:0.8,
 why_it_matters:"來源證據與批准版本分離有助檢查生成內容是否忠於原始材料。",
 business_implication:"本文沒有量化或驗證的成本、收入或業務回報。",
 ai_pm_implication:"以最小可驗證流程測試審核、批准失效及 Revision CAS。",
 uncertainties:["本篇為教學性自撰內容，沒有實際業務研究或市場數據"],
 rights_note:"AI-assisted clean-room original drafted specifically for this pilot; Owner must review and confirm cloud-storage rights before genuine upload. No private source reused.",
 review_status:"needs_review",approval_status:"not_approved",
};
const issues=validateSourceRecord(record);
if(issues.length)throw Error("Invalid fixture structure "+JSON.stringify(issues));
if(record.evidence.some(e=>!content.includes(e.text_reference)))throw Error("Unmatched verbatim evidence");
const serialized=JSON.stringify(record,null,2)+"\n";
const filepath="experiments/phase13-one-article/fixtures/clean-room-public-article.json";
writeFileSync(filepath,serialized,{mode:0o600});
console.log("PUBLIC_CLEAN_ROOM_ARTICLE_READY",JSON.stringify({
 id:record.id,bytes:Buffer.byteLength(serialized),claims:record.key_claims.length,
 evidence:record.evidence.length,sha256:createHash("sha256").update(serialized).digest("hex"),
 schema:record.record_version,legacy_approval_reset:record.approval_status==="not_approved",
 usable_for_live_cloud:false,
}));
