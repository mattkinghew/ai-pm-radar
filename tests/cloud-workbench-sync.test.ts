import assert from "node:assert/strict";
import test from "node:test";
import {normaliseSourceInput, type SourceRecord} from "../lib/source-inbox.ts";
import {
 newCloudBinding, validCloudBinding,prepareWorkbenchSource,decideCloudSync,
 acknowledgeCloudSync,resolveCloudConflict,
} from "../lib/cloud-workbench-sync.ts";

const cloudId="src_0123456789abcdef0123456789abcdef";
const when="2026-10-15T12:00:00Z";
const sourceUrl="https://example.org/synthetic-remote";
function sampleRecord(): SourceRecord {
 const text="Synthetic evidence: Eight students wanted more practice.";
 const base=normaliseSourceInput({value:text,kind:"paste_text",sourceUrl,title:"Synthetic research",
   creator:"Synthetic Research Institute",capturedAt:when},{now:when}).record;
 const evidence={source:sourceUrl,timestamp:null,text_reference:"Eight students wanted more practice."};
 return {...base,summary:"Synthetic tutorial",key_claims:[{claim:"Eight requested practice.",evidence:[evidence]}],
  evidence:[evidence],evidence_grade:"B",review_status:"reviewed",approval_status:"approved"};
}
test("local identity mapping is independent of article URL and mutable text",()=>{
 const a=newCloudBinding("material-first",cloudId);
 assert.deepEqual(a,{version:1,material_id:"material-first",cloud_source_id:cloudId,
   last_remote_revision:null,last_remote_fingerprint:null,last_synced_at:null});
 assert.ok(validCloudBinding(a));
 assert.throws(()=>newCloudBinding("material-second","src_invalid"),/valid/);
 assert.throws(()=>newCloudBinding(" ",cloudId),/valid/);
 assert.equal(validCloudBinding({...a,last_remote_revision:3,last_remote_fingerprint:null}),false);
});

test("preparing real-format SourceRecord is LOCAL ONLY and strips inherited approvals",async()=>{
 const base=sampleRecord();
 const binding=newCloudBinding("material-a",cloudId);
 const v=await prepareWorkbenchSource(base,binding);
 assert.equal(v.record.id,cloudId);
 assert.equal(v.record.approval_status,"not_approved");
 assert.equal(v.record.review_status,"needs_review");
 assert.equal(v.record.raw_text,base.raw_text);
 assert.equal(base.id!=="",true);
 assert.equal(base.approval_status,"approved");
 assert.equal(v.blockers.length,0);
 assert.match(v.fingerprint,/^[0-9a-f]{64}$/);
 assert.ok(v.approx_bytes>0);
});

test("stable cloud ID and fingerprint across equivalent repeated previews",async()=>{
 const binding=newCloudBinding("material-a",cloudId);
 const a=await prepareWorkbenchSource(sampleRecord(),binding);
 const b=await prepareWorkbenchSource(sampleRecord(),binding);
 assert.equal(a.fingerprint,b.fingerprint);
 const changed=await prepareWorkbenchSource({...sampleRecord(),summary:"Revised synthetic text"},binding);
 assert.notEqual(changed.fingerprint,a.fingerprint);
 assert.equal(changed.record.id,cloudId,"material keeps same cloud source ID");
});

test("never prepare a missing source or pending AI analysis",async()=>{
 const base=sampleRecord();
 const binding=newCloudBinding("material-a",cloudId);
 const empty=await prepareWorkbenchSource({...base,raw_text:"",transcript:null,material_status:"needs_manual_input"},binding);
 assert.ok(empty.blockers.length>=1);
 const waiting=await prepareWorkbenchSource({...base,analysis:{...base.analysis,status:"processing"}},binding);
 assert.ok(waiting.blockers.includes("analysis_in_progress"));
 const noEvidence=await prepareWorkbenchSource({...base,evidence:[],key_claims:[]},binding);
 assert.ok(noEvidence.blockers.includes("evidence_missing"));
});

test("fresh local source always requires explicit consent before cloud creation",async()=>{
 const binding=newCloudBinding("material-a",cloudId);
 const local=(await prepareWorkbenchSource(sampleRecord(),binding)).fingerprint;
 const plan=decideCloudSync({binding,localFingerprint:local,localBlockers:[],remote:null});
 assert.equal(plan.kind,"create_requires_consent");
 assert.equal(plan.can_upload_automatically,false);
});

test("success ACK can be recorded only with matching cloud identity and valid revision",async()=>{
 const binding=newCloudBinding("material-a",cloudId);
 const local=(await prepareWorkbenchSource(sampleRecord(),binding)).fingerprint;
 const ack=acknowledgeCloudSync(binding,{source_id:cloudId,revision:1,fingerprint:local},when);
 assert.equal(ack.last_remote_revision,1);
 assert.equal(ack.last_remote_fingerprint,local);
 assert.equal(binding.last_remote_revision,null);
 assert.throws(()=>acknowledgeCloudSync(ack,{source_id:"src_ffffffffffffffffffffffffffffffff",revision:2,fingerprint:local},when),/Invalid/);
 assert.throws(()=>acknowledgeCloudSync(ack,{source_id:cloudId,revision:0,fingerprint:local},when),/Invalid/);
 assert.throws(()=>acknowledgeCloudSync(ack,{source_id:cloudId,revision:0,fingerprint:local},"bad"),/Invalid/);
});

