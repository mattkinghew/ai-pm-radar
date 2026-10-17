import assert from "node:assert/strict";
import test from "node:test";
import {normaliseSourceInput} from "../lib/source-inbox.ts";
import type {SourceRecord} from "../lib/source-inbox.ts";
import {PHASE14_PINNED_CLOUD_ID,PHASE14_PINNED_TITLE,
 reconcileLocalWithPinnedCloud} from "../lib/pilot-source-reconciliation.ts";
function fixture():SourceRecord{
 const r=normaliseSourceInput({kind:"paste_text",value:"Synthetic safe source text",
   title:PHASE14_PINNED_TITLE,capturedAt:"2026-10-15T00:00:00Z"},
  {now:"2026-10-15T00:00:00Z"}).record;
 return {...r,id:PHASE14_PINNED_CLOUD_ID};
}
test("nothing gets cloud write permission even when identical",()=>{
 const remote=fixture();
 const p=reconcileLocalWithPinnedCloud(remote,remote.id,remote);
 assert.equal(p.status,"matches_checked_fields");
 assert.deepEqual(p.changed_fields,[]);
 assert.equal(p.cloud_write_allowed,false);
 assert.equal(p.local_approval_carries_to_cloud,false);
});
test("local edits only become explicit differences, never cloud updates",()=>{
 const remote=fixture();
 const local={...remote,summary:"Changed only in the Workbench",approval_status:"approved" as const};
 const p=reconcileLocalWithPinnedCloud(local,remote.id,remote);
 assert.equal(p.status,"local_fields_differ");
 assert.ok(p.changed_fields.includes("summary"));
 assert.equal(p.cloud_write_allowed,false);
 assert.equal(p.local_approval_carries_to_cloud,false);
});
test("mismatched source ID or source body blocks cloud binding",()=>{
 const remote=fixture();
 assert.equal(reconcileLocalWithPinnedCloud({...remote,raw_text:"Private"},remote.id,remote).status,"different_source_blocked");
 assert.equal(reconcileLocalWithPinnedCloud(remote,"src_"+("f".repeat(32)),remote).status,"different_source_blocked");
 assert.equal(reconcileLocalWithPinnedCloud(remote,null,remote).status,"no_local");
});
test("record provenance and provider metadata must not be silently claimed as synced",()=>{
 const remote=fixture(),local=fixture();
 const p=reconcileLocalWithPinnedCloud(local,remote.id,remote);
 assert.ok(p.ignored_cloud_fields.some(v=>v.includes("rights")));
 assert.ok(p.ignored_cloud_fields.some(v=>v.includes("provider")));
});
