import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normaliseSourceInput, type SourceRecord } from "../lib/source-inbox.ts";
import { buildResearchBrief } from "../lib/research-runtime.ts";
import {
  migrateSourceLibraryEntry,
  appendDeliveryPackage,
  appendResearchBriefHandoff,
  createSourceLibraryEntry,
  getReusableSourceBlockers,
  appendDownstreamHandoff,
  updateDeliveryPackageRecord,
  sourceLibraryArtifactId,
  validateSourceLibraryEntry,
} from "../lib/source-library.ts";
import {
  HANDOFF_SCHEMA_VERSION,
  HANDOFF_TYPES,
  approveHandoff,
  createHandoffDraft,
  exportHandoffJson,
  handoffToMarkdown,
  markHandoffReviewed,
  updateHandoff,
  validateHandoffForEntry,
} from "../lib/downstream-handoff.ts";
import { parseSourceLibraryBackup, serializeSourceLibraryBackup } from "../lib/source-library-backup.ts";
import { mergeSourceLibraryEntry } from "../lib/source-library.ts";
import { createIntelligenceAssessment, decideIntelligenceRoute, markIntelligenceRouteCreated } from "../lib/intelligence-routing.ts";
import {
  CONSUMER_PROFILES,
  confirmDeliveryPackageImported,
  createDeliveryPackage,
  deliveryPackageStatus,
  deliveryPackageToMarkdown,
  markDeliveryPackageExported,
  toContentOpsIntakePackage,
  validateConsumerCompatibility,
  validateDeliveryPackage,
} from "../lib/delivery-package.ts";

const capturedAt = "2026-09-19T00:00:00.000Z";
const sourceUrl = "https://example.com/synthetic-research";
const sourceText = "The synthetic pilot used a human review step before sharing. It did not measure time savings.";

