import {ATTESTATIONS,POLICY_VERSION,MAX_BYTES,evaluateGovernance,inspectRecord} from "/real-source-readiness/engine.js";
const $=id=>document.getElementById(id);
const textEncoder=new TextEncoder();
let source=null,rawBytes=null,sourceHash=null,backupHash=null,backupDownloaded=false;
let currentReport=null;
async function digest(bytes){
 const bytesArray=bytes instanceof ArrayBuffer?bytes:textEncoder.encode(bytes);
 const result=await crypto.subtle.digest("SHA-256",bytesArray);
 return [...new Uint8Array(result)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
function status(el,msg,type=""){el.textContent=msg;el.className="notice"+(type?" "+type:"")}
function resetBackup(){
 backupHash=null;backupDownloaded=false;$("backup-file").value="";$("backup-file").disabled=true;
 status($("backup-state"),"備份未讀回驗證。");
}
function resetSource(){
 source=null;rawBytes=null;sourceHash=null;$("source-meta").replaceChildren();
 $("download-backup").disabled=true;resetBackup();currentReport=null;
 $("download-report").disabled=true;
 $("report-preview").textContent="尚未完成本機核對。";
}
function addMeta(key,value){
 const dt=document.createElement("dt"),dd=document.createElement("dd");
 dt.textContent=key;dd.textContent=String(value);
 $("source-meta").append(dt,dd);
}
function renderInspection(){
 const recordInspection=inspectRecord(source);
 const messages=[...recordInspection.blockers.map(x=>"BLOCKED："+x.label),
  ...recordInspection.unknown.map(x=>"UNKNOWN："+x.label)];
 $("errors-list").replaceChildren();
 for(const message of messages){
  const li=document.createElement("li");li.textContent=message;$("errors-list").append(li);
 }
 status($("errors-state"),
  "Evidence 引用共 "+recordInspection.claim_references+" 項；"+
  recordInspection.blockers.length+" 個 BLOCKED／"+
  recordInspection.unknown.length+" 個 UNKNOWN；風險模式 "+
  (recordInspection.indicators.length?recordInspection.indicators.join("、"):"未自動偵測（不代表無風險）"),
  recordInspection.blockers.length?"blocked":recordInspection.unknown.length?"warning":"");
}
function attestations(){
 return Object.fromEntries(ATTESTATIONS.map(([key])=>[key,$("attest-"+key).checked]));
}
function review(){
 currentReport=evaluateGovernance({record:source,file_sha256:sourceHash,
  backup_sha256:backupHash,attestations:attestations()});
 const ready=currentReport.decision==="LOCAL_GOVERNANCE_REVIEWED";
 status($("decision"),
  (ready?"本機治理審查：PASS（待 Owner 逐篇雲端批准）":"HOLD：尚未符合本機治理預備條件")+
  "；BLOCKED "+currentReport.blockers.length+"／UNKNOWN "+currentReport.unknown.length+
  "／人工待確認 "+currentReport.pending.length+"。真實來源雲端上傳：OFF。",
  ready?"":"warning");
 $("download-report").disabled=!sourceHash;
 // Deliberately sanitize report: NO raw_text, URL, metadata, excerpts, credentials or emails.
 $("report-preview").textContent=JSON.stringify({
  policy_version:currentReport.policy_version,decision:currentReport.decision,
  cloud_write_authorized:currentReport.cloud_write_authorized,
  source_id:currentReport.source_id,source_sha256:currentReport.source_sha256,
  blockers:currentReport.blockers.map(x=>x.code),
  unknown:currentReport.unknown.map(x=>x.code),
  pending:currentReport.pending.map(x=>x.code),
  risk_indicators:currentReport.risk_indicators,
  next_action:currentReport.next_action
 },null,2);
 return currentReport;
}
function download(bytes,name,mime){
 const blob=new Blob([bytes],{type:mime});
 const href=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=href;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1800);
}
for(const [key,label] of ATTESTATIONS){
 const field=document.createElement("label");field.className="check";
 const input=document.createElement("input");input.type="checkbox";input.id="attest-"+key;
 const span=document.createElement("span");span.textContent=label;
 field.append(input,span);$("attestations").append(field);
 input.addEventListener("change",review);
}
$("source-file").addEventListener("change",async event=>{
 resetSource();
 const file=event.currentTarget.files?.[0];
 if(!file)return;
 try{
  if(file.size>MAX_BYTES)throw Error("文件超出 80 KB 審查上限");
  const buffer=await file.arrayBuffer();
  const parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("不是 JSON 物件");
  source=parsed;rawBytes=buffer;sourceHash=await digest(buffer);
  $("download-backup").disabled=false;
  addMeta("SourceRecord ID",typeof parsed.id==="string"?parsed.id:"不符合格式");
  addMeta("Schema",parsed.record_version??"UNKNOWN");
  addMeta("原件檔案 SHA-256",sourceHash);
  addMeta("資料大小",file.size+" bytes");
  addMeta("權利狀態","必須人工覆核；不提供自動合法性判斷");
  status($("source-state"),"已在瀏覽器本機載入原件；不會將正文傳送到任何網絡服務。");
  renderInspection();
 }catch(e){resetSource();status($("source-state"),"BLOCKED："+e.message,"blocked")}
 review();
});
$("download-backup").addEventListener("click",()=>{
 if(!source||!rawBytes||!sourceHash)return;
 download(rawBytes,"radar-governance-original-"+(source.id||"unknown")+".json","application/json");
 resetBackup();
 backupDownloaded=true;$("backup-file").disabled=false;
 status($("backup-state"),"原件已下載；請重新選取該下載檔案，確認完整 SHA-256。");
 review();
});
$("backup-file").addEventListener("change",async event=>{
 backupHash=null;
 const file=event.currentTarget.files?.[0];
 try{
  if(!backupDownloaded||!sourceHash||!file||file.size>MAX_BYTES)
   throw Error("須先下載原件備份並重新選檔（上限 80 KB）");
  const buffer=await file.arrayBuffer(),h=await digest(buffer);
  if(h!==sourceHash)throw Error("備份和原始檔案 SHA-256 不符，請重新下載並選取");
  backupHash=h;status($("backup-state"),"PASS：完整來源備份讀回與原件 SHA-256 完全一致。");
 }catch(e){backupHash=null;status($("backup-state"),"BLOCKED："+e.message,"blocked")}
 review();
});
$("review").addEventListener("click",review);
$("download-report").addEventListener("click",()=>{
 if(!currentReport||!sourceHash)return;
 // Write only calculated, non-textual, non-source fields. Human declarations are
 // booleans, not legal evidence. NO source JSON included in report.
 const report={...currentReport,attested_controls:Object.keys(attestations()).filter(key=>attestations()[key])};
 const file=JSON.stringify(report,null,2)+"\n";
 download(file,"radar-phase15c-governance-"+(currentReport.source_id||"unverified")+".json","application/json");
});
review();
