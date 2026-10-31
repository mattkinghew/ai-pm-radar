"use strict";
const $=id=>document.getElementById(id);
let cap=null,validatedRecord=null,recordWire=null,backupHash=null,backupReady=false,cloudRecord=null;
const articleHash=async text=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))]
  .map(v=>v.toString(16).padStart(2,"0")).join("");
function setMessage(message,kind=""){const el=$("inspection");el.textContent=message;el.className="status "+kind}
// Deliberately no POST/PUT/DELETE client request handler.
function ready(){return Boolean(cap&&validatedRecord&&backupReady)}
function contentOf(record) {
 if(!record||typeof record!=="object"||Array.isArray(record))throw Error("不是 SourceRecord 物件");
 const normalized={...record,review_status:"needs_review",approval_status:"not_approved"};
 return JSON.stringify(normalized);
}
function clear(){
 validatedRecord=null;recordWire=null;backupHash=null;backupReady=false;
 $("download-backup").disabled=true;$("verify-backup").disabled=true;$("review-consent").disabled=true;
 $("consent-result").textContent="檔案重新選擇後，需要重新核對備份。";
}
async function safeRecord(value){
 if(!cap)throw Error("未驗證 Cloudflare Access 能力");
 if(value.record_version!==2||value.id!==cap.pinned_article_id)throw Error("文章 ID／Schema 不符");
 if(!Array.isArray(value.evidence)||!value.evidence.length||!Array.isArray(value.key_claims)
   ||!value.key_claims.length||typeof value.raw_text!=="string")throw Error("缺少 Evidence 或來源正文");
 const all=[...value.evidence,...value.key_claims.flatMap(item=>item.evidence||[])];
 if(!all.every(item=>typeof item?.text_reference==="string"&&item.text_reference
   &&value.raw_text.includes(item.text_reference)))throw Error("來源引述未在原文逐字找到");
 const encoded=contentOf(value),digest=await articleHash(encoded);
 if(digest!==cap.pinned_article_sha256 && digest!==cap.pinned_update_sha256)
  throw Error("本文不是指定試點文章／版本，或已被修改");
 if(new TextEncoder().encode(encoded).length>cap.max_payload_bytes)throw Error("內容超過安全大小上限");
 return {normalized:JSON.parse(encoded),encoded,digest,quotes:all.length};
}
async function checkFile(file) {
 clear();
 if(!file)return;
 if(file.size>100000||file.size<100)throw Error("JSON 檔案大小不符合預期");
 const text=await file.text();
 const selected=JSON.parse(text);
 const valid=await safeRecord(selected);
 validatedRecord=valid.normalized;recordWire=valid.encoded;
 $("download-backup").disabled=false;
 const same=cloudRecord && JSON.stringify(cloudRecord)===valid.encoded;
 setMessage("PASS：指定來源及 SHA-256 相同；逐字 Evidence "+valid.quotes+" 處。"+(cloudRecord?(same?"雲端與本機完整 SourceRecord 一致。":"ERROR：雲端與本機內容有差異。"):"雲端尚無資料可比較。"),same||!cloudRecord?"pass":"fail");
}
$("choose-record").addEventListener("change",async event=>{
 const field=event.currentTarget, file=field.files?.[0];
 field.value="";
 try{await checkFile(file)}
 catch(e){clear();setMessage("BLOCKED："+e.message,"fail")}
});
$("download-backup").addEventListener("click",async()=>{
 if(!recordWire||!validatedRecord)return;
 const filename="radar-phase13-one-article-sanitized-backup.json";
 const blob=new Blob([JSON.stringify(validatedRecord,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 backupHash=await articleHash(recordWire);backupReady=false;
 $("verify-backup").disabled=false;
 $("review-consent").disabled=true;
 $("consent-result").textContent="已觸發下載；請在下一欄重選剛下載的 JSON 才能確認備份。";
});
$("verify-backup").addEventListener("change",async e=>{
 const field=e.currentTarget,file=field.files?.[0];
 field.value="";
 try{
if(!file||file.size>100000)throw Error("檔案不存在或過大");
  const result=await safeRecord(JSON.parse(await file.text()));
  if(!backupHash||result.digest!==backupHash)throw Error("備份 SHA-256 不符");
  backupReady=true;$("review-consent").disabled=false;
  $("consent-result").textContent="PASS：備份讀回及 SHA-256 比對成功。遠端再次寫入功能關閉。";
 }catch(error){backupReady=false;$("review-consent").disabled=true;
  $("consent-result").textContent="BLOCKED："+error.message}
});
$("review-consent").addEventListener("click",()=>{
 if(!ready())return;
 const flags=[...document.querySelectorAll("#consent-options input[data-consent]")];
 const checked=flags.filter(el=>el.checked).length;
 $("consent-result").textContent=checked===flags.length?
 "本機聲明齊備（7/7）。授權條款已複核；本頁不會重新上傳。":
 "聲明尚未齊備（"+checked+"/"+flags.length+"）。已阻擋雲端上傳。";
});
async function verifyCloud(){
 if(!cap)throw Error("Cloudflare Access 未完成");
 const record=await fetch("/api/pilot/record",{credentials:"same-origin",cache:"no-store",redirect:"manual"});
 if(record.status===404){
  cloudRecord=null;
  $("remote-state").textContent="PASS：尚無文章（HTTP 404）";
  return;
 }
 if(record.status===410){
  cloudRecord=null;
  $("remote-state").textContent="到期：雲端文章已禁止讀取（410）";
  return;
 }
 if(record.status!==200)throw Error("雲端讀回失敗 HTTP "+record.status);
 const response=await record.json();
 if(![1,2].includes(response.revision)||typeof response.purge_due_at!=="string"){
  throw Error("Revision 或到期時間不符合預期");
 }
 const valid=await safeRecord(response.record);
 const expectedHash=response.revision===1?cap.pinned_article_sha256:cap.pinned_update_sha256;
 if(valid.digest!==response.content_sha256 || valid.digest!==expectedHash)
  throw Error("雲端 Revision/SHA256 不一致");
 if(valid.normalized.review_status!=="needs_review"||
   valid.normalized.approval_status!=="not_approved")throw Error("雲端已有非預期審批狀態");
 cloudRecord=valid.normalized;
 const local=new Date(response.purge_due_at).toLocaleString("zh-Hant",{timeZone:"Asia/Hong_Kong",hour12:false});
 $("remote-state").textContent="PASS：Revision "+response.revision+"／SHA-256 一致／Evidence "+valid.quotes+
   " 處／未 Review／未 Approval；到期（香港時間）"+local;
 if(recordWire){
  const identical=recordWire===valid.encoded;
  setMessage(identical?"PASS：本機備份與雲端完整 SourceRecord 一致。":
    "ERROR：本機備份與雲端不相同。",identical?"pass":"fail");
 }
}
$("verify-cloud").addEventListener("click",async()=>{
 $("remote-state").textContent="正在重新核對 D1…";
 try{await verifyCloud()}catch(e){$("remote-state").textContent="BLOCKED："+e.message}
});
(async()=>{
 try{
  const r=await fetch("/api/pilot/capabilities",{credentials:"same-origin",cache:"no-store",redirect:"manual"});
  if(r.status!==200)throw Error("Cloudflare Access 尚未通過（HTTP "+r.status+"）");
  const d=await r.json();
  if(d.pilot_version!==1||d.access_required!==true||d.isolated_database!==true
    ||d.owner_scoped!==true||d.real_upload_enabled!==false
    ||d.requires_explicit_consent!==true||!d.pinned_article_id||!d.pinned_article_sha256
    ||!d.pinned_update_sha256)
    throw Error("上傳能力或身份政策與預檢期望不符");
  cap=d;$("auth-state").textContent="PASS：身份已驗證，網域同源";
  $("article-id").textContent=d.pinned_article_id;
  $("upload-state").textContent="OFF：已完成指定文章匯入，不接受其他文章";
  $("choose-record").disabled=false;
  $("verify-cloud").disabled=false;
  await verifyCloud();
 }catch(e){
  $("auth-state").textContent="BLOCKED："+e.message;
  $("choose-record").disabled=true;
  $("remote-state").textContent="尚未驗證";
 }
})();
