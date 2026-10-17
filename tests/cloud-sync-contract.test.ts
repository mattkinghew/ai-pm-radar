import assert from "node:assert/strict";
import test from "node:test";
import { normaliseSourceInput, type SourceRecord } from "../lib/source-inbox.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import { serializeSourceLibraryBackup } from "../lib/source-library-backup.ts";
import { serializeSourceDrafts } from "../lib/source-draft-storage.ts";
import {
  createCloudSourceState, cloudApprovals, reviewCloudSourceState,
  editCloudSourceState, rejectCloudSourceState, approveCloudSourceState,
  getApprovedCloudSourceRecord, getCloudSourceRevision, CloudRevisionConflict,
} from "../lib/cloud-sync-contract.ts";
import { inspectCloudMigrationBackups, MAX_MIGRATION_BACKUP_BYTES } from "../lib/cloud-migration-preflight.ts";

const at = "2026-10-15T00:00:00.000Z";
const sourceUrl = "https://example.org/synthetic-research";
const text = "A synthetic AI training pilot included human review. Nine students requested additional practice. No outcome savings were measured.";
const evidence = {
  source: sourceUrl, timestamp: null,
  text_reference: "Nine students requested additional practice.",
};
const daily = {
  question_title: "What did the synthetic pilot reveal?", short_title: "Synthetic pilot",
  category: "AI PM Learning", tags: ["learning"],
  impact_score: 5, relevance_score: 6, trust_score: 5,
};

function record(id = "src-cloud-a"): SourceRecord {
  const base = normaliseSourceInput({
    value: text, sourceUrl, kind: "paste_text", title: "Synthetic research source",
    creator: "Synthetic Research Lab", capturedAt: at,
  }, {now: at}).record;
  return {
    ...base, id, summary: "An artificial pilot illustrates human review.",
    key_points: ["Human review remained required."],
    why_it_matters: "A synthetic example of governance.",
    business_implication: "No verified business return.",
    ai_pm_implication: "Review workflow required.",
    key_claims: [{ claim: "Students wanted more practice.", evidence: [evidence] }],
    evidence: [evidence], evidence_grade: "B",
    analysis: {...base.analysis, status: "not_requested", provider: "none"},
  };
}

test("cloud state always starts unreviewed and no inherited approvals", async () => {
  const input = {...record(), review_status: "reviewed" as const, approval_status: "approved" as const};
  const state = await createCloudSourceState(input, at);
  assert.equal(state.schema_version, 1);
  assert.equal(state.server_revision, 1);
  assert.deepEqual(cloudApprovals(state), { reviewed: false, daily: false, reuse: false });
  assert.equal(state.revisions[0].record.approval_status, "not_approved");
  assert.equal(state.revisions[0].record.review_status, "needs_review");
  assert.equal(input.approval_status, "approved", "caller not mutated");
  assert.throws(() => approveCloudSourceState(state, 1, "source_reuse", at), /requires explicit/);
});

test("separate daily and reuse permissions cannot be confused", async () => {
  let state = await createCloudSourceState(record(), at);
  state = reviewCloudSourceState(state, 1, at);
  assert.equal(state.server_revision, 2);
  assert.equal(cloudApprovals(state).reviewed, true);
  state = approveCloudSourceState(state, 2, "daily_candidate", at, daily);
  assert.deepEqual(cloudApprovals(state), {reviewed: true, daily: true, reuse: false});
  assert.equal(getCloudSourceRevision(state).record.approval_status, "not_approved");
  assert.equal(getApprovedCloudSourceRecord(state, "daily_candidate").approval_status, "approved");
  assert.throws(() => getApprovedCloudSourceRecord(state, "source_reuse"), /approval/);
  state = approveCloudSourceState(state, 3, "source_reuse", at);
  assert.deepEqual(cloudApprovals(state), {reviewed: true, daily: true, reuse: true});
  const snapshot = getApprovedCloudSourceRecord(state, "source_reuse");
  assert.equal(createSourceLibraryEntry(snapshot, at).version, 4);
  assert.equal(state.revisions.length, 4);
  assert.deepEqual(state.events.map(e => e.kind), ["captured", "reviewed", "approved_for_daily", "approved_for_reuse"]);
});

test("material change resets both approvals, keeps immutable revisions and rejects stale writes", async () => {
  let state = await createCloudSourceState(record(), at);
  state = reviewCloudSourceState(state, 1, at);
  state = approveCloudSourceState(state, 2, "source_reuse", at);
  state = approveCloudSourceState(state, 3, "daily_candidate", at, daily);
  const old = structuredClone(state);
  const changed = {...record(), summary: "Changed after approved source."};
  state = await editCloudSourceState(state, 4, changed, at);
  assert.equal(state.server_revision, 5);
  assert.deepEqual(cloudApprovals(state), {reviewed:false,daily:false,reuse:false});
  assert.equal(state.revisions[4].record.review_status, "needs_review");
  assert.equal(state.revisions[3].record.summary, old.revisions[3].record.summary);
  assert.equal(state.revisions[0].record.summary, old.revisions[0].record.summary);
  assert.notEqual(state.revisions[4].fingerprint, old.revisions[3].fingerprint);
  assert.equal(old.server_revision, 4);
  await assert.rejects(editCloudSourceState(state, 4, changed, at),
    (error: unknown) => error instanceof CloudRevisionConflict && error.currentRevision === 5);
  assert.throws(() => reviewCloudSourceState(state, 4, at), CloudRevisionConflict);
  assert.throws(() => getApprovedCloudSourceRecord(state, "daily_candidate"), /approval/);
});

