"use strict";
const get=id=>document.getElementById(id);
let selected=null;
const root="/api/records";
function show(s){get("status").textContent=s;}
function display(x){get("output").textContent=JSON.stringify(x,null,2);}
async function call(path,method="GET",body){
  const init={method,headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store"};
  if(body!==undefined)init.body=JSON.stringify(body);
  const r=await fetch(path,init);
  const data=await r.json();
  return {status:r.status,data};
}
async function refresh(){
 try{
  const r=await call(root);
  if(r.status!==200)throw Error("HTTP "+r.status+" "+JSON.stringify(r.data));
  selected=r.data.records[0]||null;
  display({record_count:r.data.records.length,selected,other_ids:r.data.records.slice(1,10).map(x=>x.source_id)});
  const yes=Boolean(selected);
  get("review").disabled=!yes||selected.review_status==="reviewed";
  get("approve").disabled=!yes||selected.review_status!=="reviewed"||selected.approved;
  get("edit").disabled=!yes;get("stale").disabled=!yes;
  show(yes?"已同步：revision "+selected.revision+" · "+selected.review_status+" · "+(selected.approved?"已批准":"未批准"):"目前沒有雲端記錄，可以建立合成來源。");
 }catch(e){show("錯誤："+e.message);display({error:e.message});}
}
async function action(path,method,body,label){
 try{
  const r=await call(path,method,body);
  if(r.status>=400){show(label+"：HTTP "+r.status+" "+JSON.stringify(r.data));return;}
  await refresh();show(label+"：成功（HTTP "+r.status+"）");
 }catch(e){show(label+"：錯誤 "+e.message);}
}
get("create").addEventListener("click",async()=>{
 const id="qa_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
 const text="Synthetic cloud note. Nine people requested more practice. This data is fictional.";
 const record={record_version:2,id,raw_text:text,title:"Synthetic Cloud Sync Test",
   source_url:"https://example.invalid/synthetic",creator:"Synthetic Test",
   key_claims:[{claim:"Nine people requested more practice.",
     evidence:[{text_reference:"Nine people requested more practice.",source:"https://example.invalid/synthetic",timestamp:null}]}]};
 await action(root,"POST",{source_id:id,record},"建立合成來源");
});
get("refresh").addEventListener("click",refresh);
get("review").addEventListener("click",async()=>{if(selected)await action(root+"/"+selected.source_id+"/review","POST",{expectedRevision:selected.revision},"Review");});
get("approve").addEventListener("click",async()=>{if(selected)await action(root+"/"+selected.source_id+"/approve","POST",{expectedRevision:selected.revision},"Approval");});
get("edit").addEventListener("click",async()=>{
 if(!selected)return;
 const record={...selected.record,raw_text:selected.record.raw_text+" Edited after approval."};
 await action(root+"/"+selected.source_id,"PUT",{expectedRevision:selected.revision,record},"修改並重設批准");
});
get("stale").addEventListener("click",async()=>{
 if(!selected)return;
 const r=await call(root+"/"+selected.source_id,"PUT",{expectedRevision:selected.revision-1,record:selected.record});
 show(r.status===409?"PASS：舊版本被拒絕（HTTP 409）":"結果 "+r.status+" "+JSON.stringify(r.data));
});
refresh();
