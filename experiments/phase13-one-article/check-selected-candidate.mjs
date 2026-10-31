import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {
 inspectRealPilotCandidate,testRealPilotBackupRoundTrip,
 REQUIRED_PILOT_ATTESTATIONS
} from "../../lib/phase13-real-pilot-preflight.ts";
const file="experiments/phase13-one-article/fixtures/clean-room-public-article.json";
const raw=readFileSync(file,"utf8"),record=JSON.parse(raw);
const result=await inspectRealPilotCandidate(record,null,record.id);
assert.equal(result.outcome,"BLOCKED");
assert.deepEqual(result.blockers.sort(),REQUIRED_PILOT_ATTESTATIONS.map(k=>"consent_missing:"+k).sort());
assert.equal(result.evidence_references_checked,6);
assert.equal(result.claim_count,3);
const backup=await testRealPilotBackupRoundTrip(record,record.id);
assert.equal(backup.ok,true);
assert.equal(backup.cloud_candidate_approvals_reset,true);
const proposal={
 selected_title:record.title,selected_id:record.id,
 original_fixture_sha256:createHash("sha256").update(raw).digest("hex"),
 record_content_sha256:result.record_content_sha256,
 record_bytes:result.source_bytes,claim_count:result.claim_count,
 verbatim_evidence_checked:result.evidence_references_checked,
 backup_integrity_verified:true,owner_rights_attestation_received:false,
 actual_cloud_upload_occurred:false,
 preflight_disposition:"BLOCKED_ONLY_OWNER_ATTESTATIONS_PENDING",
};
console.log(JSON.stringify(proposal,null,2));