function approvedRecord(): SourceRecord {
  const base = normaliseSourceInput({
    value: sourceText,
    kind: "paste_text",
    sourceUrl,
    originalSourceUrl: "https://example.com/requested",
    finalSourceUrl: sourceUrl,
    title: "Synthetic workflow note",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "The synthetic pilot used a human review step before sharing." };
  return {
    ...base,
    summary: "A synthetic pilot kept human review before sharing.",
    key_claims: [{ claim: "The pilot used human review before sharing.", evidence: [evidence] }],
    evidence: [evidence],
    review_status: "reviewed",
    approval_status: "approved",
  };
}

test("SourceRecord URL normalization retains requested and resolved URLs and marks fetch method", () => {
  const fetched = normaliseSourceInput({
    value: sourceUrl,
    kind: "manual_url",
    capturedText: sourceText,
    sourceUrl,
    originalSourceUrl: "https://example.com/requested",
    finalSourceUrl: sourceUrl,
    accessMethod: "metadata_probe",
    capturedAt,
  }, { now: capturedAt }).record;
  assert.equal(fetched.source_type, "url");
  assert.equal(fetched.access_method, "metadata_probe");
  assert.equal(fetched.raw_text, sourceText);
  assert.equal(fetched.source_url_original, "https://example.com/requested");
  assert.equal(fetched.source_url_final, sourceUrl);

  const fallback = normaliseSourceInput({
    value: sourceText,
    kind: "paste_text",
    sourceUrl: "https://example.com/requested",
    originalSourceUrl: "https://example.com/requested",
    finalSourceUrl: "https://example.com/requested",
    accessMethod: "manual_fallback",
    capturedAt,
  }, { now: capturedAt }).record;
  assert.equal(fallback.access_method, "manual_fallback");
  assert.equal(fallback.source_url, "https://example.com/requested");
});

test("only reviewed, explicitly approved records with exact evidence can enter reusable library", () => {
  const record = approvedRecord();
  const pending = { ...record, review_status: "needs_review" as const, approval_status: "not_approved" as const };
  assert.ok(getReusableSourceBlockers(pending).some((reason) => reason.includes("human reviewed")));
  assert.throws(() => createSourceLibraryEntry(pending, capturedAt), /human reviewed/);

  const unsupported = {
    ...record,
    key_claims: [{ claim: "Unsupported claim", evidence: [{ source: sourceUrl, timestamp: null, text_reference: "A fabricated quotation." }] }],
  };
  assert.ok(getReusableSourceBlockers(unsupported).some((reason) => reason.includes("cannot be located")));
  assert.throws(() => createSourceLibraryEntry(unsupported, capturedAt), /cannot be located/);

  const entry = createSourceLibraryEntry(record, capturedAt);
  assert.equal(validateSourceLibraryEntry(entry), true);
  assert.equal(entry.source_record.approval_status, "approved");
  assert.equal(entry.source_record.review_status, "reviewed");
  assert.notEqual(entry.source_record.review_status as string, "verified");
});

test("approved SourceRecord creates an idempotent Research Brief handoff with provenance intact", () => {
  const record = approvedRecord();
  const entry = createSourceLibraryEntry(record, capturedAt);
  const createdAt = "2026-09-20T00:00:00.000Z";
  const artifactId = sourceLibraryArtifactId(entry);
  const brief = buildResearchBrief(entry.source_record, artifactId, createdAt);
  const reused = appendResearchBriefHandoff(entry, artifactId, createdAt, brief);
  const duplicate = appendResearchBriefHandoff(reused, artifactId, "2026-09-21T00:00:00.000Z", brief);

  assert.equal(reused.source_record.id, brief.source_record_id);
  assert.equal(reused.source_record.source_url_original, "https://example.com/requested");
  assert.equal(reused.source_record.key_claims[0]?.evidence[0]?.text_reference, record.key_claims[0]?.evidence[0]?.text_reference);
  assert.equal(reused.handoffs.length, 1);
  assert.equal(reused.research_briefs.length, 1);
  assert.equal(duplicate.handoffs.length, 1);
  assert.equal(duplicate.source_record.approval_status, "approved");
  assert.equal(duplicate.source_record.analysis.status, "not_requested");
});

test("all downstream contract drafts reuse one approved source and keep facts, evidence, and analysis separate", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const drafts = HANDOFF_TYPES.map((type) => createHandoffDraft(entry, type, "2026-09-22T00:00:00.000Z"));

  assert.deepEqual(drafts.map((handoff) => handoff.type), HANDOFF_TYPES);
  for (const handoff of drafts) {
    assert.equal(handoff.source_record_id, entry.source_record.id);
    assert.equal(handoff.source_fingerprint, entry.fingerprint);
    assert.equal(handoff.status, "draft");
    assert.equal(handoff.approved_at, null);
    assert.equal(handoff.source_facts[0]?.text, entry.source_record.key_claims[0]?.claim);
    assert.equal(handoff.source_facts[0]?.evidence_reference_ids.length, 1);
    const payload = handoff.derived_analysis as unknown as Record<string, string | string[]>;
    assert.ok(Object.entries(payload).filter(([key]) => !["unknowns_and_risks", "unknowns", "uncertainty", "assumptions"].includes(key))
      .every(([, value]) => Array.isArray(value) ? value.length === 0 : value === ""));
    assert.ok(Object.values(payload).flat().includes("Unknown — not assessed"));
    assert.equal(handoff.evidence_references[0]?.text_reference, entry.source_record.evidence[0]?.text_reference);
    assert.equal(validateHandoffForEntry(handoff, entry), true);
  }
});

test("source approval does not approve a handoff; human review and separate approval are required", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const draft = createHandoffDraft(entry, "learning_pack", "2026-09-22T00:00:00.000Z");
  assert.throws(() => approveHandoff(draft, entry, "2026-09-22T00:01:00.000Z"), /separately reviewed/);
  const reviewed = markHandoffReviewed(draft, "2026-09-22T00:02:00.000Z");
  const approved = approveHandoff(reviewed, entry, "2026-09-22T00:03:00.000Z");
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewed_at, "2026-09-22T00:02:00.000Z");
  assert.equal(approved.approved_at, "2026-09-22T00:03:00.000Z");
  assert.equal(approved.source_record_id, entry.source_record.id);
  assert.equal(entry.source_record.approval_status, "approved");
  assert.notEqual(entry.source_record.approval_status, "verified");
});