test("rejecting a reviewed source resets both approval scopes", async () => {
  let state = await createCloudSourceState(record(), at);
  state = reviewCloudSourceState(state, 1, at);
  state = approveCloudSourceState(state, 2, "source_reuse", at);
  state = rejectCloudSourceState(state, 3, at);
  assert.equal(state.revisions.at(-1)?.record.review_status, "rejected");
  assert.deepEqual(cloudApprovals(state), {reviewed:false,daily:false,reuse:false});
});

test("human grade is mandatory and Daily metadata cannot be omitted", async () => {
  let state = await createCloudSourceState({...record(), evidence_grade: "ungraded"}, at);
  state = reviewCloudSourceState(state, 1, at);
  assert.throws(() => approveCloudSourceState(state, 2, "source_reuse", at), /Grade/);
  let other = await createCloudSourceState(record(), at);
  other = reviewCloudSourceState(other, 1, at);
  assert.throws(() => approveCloudSourceState(other, 2, "daily_candidate", at), /metadata/i);
});

test("non-verbatim claim evidence blocks human review", async () => {
  const invalid = {...record(), key_claims: [{ claim: "Invented statement", evidence: [
    {...evidence, text_reference: "There was a 500% improvement."}
  ] }]};
  const state = await createCloudSourceState(invalid, at);
  assert.throws(() => reviewCloudSourceState(state, 1, at), /verbatim/);
  assert.equal(cloudApprovals(state).reviewed, false);
});

test("independent SourceRecord IDs never share approval or revision", async () => {
  let a = await createCloudSourceState(record("src-a"), at);
  const b = await createCloudSourceState(record("src-b"), at);
  a = reviewCloudSourceState(a, 1, at);
  assert.equal(a.server_revision, 2);
  assert.equal(b.server_revision, 1);
  assert.deepEqual(cloudApprovals(b), {reviewed:false,daily:false,reuse:false});
  await assert.rejects(editCloudSourceState(a, 2, record("src-b"), at), /ID cannot change/);
});

test("migration manifest reads explicit draft and library backups without exposing source content", () => {
  const approved = {...record(), review_status: "reviewed" as const, approval_status: "approved" as const};
  const entry = createSourceLibraryEntry(approved, at);
  const drafts = serializeSourceDrafts([{
    activeMaterialId: "material-a",
    materials: [
      { id: "material-a", form: { body: "Confidential Synthetic Example", sourceUrl } },
      { id: "material-b", form: { body: "Second synthetic note", sourceUrl } },
    ],
    reviewedFingerprint: "global-legacy-approved-fingerprint",
    approvedFingerprint: "global-legacy-approved-fingerprint",
  }], at);
  const manifest = inspectCloudMigrationBackups({
    draftBackupJson: drafts,
    libraryBackupJson: serializeSourceLibraryBackup([entry], at),
  });
  assert.equal(manifest.cloud_upload_allowed, false);
  assert.equal(manifest.total_materials, 2);
  assert.equal(manifest.eligible_draft_materials, 2);
  assert.equal(manifest.reusable_library_entries, 1);
  assert.equal(manifest.manual_review_required, true);
  assert.equal(manifest.decisions.some(d => d.code === "global_approval_ambiguous"), true);
  const serialized = JSON.stringify(manifest);
  for(const secret of ["Confidential", "Synthetic Example", sourceUrl, "src-cloud-a", "material-a"]) {
    assert.equal(serialized.includes(secret), false, "manifest cannot leak record contents or IDs");
  }
});

test("migration quarantines duplicates and malformed items, refuses automatic upload", () => {
  const backup = serializeSourceDrafts([{
    activeMaterialId: "missing",
    materials: [
      {id:"dupe", form:{body:"synthetic"}},
      {id:"dupe",form:{body:"repeat"}},
      {id:123,form:{body:"bad"}},
      {id:"empty-form",form:null},
    ],
  }], at);
  const manifest=inspectCloudMigrationBackups({draftBackupJson:backup});
  assert.equal(manifest.cloud_upload_allowed,false);
  assert.equal(manifest.eligible_draft_materials,1);
  assert.equal(manifest.total_materials,4);
  assert.equal(manifest.duplicate_material_ids,1);
  assert.equal(manifest.quarantined_entries,4);
  assert.ok(manifest.decisions.some(d=>d.code==="active_item_missing"));
  assert.ok(manifest.decisions.some(d=>d.code==="invalid_item"));
});

test("unsupported, invalid and oversized backups never authorize upload", () => {
  const unsupported=inspectCloudMigrationBackups({draftBackupJson:'{"version":999,"saved_at":"2026-10-15","items":[]}'});
  assert.ok(unsupported.decisions.some(d=>d.code==="unsupported_version"));
  const invalid=inspectCloudMigrationBackups({libraryBackupJson:'{"version":1,"entries":[{}]}'});
  assert.ok(invalid.decisions.some(d=>d.code==="invalid_backup"));
  const oversized=inspectCloudMigrationBackups({draftBackupJson:"x".repeat(MAX_MIGRATION_BACKUP_BYTES + 1)});
  assert.ok(oversized.decisions.some(d=>d.code==="over_limit"));
  assert.equal(oversized.cloud_upload_allowed,false);
});

test("legacy Library backup with duplicate ID requires manual reconciliation", () => {
  const approved={...record(),review_status:"reviewed" as const,approval_status:"approved" as const};
  const entry=createSourceLibraryEntry(approved,at);
  const backup=JSON.stringify({version:1,exported_at:at,entries:[entry,structuredClone(entry)]});
  const manifest=inspectCloudMigrationBackups({libraryBackupJson:backup});
  assert.equal(manifest.reusable_library_entries,1);
  assert.ok(manifest.decisions.some(d=>d.code==="duplicate_id"));
  assert.equal(manifest.cloud_upload_allowed,false);
});
