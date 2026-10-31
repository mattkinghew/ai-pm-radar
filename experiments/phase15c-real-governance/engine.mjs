/**
 * Phase 1.5C deterministic, offline and fail-closed SOURCE READINESS CHECK.
 * This NEVER provides upload authorization. No cloud/server persistence.
 * Copyright/rights and sensitivity must be assessed by an accountable human.
 */
export const POLICY_VERSION="phase15c-governance-v1";
export const MAX_BYTES=80_000;
export const HEX64=/^[0-9a-f]{64}$/;
export const SOURCE_ID=/^src_[a-f0-9]{32}$/;
export const ATTESTATIONS=[
 ["rights","本人已核對完整內容及轉存、雲端處理的授權或例外依據；不能單靠『網上公開』推定有權保存全文。"],
 ["purpose","已確定合法且具體的使用目的、必要性及所需資料範圍。"],
 ["no_personal","已人工逐段審視正文、Evidence、摘要與 metadata，不包含需要保護的個人資料。"],
 ["no_confidential","已人工確認沒有僱主、客戶、機構機密、憑證、內部文件或其他未獲授權內容。"],
 ["evidence","已人工追溯每一項重要 Claim 至具體原文，並記錄未核實的 Assumption／Unknown。"],
 ["backup","原始 JSON 已完整匯出，並重新選擇本機備份，SHA-256 完全一致。"],
 ["retention","接受初始上傳日起最多七日，更新不延長；屆滿前須有具體刪除及匯出方案。"],
 ["residual","理解 D1 Time Travel／服務商備份可能於刪除後仍保留短期殘留副本。"],
 ["controller","已確認資料控制者、審批者、撤銷方式及風險負責人；預備逐篇人工審批。"]
];
const issue=(code,label)=>({code,label});
const nonempty=s=>typeof s==="string"&&Boolean(s.trim());
const normalize=s=>typeof s==="string"?s.normalize("NFC"):"";
export function sensitiveIndicators(text){
 if(typeof text!=="string")return [];
 const result=[];
 // Pattern detections are indicators, NOT a PII scanner or proof of absence.
 if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text))result.push("email_pattern");
 if(/(?:\b(?:api[_-]?key|secret|password|authorization|bearer)\b\s*[:=]\s*\S{6,}|\bsk-[A-Za-z0-9_-]{16,}\b)/i.test(text))result.push("possible_secret");
 if(/\b[A-Z]{1,2}\d{6}\([0-9A]\)(?![A-Za-z0-9])/i.test(text))result.push("hkid_pattern");
 if(/\b(?:\+852[\s.-]?)?[569]\d{3}[\s.-]?\d{4}\b/.test(text))result.push("hk_mobile_pattern");
 if(/(?:confidential|restricted|internal only|customer list|client data|機密|保密|僅限內部|個人資料)/i.test(text))result.push("sensitive_keyword");
 return [...new Set(result)];
}
export function inspectRecord(record){
 const blockers=[],unknown=[];
 if(!record||typeof record!=="object"||Array.isArray(record))
  return {blockers:[issue("invalid_json_object","不是有效的 SourceRecord 物件")],unknown,indicators:[],claim_references:0};
 if(record.record_version!==2)blockers.push(issue("schema_version","必須為 SourceRecord v2"));
 const mandatoryArrays=["key_points","key_claims","evidence","uncertainties","topic_tags","trend_tags","library_targets"];
 for(const key of mandatoryArrays)if(!Array.isArray(record[key]))
  blockers.push(issue("invalid_"+key,"SourceRecord v2 欄位型別不正確："+key));
 if(!nonempty(record.platform)||!nonempty(record.source_type)||
    !nonempty(record.language)||!nonempty(record.captured_at)||
    Number.isNaN(Date.parse(record.captured_at??"")))
  blockers.push(issue("source_metadata_incomplete","來源平台、類型、語言或捕獲時間未通過核對"));
 if(record.source_url!==null&&(typeof record.source_url!=="string"||
    !/^https?:\/\//i.test(record.source_url)))
  blockers.push(issue("invalid_url_field","來源 URL 應是 http/https 或明確 null"));
 if(typeof record.confidence!=="number"||!Number.isFinite(record.confidence)||
    record.confidence<0||record.confidence>1)
  blockers.push(issue("invalid_confidence","confidence 必須在 0 至 1 之間"));
 if(!record.analysis||record.analysis.version!==1||
    !["not_requested","draft","failed","processing"].includes(record.analysis.status))
  blockers.push(issue("analysis_contract","缺少有效的分析狀態及版本"));
 if(!["needs_review","reviewed"].includes(record.review_status)||
    !["not_approved","approved"].includes(record.approval_status))
  blockers.push(issue("invalid_review_contract","Review／Approval 狀態不符合 v2"));

 if(!SOURCE_ID.test(record.id??""))blockers.push(issue("source_id","SourceRecord ID 需要固定 src_ + 32 位十六進制格式"));
 if(record.material_status!=="captured")blockers.push(issue("capture_incomplete","來源正文尚未完成 capture"));
 if(!nonempty(record.raw_text)&&!nonempty(record.transcript))
  blockers.push(issue("missing_body","缺少正文或轉錄內容"));
 if(!nonempty(record.title))unknown.push(issue("missing_title","標題尚未確認"));
 if(!nonempty(record.creator))unknown.push(issue("creator_unknown","作者或內容創建者未確認"));
 if(!nonempty(record.source_url)&&!nonempty(record.source_url_final)&&!nonempty(record.source_url_original))
  unknown.push(issue("original_url_unknown","缺少原始 URL，必須用其他證據證明內容來源"));
 if(!nonempty(record.rights_note))
  unknown.push(issue("rights_basis_missing","未提供使用權利的依據及人工紀錄"));
 if(record.analysis?.status==="processing"||!record.analysis)
  blockers.push(issue("analysis_unstable","分析狀態未完成或缺失"));
 const raw=[normalize(record.raw_text),normalize(record.transcript)].filter(Boolean).join("\n");
 const refs=[];
 const evidence=Array.isArray(record.evidence)?record.evidence:[];
 if(!evidence.length)blockers.push(issue("missing_evidence","沒有 Evidence 原文片段"));
 for(const evidenceItem of evidence)refs.push(evidenceItem?.text_reference);
 const claims=Array.isArray(record.key_claims)?record.key_claims:[];
 if(!claims.length)unknown.push(issue("claim_coverage_unknown","尚未建立 Claim 級別的原文核對"));
 for(const claim of claims){
  if(!nonempty(claim?.claim)||!Array.isArray(claim.evidence)||!claim.evidence.length)
   blockers.push(issue("claim_without_evidence","存在未附 Evidence 的 Claim"));
  else for(const item of claim.evidence)refs.push(item?.text_reference);
 }
 for(const ref of refs)if(!nonempty(ref)||!raw.includes(normalize(ref)))
  blockers.push(issue("invalid_text_reference","有 Evidence 不能逐字回到已匯入的原文"));
 const indicators=sensitiveIndicators(JSON.stringify(record));
 if(indicators.length)blockers.push(issue("sensitivity_red_flags",
  "發現可能屬個人資料／機密／憑證的字串，請清理來源後重新匯入（自動偵測不是完整 PII 審查）"));
 if(record.approval_status==="approved"||record.review_status==="reviewed")
  unknown.push(issue("legacy_approval","本機舊有 Review/Approval 不等同新雲端批准，必須重設並重新核對"));
 if(!Array.isArray(record.uncertainties)||!Array.isArray(record.key_points))
  unknown.push(issue("analysis_metadata_unknown","缺少 uncertainties／key_points 結構，需人工覆核"));
 if(record.case_candidate===true)
  unknown.push(issue("case_publication_unknown","可能涉及案例公開，必須另行取得 public-safe 發布授權"));
 return {blockers:dedupe(blockers),unknown:dedupe(unknown),indicators,
  claim_references:refs.length};
}
function dedupe(items){return [...new Map(items.map(x=>[x.code,x])).values()]}
export function evaluateGovernance({record,file_sha256,backup_sha256,attestations={}}){
 const {blockers,unknown,indicators,claim_references}=inspectRecord(record);
 if(!HEX64.test(file_sha256??""))blockers.push(issue("missing_fingerprint","未能計算完整原件 SHA-256"));
 if(!backup_sha256||backup_sha256!==file_sha256)
  blockers.push(issue("backup_unverified","原件與備份的 SHA-256 未能完全核對"));
 const pending=ATTESTATIONS.filter(([key])=>attestations[key]!==true)
  .map(([key])=>issue("attestation_"+key,"人工授權／治理聲明未完成："+key));
 const local_ready=blockers.length===0&&unknown.length===0&&pending.length===0;
 return {
  policy_version:POLICY_VERSION,
  decision:local_ready?"LOCAL_GOVERNANCE_REVIEWED":"HOLD",
  cloud_write_authorized:false,
  real_upload_enabled:false,
  reason:"本階段只作本機治理核對；不論結果為何都不會獲得雲端上傳權限。",
  source_id:SOURCE_ID.test(record?.id??"")?record.id:null,
  source_sha256:HEX64.test(file_sha256??"")?file_sha256:null,
  claim_references,blockers:dedupe(blockers),unknown,pending,
  risk_indicators:indicators,
  assumptions:[
   "權利及資料分類由 Owner 人工聲明，程式不能驗證其法律效力。",
   "敏感字串檢查只屬啟發式篩查，未偵測不等於沒有個人或機密資料。",
   "尚未完成逐篇 Cloudflare Access 身份、撤銷／刪除及簽署式授權日誌的正式雲端驗收。"
  ],
  next_action:local_ready?
   "提交不含原始內容的治理評估供 Owner 審批；另行取得明確逐篇上傳許可，不可直接同步。":
   "先清理所有 BLOCKED／UNKNOWN，完成本地備份與人工權利審查；不可同步。"
 };
}
