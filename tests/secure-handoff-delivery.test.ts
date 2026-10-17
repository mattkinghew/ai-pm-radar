import assert from "node:assert/strict";
import test from "node:test";

import { normaliseSourceInput, type SourceRecord } from "../lib/source-inbox.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import {
  approveHandoff, createHandoffDraft, markHandoffReviewed, updateHandoff,
} from "../lib/downstream-handoff.ts";
import {
  createDeliveryPackage, toContentOpsIntakePackage, validateDeliveryPackage,
} from "../lib/delivery-package.ts";
import {
  approveHandoffWithSeal, assertSealedHandoff,
  createSealedDeliveryPackage, assertSealedDeliveryPackage,
} from "../lib/secure-handoff-delivery.ts";
import { parseSourceLibraryBackup, serializeSourceLibraryBackup } from "../lib/source-library-backup.ts";

const at = "2026-10-15T13:00:00.000Z";
const quote = "A human reviews exact evidence before sending an approved research note.";
const sourceText = `${quote} The note is then exported to a downstream application.`;
const url = "https://example.org/public-test-evidence";

function reviewedRecord(): SourceRecord {
  const record = normaliseSourceInput({
    value: sourceText, kind: "paste_text", sourceUrl: url, title: "Safe research handoff",
    capturedAt: at,
  }, { now: at }).record;
  const evidence = { source: url, text_reference: quote, timestamp: null };
  return {
    ...record,
    summary: "Controlled synthetic transfer",
    evidence: [evidence],
    key_claims: [{ claim: "A human reviews evidence before export.", evidence: [evidence] }],
    review_status: "reviewed",
    approval_status: "approved",
  };
}

async function makeBundle() {
  const entry = createSourceLibraryEntry(reviewedRecord(), at);
  const draft = createHandoffDraft(entry, "content_candidate", at);
  const reviewed = markHandoffReviewed(draft, "2026-10-15T13:01:00.000Z");
  const approved = await approveHandoffWithSeal(reviewed, entry, "2026-10-15T13:02:00.000Z");
  const linked = { ...entry, downstream_handoffs: [approved] };
  const item = await createSealedDeliveryPackage(linked, approved, "2026-10-15T13:03:00.000Z");
  const record = { package: item, state: "packaged" as const, exported_at: null, import_confirmed_at: null };
  return { entry: linked, approved, item, record };
}

test("secure 1.5D approval and delivery bind reviewed source, evidence and package, with consumer v1 compatibility", async () => {
  const { entry, approved, item, record } = await makeBundle();
  assert.match(approved.approval_seal_sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(validateDeliveryPackage(item), true);
  assert.match(item.security_sha256?.package_sha256 ?? "", /^[a-f0-9]{64}$/);
  await assertSealedHandoff(approved, entry);
  await assertSealedDeliveryPackage(record, entry);
  const intake = toContentOpsIntakePackage(item);
  assert.equal(intake.items[0]?.externalId, item.package_id);
  assert.equal(intake.items[0]?.metadata.radarDelivery.source_record_id, entry.source_record.id);
  assert.equal(intake.items[0]?.metadata.radarDelivery.package_sha256, item.security_sha256?.package_sha256);
});

test("negative: changed source byte, evidence quote, handoff payload and package invalidate seals", async () => {
  const { entry, approved, item, record } = await makeBundle();
  const modifiedSource = { ...entry, source_record: { ...entry.source_record, raw_text: sourceText.replace("research", "researcu") } };
  await assert.rejects(assertSealedHandoff(approved, modifiedSource), /no longer valid|integrity check failed/);
  const modifiedEvidence = {
    ...approved,
    evidence_references: approved.evidence_references.map((value, index) => index === 0
      ? { ...value, text_reference: "a changed quote" } : value),
  };
  await assert.rejects(assertSealedHandoff(modifiedEvidence, entry), /no longer valid|integrity check failed/);
  const modifiedAnalysis = { ...approved, derived_analysis: { ...approved.derived_analysis, target_audience: "unreviewed replacement" } };
  await assert.rejects(assertSealedHandoff(modifiedAnalysis, entry), /no longer valid|integrity check failed/);
  const alteredPackage = { ...item, payload: { ...item.payload, human_notes: "mutated after seal" } };
  await assert.rejects(assertSealedDeliveryPackage({ ...record, package: alteredPackage }, entry), /invalid|integrity check failed/);
  const alteredSecurity = { ...item, security_sha256: { ...item.security_sha256!, package_sha256: "0".repeat(64) } };
  await assert.rejects(assertSealedDeliveryPackage({ ...record, package: alteredSecurity }, entry), /integrity check failed/);
});

test("negative: legacy fingerprint-only approvals and packages remain readable but cannot be securely exported", async () => {
  const entry = createSourceLibraryEntry(reviewedRecord(), at);
  const reviewed = markHandoffReviewed(createHandoffDraft(entry, "content_candidate", at), "2026-10-15T13:01:00.000Z");
  const legacy = approveHandoff(reviewed, entry, "2026-10-15T13:02:00.000Z");
  await assert.rejects(assertSealedHandoff(legacy, entry), /Legacy or unsealed/);
  const sealed = await approveHandoffWithSeal(reviewed, entry, "2026-10-15T13:02:00.000Z");
  const linked = { ...entry, downstream_handoffs: [sealed] };
  const legacyPackage = createDeliveryPackage(linked, sealed, "2026-10-15T13:03:00.000Z");
  await assert.rejects(assertSealedDeliveryPackage({
    package: legacyPackage, state: "packaged", exported_at: null, import_confirmed_at: null,
  }, linked), /Legacy DeliveryPackage/);
});

test("backup JSON round-trip retains seal but never reapproves stale source or edited revision", async () => {
  const { entry, approved, record } = await makeBundle();
  const withPackage = { ...entry, delivery_packages: [record] };
  const restored = parseSourceLibraryBackup(serializeSourceLibraryBackup([withPackage], at)).entries[0]!;
  await assertSealedDeliveryPackage(restored.delivery_packages[0]!, restored);
  const edited = updateHandoff(approved, { human_notes: "new draft content" }, "2026-10-15T13:04:00.000Z");
  assert.equal(edited.approval_seal_sha256, null);
  await assert.rejects(assertSealedHandoff(edited, entry), /human approval/);
  const outdated = { ...restored, downstream_handoffs: [edited] };
  await assert.rejects(assertSealedDeliveryPackage(restored.delivery_packages[0]!, outdated), /outdated/);
});
