import {assessBoundFiles,validateShadowPacket} from "/real-source-approval/engine.js";
const $=id=>document.getElementById(id);
const limits={"source-file":80000,"backup-file":80000,"report-file":40000};
let packet=null;
let loaded={"source-file":null,"backup-file":null,"report-file":null};
function status(message,warn=true){const el=$("result-state");el.textContent=message;el.className="notice"+(warn?" warning":"");}
function meta(label,value){
 const labelEl=document.createElement("span"),valueEl=document.createElement("span");
 labelEl.textContent=label;valueEl.textContent=value;
 $("files-meta").append(labelEl,valueEl);
}
const sha=async buf=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",buf))]
 .map(x=>x.toString(16).padStart(2,"0")).join("");
async function readFile(id){
 const file=$(id).files?.[0];
 if(!file||file.size<=0||file.size>limits[id])
  throw Error(id+"：缺檔、空檔或超出限制");
 const bytes=await file.arrayBuffer();
 JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 return bytes;
}
function reset(){
 packet=null;$("download-packet").disabled=true;
 $("packet-preview").textContent="尚未產生候選。";
}
function reviewers(){
 return {
  rights:{basis:$("rights-basis").value,evidence_ref:$("rights-evidence").value.trim(),
   reviewer_ref:$("rights-reviewer").value.trim(),confirmed:$("rights-confirm").checked},
  privacy:{classification:$("privacy-class").value,evidence_ref:$("privacy-evidence").value.trim(),
   reviewer_ref:$("privacy-reviewer").value.trim(),confirmed:$("privacy-confirm").checked},
  owner:{owner_ref:$("owner-ref").value.trim(),
   exact_file_ack:$("ack-exact").checked,seven_day_scope_ack:$("ack-ttl").checked,
   deletion_backup_residual_ack:$("ack-residual").checked,no_cloud_write_ack:$("ack-off").checked}
 };
}
async function reevaluate(){
 reset();
 const files=Object.values(loaded);
 if(files.some(x=>!(x instanceof ArrayBuffer))){
  status("HOLD：需要三份可讀取的 JSON，包括原件、原件備份及 Phase 1.5C 治理報告。");
  return;
 }
 const r=reviewers();
 packet=await assessBoundFiles({
  source_bytes:loaded["source-file"],backup_bytes:loaded["backup-file"],
  governance_report_bytes:loaded["report-file"],
  rights:r.rights,privacy:r.privacy,owner:r.owner
 });
 const eligible=packet.decision==="SHADOW_APPROVAL_CANDIDATE";
 const amount=(packet.blockers?.length??0)+(packet.unknown?.length??0)+(packet.pending?.length??0);
 status((eligible?"本機候選：SHADOW CANDIDATE PASS（仍不可上傳）":"HOLD／需要重新審查")+
  "。待處理 "+amount+" 項；真實來源寫入 OFF。候選有效至："+(packet.review_expires_at||"未建立"),!eligible);
 $("packet-preview").textContent=JSON.stringify({
  decision:packet.decision,source_id:packet.source_id,
  source_sha256:packet.source_sha256,
  governance_report_sha256:packet.governance_report_sha256,
  review_expires_at:packet.review_expires_at,
  rights_evidence_ref:packet.assessment_evidence?.rights_ref,
  privacy_evidence_ref:packet.assessment_evidence?.privacy_ref,
  blockers:packet.blockers,unknown:packet.unknown,pending:packet.pending,
  cloud_write_authorized:packet.cloud_write_authorized,
  identities_verified:packet.identities_verified,
  signature_verified:packet.signature_verified
 },null,2);
 $("download-packet").disabled=!eligible;
}
for(const id of Object.keys(limits)){
 $(id).addEventListener("change",async()=>{
  reset();loaded[id]=null;
  try{loaded[id]=await readFile(id);}
  catch(error){status("HOLD："+error.message);return}
  $("files-meta").replaceChildren();
  for(const [key,bytes] of Object.entries(loaded))
   if(bytes instanceof ArrayBuffer)meta(key+"（bytes／SHA）",
    String(bytes.byteLength)+" / "+(await sha(bytes)).slice(0,16)+"…");
  if(loaded["source-file"]&&loaded["backup-file"]&&loaded["report-file"]){
   const src=await sha(loaded["source-file"]);
   const backup=await sha(loaded["backup-file"]);
   $("files-state").textContent=src===backup?
    "PASS：原始 JSON 與完整備份的 byte SHA-256 一致（仍需核對治理報告）。":
    "BLOCKED：原始 JSON 與完整備份的 byte SHA-256 不符。";
  }
  await reevaluate();
 });
}
for(const id of ["rights-basis","rights-evidence","rights-reviewer","rights-confirm",
 "privacy-class","privacy-evidence","privacy-reviewer","privacy-confirm",
 "owner-ref","ack-exact","ack-ttl","ack-residual","ack-off"]){
 $(id).addEventListener("change",()=>void reevaluate());
 if($(id).tagName==="INPUT"&&$(id).type==="text")
  $(id).addEventListener("input",()=>void reevaluate());
}
$("review").addEventListener("click",()=>void reevaluate());
$("download-packet").addEventListener("click",async()=>{
 if(!packet||packet.decision!=="SHADOW_APPROVAL_CANDIDATE")return;
 const check=validateShadowPacket(packet,{
  source_id:packet.source_id,source_sha256:packet.source_sha256});
 if(!check.valid){status("HOLD：候選封包已過期或與原始指紋不符。");return}
 const payload=JSON.stringify(packet,null,2)+"\n";
 // No original SourceRecord JSON, full URLs, excerpts or original report body.
 const blob=new Blob([payload],{type:"application/json"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=u;a.download="radar-phase15d-shadow-"+packet.source_id+".json";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),1300);
});
reevaluate();