test("editing a downstream handoff invalidates its review and approval without changing SourceRecord evidence", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const draft = createHandoffDraft(entry, "case_reference", "2026-09-22T00:00:00.000Z");
  const reviewed = markHandoffReviewed(draft, "2026-09-22T00:01:00.000Z");
  const approved = approveHandoff(reviewed, entry, "2026-09-22T00:02:00.000Z");
  const edited = updateHandoff(approved, {
    derived_analysis: { ...approved.derived_analysis, observed_problem: "Synthetic problem statement" },
  }, "2026-09-22T00:03:00.000Z");

  assert.equal(edited.status, "draft");
  assert.equal(edited.reviewed_at, null);
  assert.equal(edited.approved_at, null);
  assert.equal(edited.derived_analysis.observed_problem, "Synthetic problem statement");
  assert.equal(entry.source_record.evidence[0]?.text_reference, "The synthetic pilot used a human review step before sharing.");
});

test("handoffs cannot cross SourceRecord identity or evidence boundaries and export preserves the contract", () => {
  const first = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const secondRecord = { ...approvedRecord(), id: "src_other" };
  const second = createSourceLibraryEntry(secondRecord, capturedAt);
  const handoff = createHandoffDraft(first, "creative_reference", "2026-09-22T00:00:00.000Z");
  assert.equal(validateHandoffForEntry(handoff, second), false);
  assert.throws(() => approveHandoff(markHandoffReviewed(handoff, "2026-09-22T00:01:00.000Z"), second), /source or evidence references/);
  assert.throws(() => exportHandoffJson(handoff), /Only an approved handoff/);
  const approved = approveHandoff(markHandoffReviewed(handoff, "2026-09-22T00:01:00.000Z"), first, "2026-09-22T00:02:00.000Z");
  const json = JSON.parse(exportHandoffJson(approved));
  assert.equal(json.source_record_id, first.source_record.id);
  assert.equal(json.evidence_references[0].id, approved.evidence_references[0]?.id);
  assert.match(handoffToMarkdown(approved), /Derived analysis \(not source facts\)/);
  assert.match(handoffToMarkdown(approved), /SourceRecord ID/);
});

test("rejects unsupported handoff types, unapproved sources, and attempts to replace source facts", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  assert.throws(() => createHandoffDraft(entry, "unsupported" as never, capturedAt), /Unsupported handoff type/);
  assert.throws(() => createHandoffDraft({
    ...entry,
    source_record: { ...entry.source_record, approval_status: "not_approved" },
  }, "content_candidate", capturedAt), /approved, reusable SourceRecord/);

  const draft = createHandoffDraft(entry, "content_candidate", capturedAt);
  const attemptedSourceFactReplacement = updateHandoff(draft, {
    source_facts: [{ text: "Invented fact", evidence_reference_ids: [] }],
  } as unknown as { derived_analysis?: typeof draft.derived_analysis; human_notes?: string });
  assert.deepEqual(attemptedSourceFactReplacement.source_facts, draft.source_facts);
  assert.equal(validateHandoffForEntry({
    ...draft,
    source_facts: [{ text: "Invented fact", evidence_reference_ids: [] }],
  }, entry), false);
});

test("every handoff type exports parseable JSON and provenance-complete Markdown only after separate approval", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  for (const type of HANDOFF_TYPES) {
    const draft = createHandoffDraft(entry, type, "2026-09-22T00:00:00.000Z");
    assert.throws(() => exportHandoffJson(draft), /Only an approved handoff/);
    assert.throws(() => handoffToMarkdown(draft), /Only an approved handoff/);

    const reviewed = markHandoffReviewed(draft, "2026-09-22T00:01:00.000Z");
    const approved = approveHandoff(reviewed, entry, "2026-09-22T00:02:00.000Z");
    const json = JSON.parse(exportHandoffJson(approved));
    const markdown = handoffToMarkdown(approved);

    assert.equal(json.type, type);
    assert.equal(json.schema_version, HANDOFF_SCHEMA_VERSION);
    assert.equal(json.source_record_id, entry.source_record.id);
    assert.equal(json.status, "approved");
    assert.ok(json.evidence_references.some((reference: { source_record_id: string; text_reference: string }) =>
      reference.source_record_id === entry.source_record.id && reference.text_reference === entry.source_record.evidence[0]?.text_reference));
    assert.match(markdown, new RegExp(`# ${type}`));
    assert.match(markdown, new RegExp(`SourceRecord ID: ${entry.source_record.id}`));
    assert.match(markdown, /Derived analysis \(not source facts\)/);
    assert.match(markdown, /Approved at:/);
  }
});

