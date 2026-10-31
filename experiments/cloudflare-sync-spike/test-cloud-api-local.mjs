/** Phase1.2B Cloudflare Worker + D1 fully synthetic integration; no paid API. */
import assert from "node:assert/strict";
import {syntheticAlternateValues,SYNTHETIC_MUTABLE_FIELDS} from "../../lib/synthetic-full-field.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
const dir=dirname(fileURLToPath(import.meta.url));
const w=process.env.WRANGLER_BIN;
assert.ok(w,"Require installed Wrangler CLI via WRANGLER_BIN");
const local=mkdtempSync(join(tmpdir(),"radar-cloud12-"));
const base="http://127.0.0.1:8802";
const env={...process.env,WRANGLER_SEND_METRICS:"false",CI:"true"};
const cfg=["--config","wrangler-context-local.jsonc"];
let server;
const output=[];
const delay=(ms)=>new Promise(r=>setTimeout(r,ms));
function ok(label,condition){assert.ok(condition,label);console.log("PASS",label)}
async function call(path,{method="GET",body,headers={}}={}){
 const res=await fetch(base+path,{method,headers:{"content-type":"application/json",...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 let data;try{data=await res.json()}catch{data=null}
 return {status:res.status,data};
}
try{
 for(const schema of ["schema.sql","schema-v12.sql"]){
  execFileSync(process.execPath,[w,"d1","execute","DB","--local","--persist-to",local,"--file",schema,"--yes",...cfg],
    {cwd:dir,env,timeout:60000,stdio:"pipe"});
 }
 server=spawn(process.execPath,[w,"dev","--local","--ip","127.0.0.1","--port","8802","--persist-to",local,...cfg],{cwd:dir,env,stdio:["ignore","pipe","pipe"]});
 server.stdout.on("data",b=>output.push(String(b).slice(0,400)));
 server.stderr.on("data",b=>output.push(String(b).slice(0,400)));
 let ready=false;
 for(let i=0;i<35;i++){await delay(300);if(server.exitCode!==null)break;try{ready=(await call("/api/cloud/health")).status===200;if(ready)break}catch{}}
 assert.ok(ready,"Cloud API worker failed: "+output.slice(-8).join(" | "));
 ok("cloud health authenticated context and new D1 schema", (await call("/api/cloud/health")).data.synthetic_only===true);
 const fixture=await call("/api/cloud/fixture");
 ok("full source fixture returned",fixture.status===200&&fixture.data.record.record_version===2&&fixture.data.record.analysis?.version===1);
 const sourceId="qa12_fulltest_a1";
 const sourceRecord={...fixture.data.record,id:sourceId};
 const sourceUrl="/api/cloud/records/"+sourceId;
 ok("list starts empty",(await call("/api/cloud/records")).data.records.length===0);
 const forged=await call("/api/cloud/records",{method:"POST",body:{source_id:"qa12_fake_real",record:{...sourceRecord,id:"qa12_fake_real",source_url:"https://private.example"}}});
 ok("reject forged real URL",forged.status===422);
 ok("reject altered real text", (await call("/api/cloud/records",{method:"POST",body:{source_id:"qa12_private_test",record:{...sourceRecord,id:"qa12_private_test",raw_text:"Synthetic confidential information"}}})).status===422);
 ok("reject content-type text/plain", (await call("/api/cloud/records",{method:"POST",body:{source_id:sourceId,record:sourceRecord},headers:{"content-type":"text/plain"}})).status===400);
 ok("reject cross-origin mutation",(await call("/api/cloud/records",{method:"POST",body:{source_id:sourceId,record:sourceRecord},headers:{"origin":"https://malicious.test"}})).status===403);
 const created=await call("/api/cloud/records",{method:"POST",body:{source_id:sourceId,record:sourceRecord}});
 ok("create full SourceRecord v2",created.status===201&&created.data.revision===1&&!created.data.approvals.reuse&&!created.data.approvals.daily);
 ok("cannot approve reuse before review",(await call(sourceUrl+"/approve-reuse",{method:"POST",body:{expectedRevision:1}})).status===422);
 const reviewed=await call(sourceUrl+"/review",{method:"POST",body:{expectedRevision:1}});
 ok("human Review v2",reviewed.status===200&&reviewed.data.revision===2&&reviewed.data.approvals.reviewed);
 const daily=await call(sourceUrl+"/approve-daily",{method:"POST",body:{expectedRevision:2,daily:fixture.data.daily}});
 ok("Daily approval explicit only",daily.status===200&&daily.data.approvals.daily&&!daily.data.approvals.reuse&&daily.data.revision===3);
 ok("Daily approval did not auto-create reuse snapshot",(await call(sourceUrl+"/library")).status===404);
 const approved=await call(sourceUrl+"/approve-reuse",{method:"POST",body:{expectedRevision:3}});
 ok("Reuse approved separately",approved.status===200&&approved.data.approvals.daily&&approved.data.approvals.reuse&&approved.data.revision===4);
 const lib=await call(sourceUrl+"/library");
 ok("Source Library v4 persisted",lib.status===200&&lib.data.entry.version===4&&lib.data.entry.source_record.id===sourceId&&lib.data.entry.source_record.approval_status==="approved");
 const history=await call(sourceUrl+"/history");
 ok("append-only review events tracked",history.status===200&&history.data.events.length===4&&history.data.events.map(e=>e.kind).join(",")==="captured,reviewed,approved_for_daily,approved_for_reuse");
 const stale=await call(sourceUrl,{method:"PUT",body:{expectedRevision:2,record:{...sourceRecord,summary:"Synthetic revised source: student requests remained unverified in a real study."}}});
 ok("stale CAS returns 409",stale.status===409&&stale.data.currentRevision===4);
 const changedRecord={...approved.data.record,summary:"Synthetic revised source: student requests remained unverified in a real study."};
 const edited=await call(sourceUrl,{method:"PUT",body:{expectedRevision:4,record:changedRecord}});
 ok("material edit invalidates both scope approvals",edited.status===200&&edited.data.revision===5&&!edited.data.approvals.daily&&!edited.data.approvals.reuse&&!edited.data.approvals.reviewed);
 const read=await call(sourceUrl);
 ok("new request reads persistent full SourceRecord",read.status===200&&read.data.revision===5&&read.data.record.summary===changedRecord.summary);
 const staleLibrary=await call(sourceUrl+"/library");
 ok("stale Library v4 cannot be read as current approved",staleLibrary.status===409&&staleLibrary.data.code==="library_approval_stale");
 const historical=await call(sourceUrl+"/library-history");
 ok("immutable previous Library snapshot remains traceable but not reusable",historical.status===200
   &&historical.data.snapshots.length===1&&historical.data.snapshots[0].current_approved===false);
 const listing=await call("/api/cloud/records");
 ok("list returns non-sensitive metadata",listing.data.records.length===1&&!("record" in listing.data.records[0]));
 const h2=await call(sourceUrl+"/history");
 ok("history holds 5 immutable revisions",h2.data.events.length===5&&h2.data.events.at(-1).kind==="edited");
 const concurrencyRequest={expectedRevision:5,record:{...read.data.record,summary:"Synthetic source: students requested more practice."}};
 const simultaneous=await Promise.all([
   call(sourceUrl,{method:"PUT",body:concurrencyRequest}),
   call(sourceUrl,{method:"PUT",body:concurrencyRequest})
 ]);
 ok("two-device concurrent CAS accepts exactly one mutation",
   simultaneous.filter(r=>r.status===200).length===1
   && simultaneous.filter(r=>r.status===409).length===1);
 const afterRace=await call(sourceUrl);
 ok("concurrent history remains serializable and contiguous",afterRace.status===200&&afterRace.data.revision===6
   && (await call(sourceUrl+"/history")).data.events.length===6);
 const collision=await call("/api/cloud/records",{method:"POST",body:{source_id:sourceId,record:sourceRecord}});
 ok("duplicate create returns 409",collision.status===409);
 const id2="qa12_fulltest_b2";
 const record2={...fixture.data.record,id:id2};
 const created2=await call("/api/cloud/records",{method:"POST",body:{source_id:id2,record:record2}});
 ok("second source creates independent review",created2.status===201&&created2.data.revision===1&&!created2.data.approvals.reviewed);
 const other=await call("/api/cloud/records/"+id2);
 ok("second source unaffected by first source approvals",other.status===200&&other.data.revision===1);
 const fullId="qa12_fullfield_c4";
 const fullFixture={...fixture.data.record,id:fullId};
 const variations=syntheticAlternateValues();
 const full={...fullFixture};
 for(const field of SYNTHETIC_MUTABLE_FIELDS) full[field]=structuredClone(variations[field]);
 full.analysis={...full.analysis,source_facts:[...variations.analysis_source_facts],
   inferences:[...variations.analysis_inferences],
   method_or_teaching_points:[...variations.analysis_methods]};
 const fullCreated=await call("/api/cloud/records",{method:"POST",body:{source_id:fullId,record:full}});
 ok("19 full synthetic Workbench fields created on D1",
    fullCreated.status===201&&fullCreated.data.revision===1);
 const fullRead=await call("/api/cloud/records/"+fullId);
 ok("round-trip rich fields and verbatim Evidence",fullRead.status===200
   &&SYNTHETIC_MUTABLE_FIELDS.every(field=>JSON.stringify(fullRead.data.record[field])===JSON.stringify(full[field]))
   &&JSON.stringify(fullRead.data.record.analysis.source_facts)===JSON.stringify(full.analysis.source_facts)
   &&JSON.stringify(fullRead.data.record.analysis.inferences)===JSON.stringify(full.analysis.inferences)
   &&JSON.stringify(fullRead.data.record.analysis.method_or_teaching_points)===JSON.stringify(full.analysis.method_or_teaching_points));
 const fullReview=await call("/api/cloud/records/"+fullId+"/review",{method:"POST",body:{expectedRevision:1}});
 ok("human review valid alternate verbatim Evidence",fullReview.status===200&&fullReview.data.revision===2);
 const reuse=await call("/api/cloud/records/"+fullId+"/approve-reuse",{method:"POST",body:{expectedRevision:2}});
 ok("human reuse explicitly approved on alternative full payload",reuse.status===200&&reuse.data.approvals.reuse);
 const denied=await call("/api/cloud/records/"+fullId,{method:"PUT",body:{expectedRevision:3,record:{...full,why_it_matters:"private employee record"}}});
 ok("server refuses arbitrary text in any full field",denied.status===422);
 const revised={...full,summary:fixture.data.record.summary};
 const changed=await call("/api/cloud/records/"+fullId,{method:"PUT",body:{expectedRevision:3,record:revised}});
 ok("single semantic field edit invalidates full record approval",changed.status===200&&changed.data.revision===4&&!changed.data.approvals.reuse&&!changed.data.approvals.reviewed);
 const liveLibrary=await call("/api/cloud/records/"+fullId+"/library");
 ok("historical Source Library no longer current",liveLibrary.status===409&&liveLibrary.data.code==="library_approval_stale");
 console.log("CLOUD12_LOCAL_INTEGRATION_ALL_PASS");
}catch(e){console.error("CLOUD12_LOCAL_FAIL",e.stack);process.exitCode=1}
finally{
 if(server){server.kill("SIGTERM");await delay(500);if(server.exitCode===null)server.kill("SIGKILL")}
 rmSync(local,{recursive:true,force:true});
}
