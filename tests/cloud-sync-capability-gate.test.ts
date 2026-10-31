import assert from "node:assert/strict";
import test from "node:test";
import {normaliseSourceInput} from "../lib/source-inbox.ts";
import {newCloudBinding,prepareWorkbenchSource,decideCloudSync,acknowledgeCloudSync} from "../lib/cloud-workbench-sync.ts";
import {requireCloudCapabilities,planExplicitCloudWrite,type CloudSyncCapabilities} from "../lib/cloud-sync-capability-gate.ts";
import {acknowledgeCloudBinding} from "../lib/cloud-sync-local-store.ts";
const cloudId="src_0123456789abcdef0123456789abcdef";
const now="2026-10-15T10:00:00.000Z";
const CAP:CloudSyncCapabilities={
  api_version:1,source_record_version:2,source_library_version:4,
  access_enforced:true,synthetic_only:false,expected_revision_required:true,
  real_sources_opt_in:true,human_approval_required:true,max_record_bytes:100000,
};
const endpoint="https://radar.example.test/api/cloud/capabilities";
function fixture(){
 const base=normaliseSourceInput({value:"Synthetic trial: More study time requested.",kind:"paste_text",
  creator:"Synthetic",title:"Synthetic test",sourceUrl:"https://example.org/synthetic",capturedAt:now},{now}).record;
 const evidence={source:"https://example.org/synthetic",timestamp:null,text_reference:"More study time requested."};
 return {...base,evidence:[evidence],key_claims:[{claim:"More study time requested.",evidence:[evidence]}]};
}
test("gate requires same-origin protected exact endpoint",()=>{
 assert.deepEqual(requireCloudCapabilities("https://radar.example.test",endpoint,CAP),CAP);
 assert.throws(()=>requireCloudCapabilities("https://radar.example.test",
  "https://another.workers.dev/api/cloud/capabilities",CAP),/same-origin/);
 assert.throws(()=>requireCloudCapabilities("http://insecure.example.test","http://insecure.example.test/api/cloud/capabilities",CAP),/secure/);
 assert.throws(()=>requireCloudCapabilities("https://radar.example.test","/api/cloud/health",CAP),/exact authenticated route/);
});
test("currently deployed synthetic-only Preview cannot authorize real sync",()=>{
 const remote={...CAP,synthetic_only:true};
 assert.throws(()=>requireCloudCapabilities("https://radar.example.test",endpoint,remote),/synthetic_only/);
 assert.throws(()=>requireCloudCapabilities("https://radar.example.test",endpoint,{status:"ready",synthetic_only:true}),/api_version/);
});
test("missing Cloudflare Access, revision gating or manual review fails closed",()=>{
 for(const patch of [{access_enforced:false},{expected_revision_required:false},{human_approval_required:false},
 {source_library_version:3},{max_record_bytes:0}]){
  assert.throws(()=>requireCloudCapabilities("https://radar.example.test",endpoint,{...CAP,...patch}));
 }
});
test("fresh source-specific consent and independently verified backup required before even forming request",async()=>{
 const binding=newCloudBinding("material-a",cloudId);
 const prepared=await prepareWorkbenchSource(fixture(),binding);
 const decision=decideCloudSync({binding,localFingerprint:prepared.fingerprint,localBlockers:prepared.blockers,remote:null});
 const valid={granted:true as const,cloud_source_id:cloudId,local_fingerprint:prepared.fingerprint,
  verified_local_backup:true as const,rights_confirmed:true as const,
  seven_day_retention_accepted:true as const,time_travel_residual_accepted:true as const,requested_at:now};
 await assert.rejects(planExplicitCloudWrite({record:prepared.record,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,consent:null,now}),/consent/);
 const incompleteConsent={...valid,rights_confirmed:false};
 await assert.rejects(planExplicitCloudWrite({record:prepared.record,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,
  consent:incompleteConsent as unknown as typeof valid,now}),/consent/);
 await assert.rejects(planExplicitCloudWrite({record:prepared.record,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,consent:{...valid,cloud_source_id:"src_invalid"},now}),/consent/);
 await assert.rejects(planExplicitCloudWrite({record:prepared.record,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,consent:valid,now:"2026-10-15T10:20:00Z"}),/consent/);
 const plan=await planExplicitCloudWrite({record:prepared.record,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,consent:valid,now});
 assert.equal(plan.method,"POST");
 assert.equal(plan.body.record.approval_status,"not_approved");
 assert.equal(plan.body.authorization.content_sha256,prepared.fingerprint);
 assert.equal(plan.body.authorization.time_travel_residual_acknowledged,true);
 const tampered={...prepared.record,evidence:prepared.record.evidence.map((item,index)=>index===0?{...item,text_reference:item.text_reference+"!"}:item)};
 await assert.rejects(planExplicitCloudWrite({record:tampered,binding,localFingerprint:prepared.fingerprint,
  approxBytes:prepared.approx_bytes,decision,capabilities:CAP,consent:valid,now}),/integrity check failed/i);
});
test("incremental push must specify ACKED expectedRevision not stale local number",async()=>{
 const b0=newCloudBinding("material-a",cloudId);
 const old=await prepareWorkbenchSource(fixture(),b0);
 const binding=acknowledgeCloudSync(b0,{source_id:cloudId,revision:5,fingerprint:old.fingerprint},now);
 const changed=await prepareWorkbenchSource({...fixture(),summary:"Updated synthetic."},binding);
 const decision=decideCloudSync({binding,localFingerprint:changed.fingerprint,localBlockers:[],
  remote:{source_id:cloudId,revision:5,fingerprint:old.fingerprint}});
 const plan=await planExplicitCloudWrite({record:changed.record,binding,localFingerprint:changed.fingerprint,
  approxBytes:changed.approx_bytes,decision,capabilities:CAP,
  consent:{granted:true,verified_local_backup:true,rights_confirmed:true,seven_day_retention_accepted:true,
   time_travel_residual_accepted:true,cloud_source_id:cloudId,local_fingerprint:changed.fingerprint,requested_at:now},now});
 assert.equal(plan.method,"PUT");
 assert.equal(plan.body.expectedRevision,5);
});
test("local acknowledgement metadata cannot change identity, clear or roll back a server revision",async()=>{
 const binding=newCloudBinding("material-a",cloudId);
 const next=acknowledgeCloudSync(binding,{source_id:cloudId,revision:1,fingerprint:"a".repeat(64)},now);
 await assert.rejects(acknowledgeCloudBinding(binding,{...next,cloud_source_id:"src_ffffffffffffffffffffffffffffffff"}),/Invalid cloud acknowledgement/);
 await assert.rejects(acknowledgeCloudBinding(next,{...next,last_remote_revision:null,last_remote_fingerprint:null,last_synced_at:null}),/Invalid cloud acknowledgement/);
 const advanced=acknowledgeCloudSync(next,{source_id:cloudId,revision:2,fingerprint:"b".repeat(64)},now);
 await assert.rejects(acknowledgeCloudBinding(advanced,next),/Invalid cloud acknowledgement/);
});
test("dual-edited conflict never produces upload request",async()=>{
 const b0=newCloudBinding("material-a",cloudId);
 const old=await prepareWorkbenchSource(fixture(),b0);
 const binding=acknowledgeCloudSync(b0,{source_id:cloudId,revision:5,fingerprint:old.fingerprint},now);
 const changed=await prepareWorkbenchSource({...fixture(),summary:"Local edited"},binding);
 const decision=decideCloudSync({binding,localFingerprint:changed.fingerprint,localBlockers:[],
  remote:{source_id:cloudId,revision:6,fingerprint:old.fingerprint}});
 await assert.rejects(planExplicitCloudWrite({record:changed.record,binding,
  localFingerprint:changed.fingerprint,approxBytes:changed.approx_bytes,decision,capabilities:CAP,
  consent:{granted:true,verified_local_backup:true,rights_confirmed:true,seven_day_retention_accepted:true,
   time_travel_residual_accepted:true,cloud_source_id:cloudId,local_fingerprint:changed.fingerprint,requested_at:now},now}),/Conflict/);
});