test("v1 approved-library entries migrate without losing existing Research Brief relationships", () => {
  const current = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const legacy = {
    ...current,
    version: 1,
    downstream_handoffs: undefined,
    handoffs: [{ kind: "research_brief", artifact_id: "legacy-brief", created_at: capturedAt }],
    research_briefs: [],
    legacy_extension: { retained: true },
  };
  const migrated = migrateSourceLibraryEntry(legacy);
  assert.equal(migrated?.version, 4);
  assert.deepEqual(migrated?.handoffs, legacy.handoffs);
  assert.deepEqual((migrated as unknown as { legacy_extension: unknown }).legacy_extension, { retained: true });
  assert.deepEqual(migrated?.downstream_handoffs, []);
  assert.equal(validateSourceLibraryEntry(migrated), true);
});

function approvedHandoff(entry: ReturnType<typeof createSourceLibraryEntry>, type: (typeof HANDOFF_TYPES)[number], at = capturedAt) {
  const draft = createHandoffDraft(entry, type, at);
  return approveHandoff(markHandoffReviewed(draft, "2026-09-22T00:01:00.000Z"), entry, "2026-09-22T00:02:00.000Z");
}

test("delivery packages require a currently approved handoff and preserve portable source identity, evidence, and provenance", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const draft = createHandoffDraft(entry, "content_candidate", capturedAt);
  assert.throws(() => createDeliveryPackage(entry, draft, capturedAt), /currently approved/);
  const approved = approvedHandoff(entry, "content_candidate");
  const tamperedApproval = { ...approved, derived_analysis: { ...approved.derived_analysis, target_audience: "tampered" } };
  assert.throws(() => createDeliveryPackage(entry, tamperedApproval, capturedAt), /currently approved/);
  const item = createDeliveryPackage(entry, approved, "2026-09-23T00:00:00.000Z");
  assert.equal(validateDeliveryPackage(item), true);
  assert.equal(item.source_record_id, entry.source_record.id);
  assert.match(item.source_record_fingerprint, /^[a-f0-9]{16}$/);
  assert.equal(item.handoff_id, approved.id);
  assert.equal(item.handoff_fingerprint, approved.approval_fingerprint);
  assert.equal(item.evidence_references[0]?.text_reference, approved.evidence_references[0]?.text_reference);
  assert.equal(item.provenance.source_url_original, "https://example.com/requested");
  assert.deepEqual(item.payload.derived_analysis, approved.derived_analysis);
  assert.equal(item.manifest.source_approval_status, "approved");
  assert.equal(item.manifest.handoff_approved_at, approved.approved_at);
  assert.ok(JSON.stringify(item.payload.derived_analysis).includes("Unknown — not assessed"));
  assert.equal(entry.source_record.review_status, "reviewed");
  assert.equal(entry.source_record.approval_status, "approved");
});

test("package fingerprints are deterministic, tampering fails, and all four consumer profiles are explicit", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const targets = { content_candidate: "content_ops", learning_pack: "cyber_kuma", creative_reference: "storyworld", case_reference: "diagnostic" } as const;
  for (const type of HANDOFF_TYPES) {
    const handoff = approvedHandoff(entry, type);
    const first = createDeliveryPackage(entry, handoff, "2026-09-23T00:00:00.000Z");
    const second = createDeliveryPackage(entry, handoff, "2026-09-23T00:00:00.000Z");
    assert.equal(first.package_fingerprint, second.package_fingerprint);
    assert.equal(first.target_product, targets[type]);
    assert.equal(validateConsumerCompatibility(first).compatible, true);
    assert.ok(CONSUMER_PROFILES[first.target_product].required_fields.includes("evidence_references"));
    assert.equal(validateDeliveryPackage({ ...first, source_record_id: "src_other" }), false);
  }
  const content = createDeliveryPackage(entry, approvedHandoff(entry, "content_candidate"), "2026-09-23T00:00:00.000Z");
  assert.equal(validateConsumerCompatibility({ ...content, target_product: "cyber_kuma" }).compatible, false);
  assert.equal(validateConsumerCompatibility({ ...content, contract_version: 99 }).compatible, false);
});

