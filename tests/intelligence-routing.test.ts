import assert from "node:assert/strict";
import test from "node:test";

import { normaliseSourceInput, type SourceRecord } from "../lib/source-inbox.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import {
  createIntelligenceAssessment,
  decideIntelligenceRoute,
  markIntelligenceRouteCreated,
  validateIntelligenceAssessment,
  type IntelligenceAssessment,
} from "../lib/intelligence-routing.ts";

const capturedAt = "2026-10-08T00:00:00.000Z";
const sourceUrl = "https://example.org/synthetic-ai-pilot";
const text = "A synthetic education team reviewed 24 AI classifications. Reviewers corrected 5 results before any decision. The pilot did not measure time savings or learner outcomes.";

function approvedEntry() {
  const record = normaliseSourceInput({
    value: text,
    kind: "paste_text",
    sourceUrl,
    title: "Synthetic classification pilot",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "Reviewers corrected 5 results before any decision." };
  const approved: SourceRecord = {
    ...record,
    summary: "A synthetic pilot included human correction before decisions.",
    key_points: ["Human reviewers corrected some classifications."],
    key_claims: [{ claim: "Reviewers corrected five results.", evidence: [evidence] }],
    evidence: [evidence],
    business_implication: "Review capacity may be needed before operational use.",
    ai_pm_implication: "Define a review threshold before rollout.",
    content_ideas: ["Explain why human review remains part of AI rollout."],
    case_candidate: true,
    review_status: "reviewed",
    approval_status: "approved",
  };
  return createSourceLibraryEntry(approved, capturedAt);
}

test("assessment is explainable, version-bound, and recommends multiple existing routes", () => {
  const entry = approvedEntry();
  const assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-synthetic-1" });

  assert.equal(assessment.sourceRecordId, entry.source_record.id);
  assert.equal(assessment.sourceFingerprint, entry.fingerprint);
  assert.equal(assessment.schemaVersion, 1);
  assert.equal(assessment.status, "needs_review");
  assert.equal(assessment.method.kind, "rules");
  assert.equal(assessment.method.version, "radar-intelligence-rules-v4");
  assert.ok(assessment.dimensions.source_quality.score >= 0);
  assert.ok(assessment.dimensions.source_quality.explanation.length > 0);
  assert.ok(assessment.dimensions.relevance.explanation.length > 0);
  assert.ok(assessment.dimensions.relevance.signals.includes("ai"));
  assert.ok(assessment.dimensions.relevance.signals.includes("education"));
  assert.ok(assessment.dimensions.source_quality.signals.includes("creator attribution is unknown"));
  assert.ok(assessment.dimensions.source_quality.signals.includes("publication date is unknown"));
  assert.ok(assessment.dimensions.source_quality.signals.includes("evidence grade is ungraded"));
  assert.ok(assessment.dimensions.source_quality.signals.includes("SourceRecord passed human review and reuse approval"));
  assert.ok(assessment.routeRecommendations.length >= 2);
  assert.ok(assessment.routeRecommendations.every((route) => route.decision.status === "pending"));
  assert.equal(entry.source_record.review_status, "reviewed");
  assert.equal(entry.source_record.approval_status, "approved");
  for (const version of ["radar-intelligence-rules-v1", "radar-intelligence-rules-v2", "radar-intelligence-rules-v3"] as const) {
    const legacySnapshot = { ...assessment, method: { kind: "rules" as const, version } };
    assert.equal(validateIntelligenceAssessment(legacySnapshot, entry.source_record.id, entry.fingerprint), true);
  }
});

test("relevance does not award keyword matches found only inside unrelated words", () => {
  const captured = normaliseSourceInput({
    value: "The training timeline is clear. Maintenance remains manual.",
    kind: "paste_text",
    sourceUrl: "https://example.org/operations",
    title: "Operational maintenance timeline",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "Maintenance remains manual." };
  const record: SourceRecord = {
    ...captured,
    summary: "A synthetic note documents a manual operating process.",
    key_points: ["The process remains manual."],
    key_claims: [{ claim: "The process remains manual.", evidence: [evidence] }],
    evidence: [evidence],
    business_implication: "Review the operating process before use.",
    ai_pm_implication: "Define an owner for the review step.",
    review_status: "reviewed",
    approval_status: "approved",
  };
  const assessment = createIntelligenceAssessment(createSourceLibraryEntry(record, capturedAt), { now: capturedAt });

  assert.equal(assessment.dimensions.relevance.score, 0);
  assert.deepEqual(assessment.dimensions.relevance.signals, []);
});

test("relevance recognizes documented Radar focus in Traditional Chinese source text", () => {
  const chineseText = "某教育機構以生成式人工智能協助產品管理及工作流程自動化；目前只完成人工審核，未量度節省時間。";
  const captured = normaliseSourceInput({
    value: chineseText,
    kind: "paste_text",
    sourceUrl,
    title: "教育機構的產品工作流程",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "目前只完成人工審核，未量度節省時間。" };
  const record: SourceRecord = {
    ...captured,
    key_claims: [{ claim: "尚未量度節省時間。", evidence: [evidence] }],
    evidence: [evidence],
    review_status: "reviewed",
    approval_status: "approved",
  };
  const assessment = createIntelligenceAssessment(createSourceLibraryEntry(record, capturedAt), { now: capturedAt });

  assert.ok(assessment.dimensions.relevance.score > 0);
  assert.ok(assessment.dimensions.relevance.signals.includes("教育"));
  assert.ok(assessment.dimensions.relevance.signals.includes("產品管理"));
});

test("relevance counts a semantic focus group once even when several synonyms match", () => {
  const synonyms = normaliseSourceInput({
    value: "AI, artificial intelligence, generative AI, and machine learning were mentioned as alternatives.",
    kind: "paste_text",
    sourceUrl,
    title: "Synthetic terminology note",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "AI, artificial intelligence, generative AI, and machine learning were mentioned as alternatives." };
  const record: SourceRecord = {
    ...synonyms,
    key_claims: [{ claim: "Several AI terms were listed.", evidence: [evidence] }],
    evidence: [evidence],
    review_status: "reviewed",
    approval_status: "approved",
  };
  const assessment = createIntelligenceAssessment(createSourceLibraryEntry(record, capturedAt), { now: capturedAt });

  assert.equal(assessment.dimensions.relevance.score, 32);
  assert.equal(assessment.dimensions.relevance.signals.length, 1);
});

test("assessment confidence reflects observable dimension signals, not baseline scores", () => {
  const captured = normaliseSourceInput({
    value: "Synthetic neutral note: The record was filed after a routine review.",
    kind: "paste_text",
    sourceUrl,
    title: "Neutral note",
    capturedAt,
  }, { now: capturedAt }).record;
  const evidence = { source: sourceUrl, timestamp: null, text_reference: "The record was filed after a routine review." };
  const record: SourceRecord = {
    ...captured,
    key_claims: [{ claim: "The note was filed after review.", evidence: [evidence] }],
    evidence: [evidence],
    review_status: "reviewed",
    approval_status: "approved",
  };
  const assessment = createIntelligenceAssessment(createSourceLibraryEntry(record, capturedAt), { now: capturedAt });

  assert.equal(assessment.dimensions.relevance.score, 0);
  assert.equal(assessment.dimensions.relevance.signals.length, 0);
  assert.equal(assessment.dimensions.actionability.score, 0);
  assert.equal(assessment.dimensions.actionability.signals.length, 0);
  assert.equal(assessment.dimensions.reuse_potential.score, 0);
  assert.equal(assessment.dimensions.reuse_potential.signals.length, 0);
  assert.equal(assessment.confidence, 0.4);
});

test("assessment validator rejects non-finite confidence and malformed route signals", () => {
  const entry = approvedEntry();
  const assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-validator-test" });

  assert.equal(validateIntelligenceAssessment({ ...assessment, confidence: Number.NaN }, entry.source_record.id, entry.fingerprint), false);
  assert.equal(validateIntelligenceAssessment({
    ...assessment,
    routeRecommendations: assessment.routeRecommendations.map((route, index) => index === 0
      ? { ...route, signals: [42] as unknown as string[] }
      : route),
  }, entry.source_record.id, entry.fingerprint), false);
});

test("assessment refuses a SourceRecord that has not passed its existing approval gate", () => {
  const entry = approvedEntry();
  const unapproved = {
    ...entry,
    source_record: { ...entry.source_record, approval_status: "not_approved" as const },
  };
  assert.throws(() => createIntelligenceAssessment(unapproved, { now: capturedAt }), /approved SourceRecord/);
});

test("route decisions require an explicit human action and never approve a handoff", () => {
  const entry = approvedEntry();
  const assessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-synthetic-2" });
  const recommendation = assessment.routeRecommendations[0]!;
  const accepted = decideIntelligenceRoute(assessment, recommendation.id, { action: "accept" }, "2026-10-08T00:01:00.000Z");

  assert.equal(accepted.routeRecommendations[0]?.decision.status, "accepted");
  assert.equal(accepted.status, "needs_review");
  assert.equal(accepted.routeRecommendations[0]?.decision.decidedAt, "2026-10-08T00:01:00.000Z");
  assert.equal(entry.downstream_handoffs.length, 0);
  const marked = markIntelligenceRouteCreated(accepted, recommendation.id, "handoff-synthetic-draft", "2026-10-08T00:02:00.000Z");
  assert.equal(marked.routeRecommendations[0]?.decision.createdArtifactId, "handoff-synthetic-draft");
  assert.equal(validateIntelligenceAssessment(marked, entry.source_record.id, entry.fingerprint), true);
  assert.throws(() => markIntelligenceRouteCreated(assessment, recommendation.id, "not-approved", capturedAt), /accepted/);
  assert.throws(() => decideIntelligenceRoute(assessment, recommendation.id, { action: "override", route: "learning_pack", reason: "" }, capturedAt), /override reason/);
});

test("all routes can be explicitly rejected and an override records its reason", () => {
  const entry = approvedEntry();
  let assessment: IntelligenceAssessment = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-synthetic-3" });
  for (const route of assessment.routeRecommendations) {
    assessment = decideIntelligenceRoute(assessment, route.id, { action: "reject", reason: "Not useful for this item." }, "2026-10-08T00:01:00.000Z");
  }
  assert.equal(assessment.status, "reviewed");
  assert.ok(assessment.routeRecommendations.every((route) => route.decision.status === "rejected"));

  const fresh = createIntelligenceAssessment(entry, { now: capturedAt, id: "assessment-synthetic-4" });
  const firstRecommendation = fresh.routeRecommendations[0]!;
  const alternateRoute = firstRecommendation.route === "case_reference" ? "learning_pack" : "case_reference";
  const overridden = decideIntelligenceRoute(fresh, fresh.routeRecommendations[0]!.id, {
    action: "override",
    route: alternateRoute,
    reason: "Use as a diagnostic case rather than its initial recommendation.",
  }, "2026-10-08T00:02:00.000Z");
  assert.equal(overridden.routeRecommendations[0]?.decision.status, "overridden");
  assert.equal(overridden.routeRecommendations[0]?.decision.selectedRoute, alternateRoute);
  assert.match(overridden.routeRecommendations[0]?.decision.reason ?? "", /diagnostic case/);
});