test("in sync and local only changes require no automatic upload",async()=>{
 const initial=(await prepareWorkbenchSource(sampleRecord(),newCloudBinding("material-a",cloudId))).fingerprint;
 const b=acknowledgeCloudSync(newCloudBinding("material-a",cloudId),{source_id:cloudId,revision:3,fingerprint:initial},when);
 const same=decideCloudSync({binding:b,localFingerprint:initial,localBlockers:[],
   remote:{source_id:cloudId,revision:3,fingerprint:initial}});
 assert.equal(same.kind,"in_sync");
 const modified=(await prepareWorkbenchSource({...sampleRecord(),summary:"Changed"},b)).fingerprint;
 const pending=decideCloudSync({binding:b,localFingerprint:modified,localBlockers:[],
   remote:{source_id:cloudId,revision:3,fingerprint:initial}});
 assert.equal(pending.kind,"push_requires_consent");
 assert.equal(pending.can_upload_automatically,false);
});

test("remote changed alone requires backup before local restore",async()=>{
 const old=(await prepareWorkbenchSource(sampleRecord(),newCloudBinding("material-a",cloudId))).fingerprint;
 const b=acknowledgeCloudSync(newCloudBinding("material-a",cloudId),{source_id:cloudId,revision:2,fingerprint:old},when);
 const remote={source_id:cloudId,revision:3,fingerprint:"a".repeat(64)};
 const decision=decideCloudSync({binding:b,localFingerprint:old,localBlockers:[],remote});
 assert.equal(decision.kind,"remote_newer_requires_backup");
 assert.equal(decision.can_upload_automatically,false);
});

test("two independently modified copies always conflict with explicit choice",async()=>{
 const old=(await prepareWorkbenchSource(sampleRecord(),newCloudBinding("material-a",cloudId))).fingerprint;
 const newer=(await prepareWorkbenchSource({...sampleRecord(),summary:"Local change"},newCloudBinding("material-a",cloudId))).fingerprint;
 const binding=acknowledgeCloudSync(newCloudBinding("material-a",cloudId),{source_id:cloudId,revision:1,fingerprint:old},when);
 const decision=decideCloudSync({binding,localFingerprint:newer,localBlockers:[],
   remote:{source_id:cloudId,revision:2,fingerprint:old}});
 assert.equal(decision.kind,"conflict_requires_manual_choice");
 assert.equal(decision.can_upload_automatically,false);
 assert.throws(()=>resolveCloudConflict("keep_local_as_new_revision",{backupVerified:false,remoteFetched:true,sameSourceId:true}),/backup/);
 assert.equal(resolveCloudConflict("cancel",{backupVerified:false,remoteFetched:false,sameSourceId:false}).action,"no_change");
 assert.equal(resolveCloudConflict("manual_merge",{backupVerified:true,remoteFetched:true,sameSourceId:true}).action,"manual_diff_only");
 assert.equal(resolveCloudConflict("restore_remote_to_new_local_draft",{backupVerified:true,remoteFetched:true,sameSourceId:true}).action,"stage_remote_draft_only");
 assert.equal(resolveCloudConflict("keep_local_as_new_revision",{backupVerified:true,remoteFetched:true,sameSourceId:true}).action,"stage_local_reapproval_only");
});

test("invalid/absent remote ID never silently merges records",async()=>{
 const fp=(await prepareWorkbenchSource(sampleRecord(),newCloudBinding("material-a",cloudId))).fingerprint;
 const b=acknowledgeCloudSync(newCloudBinding("material-a",cloudId),{source_id:cloudId,revision:1,fingerprint:fp},when);
 assert.equal(decideCloudSync({binding:b,localFingerprint:fp,localBlockers:[],
   remote:{source_id:"src_ffffffffffffffffffffffffffffffff",revision:3,fingerprint:fp}}).kind,"identity_conflict");
 assert.equal(decideCloudSync({binding:b,localFingerprint:fp,localBlockers:[],remote:null}).kind,"remote_missing_requires_review");
});

test("old workbench global approvals are never transferred to prepared cloud record",async()=>{
 const record=sampleRecord();
 const v=await prepareWorkbenchSource(record,newCloudBinding("material-a",cloudId));
 assert.equal(record.review_status,"reviewed");
 assert.equal(record.approval_status,"approved");
 assert.equal(v.record.review_status,"needs_review");
 assert.equal(v.record.approval_status,"not_approved");
 const plan=decideCloudSync({binding:newCloudBinding("material-a",cloudId),localFingerprint:v.fingerprint,
   localBlockers:["unverified_claim_provenance"],remote:null});
 assert.equal(plan.kind,"blocked");
});