test("package snapshots remain immutable, become outdated after handoff edits, and revisions coexist", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const handoff = approvedHandoff(entry, "content_candidate");
  const packageOne = createDeliveryPackage(entry, handoff, "2026-09-23T00:00:00.000Z");
  const packageRecord = { package: packageOne, state: "packaged" as const, exported_at: null, import_confirmed_at: null };
  const withPackage = appendDeliveryPackage({ ...entry, downstream_handoffs: [handoff] }, packageRecord);
  const otherEntry = createSourceLibraryEntry({ ...approvedRecord(), id: "src_other_delivery" }, capturedAt);
  assert.throws(() => appendDeliveryPackage(otherEntry, packageRecord), /SourceRecord identity/);
  const edited = updateHandoff(handoff, { human_notes: "Edited after package creation" }, "2026-09-23T00:01:00.000Z");
  const withEditedHandoff = { ...withPackage, downstream_handoffs: [edited] };
  assert.equal(deliveryPackageStatus(packageRecord, withEditedHandoff), "outdated");
  assert.deepEqual(withEditedHandoff.delivery_packages[0]?.package, packageOne);
  assert.throws(() => updateDeliveryPackageRecord(withPackage, { ...packageRecord, package: { ...packageOne, payload: { ...packageOne.payload, human_notes: "mutated" } } }), /immutable/);

  const reapproved = approveHandoff(markHandoffReviewed(edited, "2026-09-23T00:02:00.000Z"), entry, "2026-09-23T00:03:00.000Z");
  const packageTwo = createDeliveryPackage(entry, reapproved, "2026-09-23T00:04:00.000Z");
  const revised = appendDownstreamHandoff(withEditedHandoff, reapproved);
  const revisedWithPackage = appendDeliveryPackage(revised, { package: packageTwo, state: "packaged", exported_at: null, import_confirmed_at: null });
  assert.equal(revisedWithPackage.delivery_packages.length, 2);
  assert.equal(deliveryPackageStatus(packageRecord, revisedWithPackage), "outdated");
  assert.equal(deliveryPackageStatus(revisedWithPackage.delivery_packages[1]!, revisedWithPackage), "packaged");
});

test("delivery lifecycle distinguishes export from explicit import confirmation and supports JSON/Markdown readback", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const handoff = approvedHandoff(entry, "learning_pack");
  const item = createDeliveryPackage(entry, handoff, "2026-09-23T00:00:00.000Z");
  const packaged = { package: item, state: "packaged" as const, exported_at: null, import_confirmed_at: null };
  assert.throws(() => confirmDeliveryPackageImported(packaged, capturedAt), /exported/);
  const exported = markDeliveryPackageExported(packaged, "2026-09-23T00:01:00.000Z");
  const imported = confirmDeliveryPackageImported(exported, "2026-09-23T00:02:00.000Z");
  assert.equal(exported.state, "exported");
  assert.equal(imported.state, "import_confirmed");
  const json = JSON.parse(JSON.stringify(item));
  assert.equal(validateDeliveryPackage(json), true);
  assert.equal(JSON.stringify(item).includes(sourceText), false);
  assert.match(deliveryPackageToMarkdown(item), /Evidence references/);
  assert.match(deliveryPackageToMarkdown(item), /Derived analysis \(not source facts\)/);
});

test("Content Ops pilot export follows its inspected v1 intake contract and keeps the consumer review gate separate", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const handoff = approvedHandoff(entry, "content_candidate");
  const item = createDeliveryPackage(entry, handoff, "2026-09-23T00:00:00.000Z");
  const intake = toContentOpsIntakePackage(item);
  assert.deepEqual(Object.keys(intake).sort(), ["exportedAt", "items", "packageType", "sourceSystem", "version"].sort());
  assert.equal(intake.packageType, "content-ops-handoff");
  assert.equal(intake.version, 1);
  assert.equal(intake.sourceSystem, "ai_pm_radar");
  assert.equal(intake.items[0]?.kind, "content_candidate");
  assert.equal(intake.items[0]?.externalId, item.package_id);
  assert.equal(intake.items[0]?.metadata.radarDelivery.source_record_id, item.source_record_id);
  assert.deepEqual(intake.items[0]?.metadata.radarDelivery.evidence_references, item.evidence_references);
  assert.deepEqual(intake.items[0]?.metadata.radarDelivery.provenance, item.provenance);
  assert.match(String(intake.items[0]?.metadata.radarDelivery.source_record_fingerprint), /^[a-f0-9]{16}$/);
  assert.equal(intake.items[0]?.text.includes("The synthetic pilot used a human review step"), false);
  assert.throws(() => toContentOpsIntakePackage(createDeliveryPackage(entry, approvedHandoff(entry, "learning_pack"), "2026-09-23T00:00:00.000Z")), /Only a compatible content_candidate/);
});

test("v0.2 Source Library backups migrate without losing data and legacy approvals require re-approval", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const oldApproved = {
    ...createHandoffDraft(entry, "content_candidate", capturedAt),
    schema_version: 1,
    status: "approved",
    reviewed_at: "2026-09-22T00:01:00.000Z",
    approved_at: "2026-09-22T00:02:00.000Z",
  };
  const v2 = { ...entry, version: 2, delivery_packages: undefined, downstream_handoffs: [oldApproved] };
  const backup = parseSourceLibraryBackup(serializeSourceLibraryBackup([v2 as never], "2026-09-23T00:00:00.000Z"));
  const migrated = backup.entries[0]!;
  assert.equal(migrated.version, 4);
  assert.equal(migrated.downstream_handoffs[0]?.status, "needs_review");
  assert.equal(migrated.downstream_handoffs[0]?.approved_at, null);
  assert.equal(migrated.source_record.id, entry.source_record.id);
  assert.equal(validateSourceLibraryEntry(migrated), true);
});

test("v3 Source Library entries migrate to v4 without changing approved source data", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const v3 = { ...entry, version: 3, intelligence_assessments: undefined };
  const migrated = migrateSourceLibraryEntry(v3);
  assert.equal(migrated?.version, 4);
  assert.deepEqual(migrated?.intelligence_assessments, []);
  assert.equal(migrated?.source_record.id, entry.source_record.id);
  assert.equal(migrated?.fingerprint, entry.fingerprint);
  assert.equal(validateSourceLibraryEntry(migrated), true);
});

test("assessments survive Source Library backup round-trip and cannot attach to another source fingerprint", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-backup-test" });
  const decided = decideIntelligenceRoute(assessment, assessment.routeRecommendations[0]!.id, { action: "accept" }, "2026-10-08T00:01:00.000Z");
  const withAssessment = { ...entry, intelligence_assessments: [decided] };
  const backup = parseSourceLibraryBackup(serializeSourceLibraryBackup([withAssessment], capturedAt));
  assert.deepEqual(backup.entries[0]?.intelligence_assessments, [decided]);
  assert.equal(validateSourceLibraryEntry(backup.entries[0]), true);
  assert.equal(validateSourceLibraryEntry({ ...withAssessment, fingerprint: "different-source-fingerprint" }), false);
});

test("Source Library rejects duplicate assessment IDs instead of hiding history", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-duplicate-test" });

  assert.equal(validateSourceLibraryEntry({ ...entry, intelligence_assessments: [assessment, assessment] }), false);
});

test("assessment route artifact IDs must resolve to the matching draft on the same SourceRecord", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const routes = ["research_brief", ...HANDOFF_TYPES] as const;

  for (const route of routes) {
    let assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: `assessment-${route}` });
    const recommendation = assessment.routeRecommendations.find((item) => item.route === route)!;
    assessment = decideIntelligenceRoute(assessment, recommendation.id, { action: "accept" }, capturedAt);

    let artifactEntry = entry;
    let artifactId: string;
    if (route === "research_brief") {
      artifactId = `brief-${route}`;
      artifactEntry = appendResearchBriefHandoff(entry, artifactId, capturedAt, buildResearchBrief(entry.source_record, artifactId, capturedAt));
    } else {
      const draft = createHandoffDraft(entry, route, capturedAt);
      artifactId = draft.id;
      artifactEntry = appendDownstreamHandoff(entry, draft);
    }

    const linked = markIntelligenceRouteCreated(assessment, recommendation.id, artifactId, capturedAt);
    assert.equal(validateSourceLibraryEntry({ ...artifactEntry, intelligence_assessments: [linked] }), true, route);
    assert.equal(validateSourceLibraryEntry({ ...entry, intelligence_assessments: [linked] }), false, `${route} must not point to a missing artifact`);
  }

  let assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-mismatched-route" });
  const recommendation = assessment.routeRecommendations.find((item) => item.route === "case_reference")!;
  assessment = decideIntelligenceRoute(assessment, recommendation.id, { action: "accept" }, capturedAt);
  const wrongDraft = createHandoffDraft(entry, "learning_pack", capturedAt);
  const linkedToWrongRoute = markIntelligenceRouteCreated(assessment, recommendation.id, wrongDraft.id, capturedAt);
  const wrongEntry = appendDownstreamHandoff(entry, wrongDraft);
  assert.equal(validateSourceLibraryEntry({ ...wrongEntry, intelligence_assessments: [linkedToWrongRoute] }), false);
});

test("checked-in delivery fixtures are deterministic contract examples for all consumers", async () => {
  for (const type of HANDOFF_TYPES) {
    const fixture = JSON.parse(await readFile(new URL(`../fixtures/delivery-packages/${type}.json`, import.meta.url), "utf8"));
    assert.equal(validateDeliveryPackage(fixture), true, `${type} fixture must pass package validation`);
    assert.equal(validateConsumerCompatibility(fixture).compatible, true);
    assert.equal(fixture.handoff_type, type);
    assert.match(fixture.source_record_fingerprint, /^[a-f0-9]{16}$/);
    assert.equal(JSON.stringify(fixture).includes("Synthetic study: human review caught two classification errors in a ten-item test."), false);
  }
  const contentOps = JSON.parse(await readFile(new URL("../fixtures/content_ops_compatibility_fixture.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(contentOps).sort(), ["exportedAt", "items", "packageType", "sourceSystem", "version"].sort());
  assert.equal(contentOps.packageType, "content-ops-handoff");
  assert.equal(contentOps.sourceSystem, "ai_pm_radar");
  assert.equal(contentOps.items[0].kind, "content_candidate");
  assert.equal(JSON.stringify(contentOps).includes("Synthetic study: human review caught two classification errors in a ten-item test."), false);
});

test("SourceRecord and approved handoffs survive backup import round-trip and merge without overwriting local edits", () => {
  const entry = createSourceLibraryEntry(approvedRecord(), capturedAt);
  const draft = createHandoffDraft(entry, "content_candidate", "2026-09-22T00:00:00.000Z");
  const reviewed = markHandoffReviewed(draft, "2026-09-22T00:01:00.000Z");
  const approved = approveHandoff(reviewed, entry, "2026-09-22T00:02:00.000Z");
  const deliveryPackage = createDeliveryPackage(entry, approved, "2026-09-23T00:00:00.000Z");
  const withHandoff = {
    ...entry,
    downstream_handoffs: [approved],
    delivery_packages: [{ package: deliveryPackage, state: "exported" as const, exported_at: "2026-09-23T00:01:00.000Z", import_confirmed_at: null }],
  };
  const restored = parseSourceLibraryBackup(serializeSourceLibraryBackup([withHandoff], "2026-09-23T00:00:00.000Z"));

  assert.equal(restored.entries[0]?.source_record.id, entry.source_record.id);
  assert.equal(restored.entries[0]?.downstream_handoffs[0]?.approved_at, approved.approved_at);
  assert.equal(restored.entries[0]?.downstream_handoffs[0]?.evidence_references[0]?.text_reference, approved.evidence_references[0]?.text_reference);
  assert.deepEqual(restored.entries[0]?.delivery_packages, withHandoff.delivery_packages);

  const localEdit = { ...withHandoff, downstream_handoffs: [updateHandoff(approved, { human_notes: "Local manual edit" })] };
  const merged = mergeSourceLibraryEntry(localEdit, restored.entries[0]!);
  assert.equal(merged.downstream_handoffs[0]?.human_notes, "Local manual edit");
  assert.equal(merged.downstream_handoffs[0]?.status, "draft");
  assert.throws(() => parseSourceLibraryBackup('{"version":99,"exported_at":"2026-09-23T00:00:00.000Z","entries":[]}'), /Unsupported/);
});
